/** Resource limits for builds (shared by server and client components; no server imports here). */
export type BuildLimits = {

  /** Gradle daemon heap in GB (org.gradle.jvmargs -Xmx). The Kotlin daemon gets half, at least 1 GB. */
  gradleHeapGb?: number | null

  /** Parallel work: Gradle --max-workers and Xcode -jobs. */
  maxWorkers?: number | null

  /** 'low' runs every build command (and the Gradle / Xcode build daemons) at a lower CPU priority. */
  priority?: 'normal' | 'low' | null

  /** Stop the Gradle daemons when the build ends, so their memory goes back to the machine. */
  stopDaemons?: boolean | null
}

export const LIMIT_KEYS = ['gradleHeapGb', 'maxWorkers', 'priority', 'stopDaemons'] as const

/** Machine values win; anything a machine leaves unset comes from the organization default. */
export const mergeLimits = (base: BuildLimits | null, override: BuildLimits | null): BuildLimits => {
  const out: BuildLimits = {}

  for (const k of LIMIT_KEYS) {
    const v = override?.[k] ?? base?.[k]

    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v
  }

  return out
}

export const isEmptyLimits = (l: BuildLimits | null | undefined) => !l || LIMIT_KEYS.every(k => l[k] === undefined || l[k] === null)

/** What a machine can give a build: its specs plus what recent builds actually used. */
export type MachineCapacity = {
  memTotal?: number
  cores?: number
  perfCores?: number
  effCores?: number
  powerSource?: string

  /** Largest Gradle daemon memory seen in recent builds (bytes). */
  gradlePeak?: number | null

  /** Recent builds pushed the machine into swap. */
  swapped?: boolean
}

export type LimitField = 'gradleHeapGb' | 'maxWorkers' | 'priority' | 'stopDaemons'
export type LimitCheck = { field: LimitField; level: 'error' | 'warning' | 'info' | 'good'; message: string }

export type Recommendation = {
  values: BuildLimits

  /** Sensible bounds for the numeric limits on this machine. */
  ranges: { gradleHeapGb: [number, number] | null; maxWorkers: [number, number] | null }
  why: Partial<Record<LimitField, string>>
}

const GB = 1024 ** 3
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Recommended limits from the machine's specs and its recent builds:
 * - Gradle: a third of RAM (at least 3 GB, at most half of RAM so the Kotlin daemon, Metro and the system
 *   still fit), raised to what Gradle actually used when we've seen it.
 * - Workers: one per performance core (efficiency cores add little), fewer on 8 GB machines.
 */
export const recommendLimits = (cap: MachineCapacity): Recommendation => {
  const ram = cap.memTotal ? cap.memTotal / GB : null
  const cores = cap.cores ?? null
  const perf = cap.perfCores ?? null
  const why: Recommendation['why'] = {}

  let heap: number | null = null
  let heapRange: [number, number] | null = null

  if (ram) {
    const max = Math.max(2, Math.floor(ram * 0.5))

    heapRange = [Math.min(3, max), max]
    heap = clamp(Math.round(ram / 3), heapRange[0], Math.min(8, max))
    why.gradleHeapGb = `about a third of ${Math.round(ram)} GB RAM`

    const used = cap.gradlePeak ? cap.gradlePeak / GB : null

    // RSS includes ~1 GB beyond the heap (metaspace, threads): size the heap to the observed peak.
    if (used && Math.ceil(used) > heap) {
      heap = clamp(Math.ceil(used), heapRange[0], max)
      why.gradleHeapGb = `Gradle used up to ${used.toFixed(1)} GB in recent builds`
    }

    if (cap.swapped && heap > Math.round(ram / 4) && !used) {
      heap = clamp(Math.round(ram / 4), heapRange[0], max)
      why.gradleHeapGb = 'recent builds ran out of RAM, so a bit less than usual'
    }
  }

  let workers: number | null = null
  let workerRange: [number, number] | null = null

  if (cores) {
    workerRange = [Math.min(2, cores), cores]
    workers = perf ?? Math.max(2, cores - 2)
    why.maxWorkers = perf ? `one per performance core (${perf})` : `all cores but two, so the machine stays usable`

    if (ram && ram <= 8) {
      workers = Math.min(workers, 4)
      why.maxWorkers = 'at most 4 on an 8 GB machine: each worker needs memory'
    }
  }

  const laptop = cap.powerSource === 'battery'

  why.priority = laptop ? 'a laptop you also work on: builds yield to your apps' : 'a machine that mostly builds'
  why.stopDaemons = ram !== null && (ram <= 16 || cap.swapped) ? 'frees several GB right after each build' : 'enough RAM to keep them warm for faster next builds'

  return {
    values: {
      gradleHeapGb: heap,
      maxWorkers: workers,
      priority: laptop ? 'low' : 'normal',
      stopDaemons: ram !== null && (ram <= 16 || Boolean(cap.swapped))
    },
    ranges: { gradleHeapGb: heapRange, maxWorkers: workerRange },
    why
  }
}

