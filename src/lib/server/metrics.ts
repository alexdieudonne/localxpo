import type { Insight, MachineInfo, MetricsSummary, RunKind, Sample, StepMetrics } from '@/lib/metrics-types'

import { db } from './db'

export type { Insight, MachineInfo, MetricsSummary, RunKind, Sample, SampleProcess, StepMetrics } from '@/lib/metrics-types'

// ---------- Writing ----------

const SAMPLE_GAP_CAP_MS = 30_000 // a gap longer than this (sleep, offline) doesn't count as energy

export const recordMetrics = async (kind: RunKind, run: { id: string; org_id: string; machine: string | null }, input: { machine?: MachineInfo; samples: Sample[] }) => {
  await db.tx(async t => {
    for (const s of input.samples) {
      const { ts, step, ...data } = s

      await t.run(
        `INSERT INTO run_samples (run_kind, run_id, ts, step, data_json) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (run_kind, run_id, ts) DO UPDATE SET step = excluded.step, data_json = excluded.data_json`,
        kind,
        run.id,
        ts,
        step ?? null,
        JSON.stringify(data)
      )
    }

    if (run.machine) {
      const now = Date.now()

      await t.run(
        `INSERT INTO machines (org_id, name, info_json, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (org_id, name) DO UPDATE SET last_seen = excluded.last_seen,
           info_json = CASE WHEN excluded.info_json = '{}' THEN machines.info_json ELSE excluded.info_json END`,
        run.org_id,
        run.machine,
        JSON.stringify(input.machine ?? {}),
        now,
        now
      )
    }
  })

  // Summary from every sample so far (after the commit, so it includes this batch).
  const summary = summarize(await getSamples(kind, run.id))

  await db.run(`UPDATE ${kind} SET metrics_json = ? WHERE id = ?`, summary ? JSON.stringify(summary) : null, run.id)
}

// ---------- Reading ----------

export const getSamples = async (kind: RunKind, runId: string, tail?: number): Promise<Sample[]> =>
  (
    (tail
      ? (await db.all('SELECT * FROM (SELECT ts, step, data_json FROM run_samples WHERE run_kind = ? AND run_id = ? ORDER BY ts DESC LIMIT ?) AS recent ORDER BY ts', kind, runId, tail))
      : (await db.all('SELECT ts, step, data_json FROM run_samples WHERE run_kind = ? AND run_id = ? ORDER BY ts', kind, runId))) as {
      ts: number
      step: string | null
      data_json: string
    }[]
  ).map(r => ({ ...(JSON.parse(r.data_json) as Omit<Sample, 'ts' | 'step'>), ts: r.ts, step: r.step ?? undefined }))

export const parseSummary = (json: string | null | undefined): MetricsSummary | null => {
  if (!json) return null

  try {
    return JSON.parse(json) as MetricsSummary
  } catch {
    return null
  }
}

export const getMachine = async (orgId: string, name: string | null) => {
  if (!name) return null

  const row = (await db.one('SELECT info_json, first_seen, last_seen FROM machines WHERE org_id = ? AND name = ?', orgId, name)) as
    | { info_json: string; first_seen: number; last_seen: number }
    | undefined

  return row ? { name, info: JSON.parse(row.info_json) as MachineInfo, firstSeen: row.first_seen, lastSeen: row.last_seen } : null
}

// ---------- Summary ----------

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)
const defined = <T>(xs: (T | undefined | null)[]) => xs.filter((x): x is T => x !== undefined && x !== null)

