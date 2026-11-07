/** Resource metrics shapes, shared by the server and client components (no server imports here). */

export type MachineInfo = {
  hostname?: string

  /** "macOS 15.1", "Ubuntu 24.04"… */
  os?: string
  arch?: string

  /** Marketing / hardware model: "MacBook Pro (Mac15,6)", "Apple M3 Pro". */
  model?: string
  cpuModel?: string
  cores?: number
  perfCores?: number
  effCores?: number
  memTotal?: number
  diskTotal?: number
  node?: string
  xcode?: string
  java?: string
  fastlane?: string

  /** Whether the machine reports power draw (battery telemetry / RAPL). */
  powerSource?: 'battery' | 'rapl' | 'none'
}

export type SampleProcess = { name: string; rss: number; cpu: number }

export type Sample = {
  ts: number
  step?: string

  /** Whole machine, 0-100. */
  cpu: number
  load1?: number
  memUsed: number
  memTotal: number
  swapUsed?: number

  /** Processes doing the build (CLI children + Gradle / Kotlin daemons + Xcode build service). */
  buildRss?: number

  /** Their CPU, as a share of the whole machine (0-100). */
  buildCpu?: number
  buildProcs?: number
  top?: SampleProcess[]
  powerMw?: number
  onBattery?: boolean
  batteryPct?: number

  /** macOS CPU speed limit (100 = no thermal throttling). */
  cpuLimit?: number
  diskFree?: number
}

export type RunKind = 'builds' | 'submissions'

export type StepMetrics = { step: string; durationMs: number; cpuAvg: number; memPeak: number; buildRssPeak: number }

export type MetricsSummary = {
  samples: number
  firstTs: number
  lastTs: number
  cpuAvg: number
  cpuPeak: number
  memTotal: number
  memPeak: number
  memStart: number
  swapStart: number | null
  swapPeak: number | null
  buildRssPeak: number | null
  buildCpuAvg: number | null
  topProcesses: { name: string; rssPeak: number; cpuAvg: number }[]
  powerAvgW: number | null
  powerPeakW: number | null
  energyWh: number | null
  batteryShare: number
  batteryDrop: number | null
  throttledShare: number
  cpuLimitMin: number | null
  diskFreeMin: number | null
  steps: StepMetrics[]
}

export type Insight = { level: 'good' | 'info' | 'warning'; title: string; detail: string }