/** Kept for older callers: the recommended values only. */
export const suggestLimits = (info: MachineCapacity): BuildLimits => recommendLimits(info).values

/** Alerts for limits that are too low or too high for this machine (checked live in the form). */
export const checkLimits = (l: BuildLimits, cap: MachineCapacity): LimitCheck[] => {
  const out: LimitCheck[] = []
  const ram = cap.memTotal ? cap.memTotal / GB : null
  const cores = cap.cores ?? null
  const used = cap.gradlePeak ? cap.gradlePeak / GB : null

  if (l.gradleHeapGb) {
    const heap = l.gradleHeapGb
    const kotlin = Math.max(1, Math.round(heap / 2))

    if (heap < 2)
      out.push({ field: 'gradleHeapGb', level: 'error', message: 'Too low: React Native release builds run out of memory below 2 GB (Java heap space).' })
    else if (heap < 3 && !(used && used < 2.5))
      out.push({ field: 'gradleHeapGb', level: 'warning', message: 'Low: fine for small apps, but R8 and Hermes on bigger ones often need 3 GB or more.' })

    if (ram && heap + kotlin > ram - 2)
      out.push({
        field: 'gradleHeapGb',
        level: 'error',
        message: `Too high: Gradle ${heap} GB + Kotlin ${kotlin} GB doesn't fit in ${Math.round(ram)} GB RAM with the system running.`
      })
    else if (ram && heap > ram * 0.5)
      out.push({ field: 'gradleHeapGb', level: 'warning', message: `High: more than half of the ${Math.round(ram)} GB RAM. The machine will likely swap.` })

    if (used && used > heap + 1)
      out.push({
        field: 'gradleHeapGb',
        level: 'warning',
        message: `Recent builds' Gradle daemon used up to ${used.toFixed(1)} GB: a ${heap} GB cap may slow the build (more garbage collection) or fail it.`
      })
  }

  if (l.maxWorkers) {
    const w = l.maxWorkers

    if (w === 1) out.push({ field: 'maxWorkers', level: 'warning', message: 'Very low: one worker builds everything sequentially, several times slower.' })

    if (cores && w > cores)
      out.push({ field: 'maxWorkers', level: 'warning', message: `More than the ${cores} cores: extra workers only add memory use, not speed.` })
    else if (cap.perfCores && cap.effCores && w > cap.perfCores)
      out.push({
        field: 'maxWorkers',
        level: 'info',
        message: `Above the ${cap.perfCores} performance cores: the extra workers run on efficiency cores, which are slower.`
      })

    if (ram && w * 0.5 + (l.gradleHeapGb ?? 2) * 1.5 > ram * 0.85)
      out.push({
        field: 'maxWorkers',
        level: 'warning',
        message: `Each worker needs about 0.5 GB on top of the Gradle heap: ${w} workers may not fit in ${Math.round(ram)} GB.`
      })
  }

  if (cap.swapped && !l.stopDaemons)
    out.push({ field: 'stopDaemons', level: 'info', message: 'Recent builds swapped: stopping the daemons afterwards gives that memory back.' })

  if (cap.powerSource === 'battery' && l.priority !== 'low')
    out.push({ field: 'priority', level: 'info', message: 'On a laptop you work on, low priority keeps apps responsive during builds.' })

  for (const f of ['gradleHeapGb', 'maxWorkers'] as const)
    if (l[f] && !out.some(c => c.field === f)) out.push({ field: f, level: 'good', message: 'Good fit for this machine.' })

  return out
}

export const describeLimits = (l: BuildLimits) =>
  [
    l.gradleHeapGb ? `Gradle ${l.gradleHeapGb} GB` : null,
    l.maxWorkers ? `${l.maxWorkers} workers` : null,
    l.priority === 'low' ? 'low priority' : null,
    l.stopDaemons ? 'stop daemons after' : null
  ].filter(Boolean) as string[]