export const summarize = (samples: Sample[]): MetricsSummary | null => {
  if (!samples.length) return null

  const powered = samples.filter(s => s.powerMw !== undefined)
  let energyMwh = 0

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    const dt = b.ts - a.ts

    if (a.powerMw === undefined || b.powerMw === undefined || dt <= 0 || dt > SAMPLE_GAP_CAP_MS) continue
    energyMwh += ((a.powerMw + b.powerMw) / 2) * (dt / 3_600_000)
  }

  // Per process name: peak memory and average CPU across the samples where it showed up.
  const procs = new Map<string, { rssPeak: number; cpu: number[] }>()

  for (const s of samples)
    for (const p of s.top ?? []) {
      const e = procs.get(p.name) ?? { rssPeak: 0, cpu: [] }

      e.rssPeak = Math.max(e.rssPeak, p.rss)
      e.cpu.push(p.cpu)
      procs.set(p.name, e)
    }

  // Steps in the order they ran; a step's time runs until the next sample of another step.
  const steps: StepMetrics[] = []

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const key = s.step ?? 'run'
    const next = samples[i + 1]
    const dt = next ? Math.min(next.ts - s.ts, SAMPLE_GAP_CAP_MS) : 0
    let cur = steps[steps.length - 1]

    if (!cur || cur.step !== key) {
      cur = { step: key, durationMs: 0, cpuAvg: 0, memPeak: 0, buildRssPeak: 0 }
      ;(cur as StepMetrics & { _cpu: number[] })._cpu = []
      steps.push(cur)
    }

    cur.durationMs += dt
    cur.memPeak = Math.max(cur.memPeak, s.memUsed)
    cur.buildRssPeak = Math.max(cur.buildRssPeak, s.buildRss ?? 0)
    ;(cur as StepMetrics & { _cpu: number[] })._cpu.push(s.cpu)
  }

  for (const st of steps as (StepMetrics & { _cpu?: number[] })[]) {
    st.cpuAvg = Math.round(avg(st._cpu ?? []))
    delete st._cpu
  }

  const swaps = defined(samples.map(s => s.swapUsed))
  const limits = defined(samples.map(s => s.cpuLimit))
  const battery = defined(samples.map(s => s.batteryPct))
  const disk = defined(samples.map(s => s.diskFree))
  const buildRss = defined(samples.map(s => s.buildRss))
  const buildCpu = defined(samples.map(s => s.buildCpu))
  const watts = powered.map(s => s.powerMw! / 1000)

  return {
    samples: samples.length,
    firstTs: samples[0].ts,
    lastTs: samples[samples.length - 1].ts,
    cpuAvg: Math.round(avg(samples.map(s => s.cpu))),
    cpuPeak: Math.round(max(samples.map(s => s.cpu))),
    memTotal: max(samples.map(s => s.memTotal)),
    memPeak: max(samples.map(s => s.memUsed)),
    memStart: samples[0].memUsed,
    swapStart: swaps.length ? swaps[0] : null,
    swapPeak: swaps.length ? max(swaps) : null,
    buildRssPeak: buildRss.length ? max(buildRss) : null,
    buildCpuAvg: buildCpu.length ? Math.round(avg(buildCpu)) : null,
    topProcesses: [...procs.entries()]
      .map(([name, e]) => ({ name, rssPeak: e.rssPeak, cpuAvg: Math.round(avg(e.cpu)) }))
      .sort((a, b) => b.rssPeak - a.rssPeak)
      .slice(0, 6),
    powerAvgW: watts.length ? Math.round(avg(watts) * 10) / 10 : null,
    powerPeakW: watts.length ? Math.round(max(watts) * 10) / 10 : null,
    energyWh: powered.length > 1 ? Math.round((energyMwh / 1000) * 100) / 100 : null,
    batteryShare: samples.filter(s => s.onBattery).length / samples.length,
    batteryDrop: battery.length > 1 ? battery[0] - battery[battery.length - 1] : null,
    throttledShare: limits.length ? limits.filter(l => l < 100).length / limits.length : 0,
    cpuLimitMin: limits.length ? Math.min(...limits) : null,
    diskFreeMin: disk.length ? Math.min(...disk) : null,
    steps
  }
}

// ---------- Insights ----------


const GB = 1024 ** 3
const gb = (b: number) => `${(b / GB).toFixed(b >= 10 * GB ? 0 : 1)} GB`

const STEP_HINTS: Record<string, string> = {
  install: 'Dependency install is mostly network and disk. A warm package-manager cache (or --skip-install when nothing changed) helps.',
  pods: 'CocoaPods is mostly network. Keeping ios/Pods between builds (no --clean) avoids re-downloading.',
  prebuild: 'Regenerating the native folder each build is what EAS does too; it is usually a small part of the time.'
}

export const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)

  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Plain-language observations about one run. `typicalMs` is the median duration of earlier successful runs of
 * the same project/platform/profile on the same machine.
 */
