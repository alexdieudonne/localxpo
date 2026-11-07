// Third-party Imports
import { z } from 'zod'

const num = z.number().finite()

/** Body of POST /builds/:id/metrics and /submissions/:id/metrics (sent by the CLI every ~20 s). */
export const metricsSchema = z.object({
  machine: z
    .object({
      hostname: z.string().max(200).optional(),
      os: z.string().max(200).optional(),
      arch: z.string().max(40).optional(),
      model: z.string().max(200).optional(),
      cpuModel: z.string().max(200).optional(),
      cores: num.optional(),
      perfCores: num.optional(),
      effCores: num.optional(),
      memTotal: num.optional(),
      diskTotal: num.optional(),
      node: z.string().max(100).optional(),
      xcode: z.string().max(100).optional(),
      java: z.string().max(200).optional(),
      fastlane: z.string().max(100).optional(),
      powerSource: z.enum(['battery', 'rapl', 'none']).optional()
    })
    .optional(),
  samples: z
    .array(
      z.object({
        ts: z.number().int(),
        step: z.string().max(40).optional(),
        cpu: num.min(0).max(100),
        load1: num.optional(),
        memUsed: num.min(0),
        memTotal: num.min(0),
        swapUsed: num.min(0).optional(),
        buildRss: num.min(0).optional(),
        buildCpu: num.min(0).optional(),
        buildProcs: num.optional(),
        top: z.array(z.object({ name: z.string().max(80), rss: num.min(0), cpu: num.min(0) })).max(8).optional(),
        powerMw: num.min(0).max(2_000_000).optional(),
        onBattery: z.boolean().optional(),
        batteryPct: num.min(0).max(100).optional(),
        cpuLimit: num.min(0).max(100).optional(),
        diskFree: num.min(0).optional()
      })
    )
    .max(500)
})
