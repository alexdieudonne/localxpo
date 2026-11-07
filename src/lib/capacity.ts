import type { MachineCapacity } from '@/lib/limits-types'
import type { MachineInfo } from '@/lib/metrics-types'

const GB = 1024 ** 3

type MachineLike = { name: string; info: MachineInfo; gradlePeak: number | null; swappingBuilds: number }

export const capacityOf = (m: MachineLike): MachineCapacity => ({
  memTotal: m.info.memTotal,
  cores: m.info.cores,
  perfCores: m.info.perfCores,
  effCores: m.info.effCores,
  powerSource: m.info.powerSource,
  gradlePeak: m.gradlePeak,
  swapped: m.swappingBuilds > 0
})

/** "This machine: 18 GB RAM · 12 cores (6 performance + 6 efficiency) · Gradle used up to 4.2 GB" */
export const capacityLabel = (m: MachineLike, prefix = 'This machine') =>
  [
    `${prefix}: ${m.info.memTotal ? `${Math.round(m.info.memTotal / GB)} GB RAM` : 'RAM unknown'}`,
    m.info.cores ? `${m.info.cores} cores${m.info.perfCores && m.info.effCores ? ` (${m.info.perfCores} performance + ${m.info.effCores} efficiency)` : ''}` : null,
    m.gradlePeak ? `Gradle used up to ${(m.gradlePeak / GB).toFixed(1)} GB` : null,
    m.swappingBuilds ? `swapped in ${m.swappingBuilds} recent build${m.swappingBuilds > 1 ? 's' : ''}` : null
  ]
    .filter(Boolean)
    .join(' · ')

/** The default applies everywhere, so check it against the smallest machine that reported its specs. */
export const smallestMachine = <T extends MachineLike>(machines: T[]) =>
  machines.filter(m => m.info.memTotal).sort((a, b) => (a.info.memTotal! - b.info.memTotal!) || ((a.info.cores ?? 0) - (b.info.cores ?? 0)))[0] ?? null