export const insightsFor = (
  m: MetricsSummary,
  ctx: { durationMs: number | null; typicalMs: number | null; typicalCount: number; failed: boolean }
): Insight[] => {
  const out: Insight[] = []
  const memPct = m.memTotal ? m.memPeak / m.memTotal : 0
  const swapGrowth = m.swapPeak !== null && m.swapStart !== null ? m.swapPeak - m.swapStart : 0

  if (ctx.durationMs && ctx.durationMs > 0 && ctx.typicalMs && ctx.typicalMs > 0 && ctx.typicalCount >= 2) {
    const ratio = ctx.durationMs / ctx.typicalMs

    if (ratio >= 1.25)
      out.push({
        level: 'warning',
        title: `${Math.round((ratio - 1) * 100)}% slower than usual on this machine`,
        detail: `Similar builds here usually take ${Math.round(ctx.typicalMs / 60000)} min (median of ${ctx.typicalCount}). Check memory and throttling below, or what else was running.`
      })
    else if (ratio <= 0.8)
      out.push({
        level: 'good',
        title: `${Math.round((1 - ratio) * 100)}% faster than usual on this machine`,
        detail: `Similar builds here usually take ${Math.round(ctx.typicalMs / 60000)} min (median of ${ctx.typicalCount}), so caches were probably warm.`
      })
  }

  if (swapGrowth > 1 * GB || memPct > 0.92)
    out.push({
      level: 'warning',
      title: 'Memory pressure',
      detail: `RAM peaked at ${gb(m.memPeak)} of ${gb(m.memTotal)}${swapGrowth > 0.25 * GB ? ` and ${gb(swapGrowth)} went to swap` : ''}. Close heavy apps (simulators, Docker, browsers) while building, or set a Gradle memory / parallel workers limit for this machine (Machines page) so the build fits in RAM.`
    })

  const heaviest = m.topProcesses[0]

  if (heaviest && heaviest.rssPeak > 0.25 * m.memTotal)
    out.push({
      level: 'info',
      title: `${heaviest.name} used the most memory`,
      detail: `Up to ${gb(heaviest.rssPeak)} (${Math.round((heaviest.rssPeak / m.memTotal) * 100)}% of this machine's RAM).`
    })

  if (m.throttledShare > 0.1)
    out.push({
      level: 'warning',
      title: 'The CPU was throttled by heat',
      detail: `macOS limited the CPU speed (down to ${m.cpuLimitMin}%) during ${Math.round(m.throttledShare * 100)}% of the build. Better airflow (lid open, not on a soft surface) gives faster builds.`
    })

  if (m.batteryShare > 0.5)
    out.push({
      level: 'info',
      title: 'Built on battery',
      detail: `${m.batteryDrop ? `The battery dropped ${m.batteryDrop}%. ` : ''}Low Power Mode, or the system saving energy on battery, can slow long builds; plug in for release builds.`
    })

  if (m.diskFreeMin !== null && m.diskFreeMin < 15 * GB)
    out.push({
      level: 'warning',
      title: 'Low disk space',
      detail: `Only ${gb(m.diskFreeMin)} free. Xcode and Gradle need room for caches. Clear ~/Library/Developer/Xcode/DerivedData or ~/.gradle/caches.`
    })

  // Where did the time go?
  const total = m.steps.reduce((a, s) => a + s.durationMs, 0)
  const longest = [...m.steps].sort((a, b) => b.durationMs - a.durationMs)[0]

  if (longest && total > 0 && longest.durationMs / total > 0.4 && longest.durationMs > 60_000) {
    const idle = longest.cpuAvg < 25

    out.push({
      level: 'info',
      title: `"${longest.step}" took ${Math.round((longest.durationMs / total) * 100)}% of the time`,
      detail: idle
        ? `The CPU averaged only ${longest.cpuAvg}% during it, so it was waiting on network or disk. ${STEP_HINTS[longest.step] ?? ''}`.trim()
        : `CPU averaged ${longest.cpuAvg}%: this step is compute-bound, so a faster machine or fewer background apps help most.`
    })
  }

  if (m.cpuAvg < 35 && total > 5 * 60_000 && !ctx.failed && !out.some(i => i.title.includes('took')))
    out.push({
      level: 'info',
      title: 'The machine had room to spare',
      detail: `CPU averaged ${m.cpuAvg}%: most of the time went to waiting (downloads, single-threaded tasks), not computing.`
    })

  if (m.energyWh !== null && m.energyWh > 0)
    out.push({
      level: 'info',
      title: `About ${m.energyWh < 1 ? m.energyWh.toFixed(2) : m.energyWh.toFixed(1)} Wh of energy`,
      detail: `Average draw ${m.powerAvgW} W, peak ${m.powerPeakW} W. That's roughly ${Math.max(1, Math.round((m.energyWh / 15) * 100))}% of a phone charge.`
    })

  return out
}

/** Median duration of earlier successful runs like this one (same project, platform, profile, machine). */
export const typicalDuration = async (b: { id: string; project_id: string; platform: string; profile: string; machine: string | null }) => {
  if (!b.machine) return { typicalMs: null, typicalCount: 0 }

  const rows = (await db.all(`SELECT finished_at - started_at AS ms FROM builds
       WHERE project_id = ? AND platform = ? AND profile = ? AND machine = ? AND status = 'success' AND id != ?
         AND started_at IS NOT NULL AND finished_at IS NOT NULL
       ORDER BY created_at DESC LIMIT 20`, b.project_id, b.platform, b.profile, b.machine, b.id)) as { ms: number }[]

  const valid = rows.map(r => r.ms).filter(ms => ms > 0)

  return { typicalMs: median(valid), typicalCount: valid.length }
}

// ---------- Machines page ----------

export type MachineStats = {
  name: string
  info: MachineInfo
  firstSeen: number | null
  lastSeen: number | null
  builds: number
  succeeded: number
  failed: number
  medianAndroidMs: number | null
  medianIosMs: number | null
  avgCpu: number | null
  avgMemPeakPct: number | null
  avgEnergyWh: number | null
  totalEnergyWh: number | null
  throttledBuilds: number
  swappingBuilds: number

  /** Largest Gradle daemon memory seen in recent builds (bytes), for sizing its heap. */
  gradlePeak: number | null

  /** Largest memory of all build processes together (bytes). */
  buildRssPeak: number | null
}

export const listMachines = async (orgId: string, sinceDays = 30): Promise<MachineStats[]> => {
  const since = Date.now() - sinceDays * 86_400_000

  const builds = (await db.all(`SELECT machine, platform, status, started_at, finished_at, created_at, metrics_json FROM builds
       WHERE org_id = ? AND machine IS NOT NULL AND created_at >= ?`, orgId, since)) as {
    machine: string
    platform: string
    status: string
    started_at: number | null
    finished_at: number | null
    created_at: number
    metrics_json: string | null
  }[]

  const machines = (await db.all('SELECT name, info_json, first_seen, last_seen FROM machines WHERE org_id = ?', orgId)) as {
    name: string
    info_json: string
    first_seen: number
    last_seen: number
  }[]

  const byName = new Map<string, MachineStats & { _a: number[]; _i: number[]; _cpu: number[]; _mem: number[]; _e: number[] }>()

  const entry = (name: string) => {
    let e = byName.get(name)

    if (!e) {
      e = {
        name,
        info: {},
        firstSeen: null,
        lastSeen: null,
        builds: 0,
        succeeded: 0,
        failed: 0,
        medianAndroidMs: null,
        medianIosMs: null,
        avgCpu: null,
        avgMemPeakPct: null,
        avgEnergyWh: null,
        totalEnergyWh: null,
        throttledBuilds: 0,
        swappingBuilds: 0,
        gradlePeak: null,
        buildRssPeak: null,
        _a: [],
        _i: [],
        _cpu: [],
        _mem: [],
        _e: []
      }
      byName.set(name, e)
    }

    return e
  }

  for (const m of machines) {
    const e = entry(m.name)

    e.info = JSON.parse(m.info_json) as MachineInfo
    e.firstSeen = m.first_seen
    e.lastSeen = m.last_seen
  }

  for (const b of builds) {
    const e = entry(b.machine)
    const metrics = parseSummary(b.metrics_json)

    e.builds++
    if (b.status === 'success') e.succeeded++
    if (b.status === 'failed') e.failed++
    e.lastSeen = Math.max(e.lastSeen ?? 0, b.finished_at ?? b.created_at)
    e.firstSeen = Math.min(e.firstSeen ?? Infinity, b.created_at)

    if (b.status === 'success' && b.started_at && b.finished_at) (b.platform === 'ios' ? e._i : e._a).push(b.finished_at - b.started_at)

    if (metrics) {
      e._cpu.push(metrics.cpuAvg)
      if (metrics.memTotal) e._mem.push(metrics.memPeak / metrics.memTotal)
      if (metrics.energyWh !== null) e._e.push(metrics.energyWh)
      if (metrics.throttledShare > 0.1) e.throttledBuilds++
      if (metrics.swapPeak !== null && metrics.swapStart !== null && metrics.swapPeak - metrics.swapStart > GB) e.swappingBuilds++

      const gradle = metrics.topProcesses.find(p => p.name === 'Gradle daemon')?.rssPeak

      if (gradle) e.gradlePeak = Math.max(e.gradlePeak ?? 0, gradle)
      if (metrics.buildRssPeak) e.buildRssPeak = Math.max(e.buildRssPeak ?? 0, metrics.buildRssPeak)
    }
  }

  return [...byName.values()]
    .map(({ _a, _i, _cpu, _mem, _e, ...e }) => ({
      ...e,
      medianAndroidMs: median(_a),
      medianIosMs: median(_i),
      avgCpu: _cpu.length ? Math.round(avg(_cpu)) : null,
      avgMemPeakPct: _mem.length ? Math.round(avg(_mem) * 100) : null,
      avgEnergyWh: _e.length ? Math.round(avg(_e) * 10) / 10 : null,
      totalEnergyWh: _e.length ? Math.round(_e.reduce((a, b) => a + b, 0) * 10) / 10 : null
    }))
    .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
}
