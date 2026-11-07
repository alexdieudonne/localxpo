/** Resource metrics are sent by localxpo CLI 0.3.0 and later. */
export const METRICS_MIN_CLI = '0.3.0'

const parts = (v: string) => v.replace(/^v/, '').split(/[.-]/).slice(0, 3).map(n => Number(n) || 0)

/** null/unknown version: assume it may send metrics (submissions don't record a version). */
export const cliSendsMetrics = (version: string | null | undefined) => {
  if (!version) return true
  const [a, b, c] = parts(version)
  const [x, y, z] = parts(METRICS_MIN_CLI)

  return a !== x ? a > x : b !== y ? b > y : c >= z
}

/** Cancel from the dashboard (control check) and dashboard-started jobs need this CLI version or later. */
export const CONTROL_MIN_CLI = '0.3.0'

export const cliAtLeast = (version: string, min: string) => {
  const [a, b, c] = parts(version)
  const [x, y, z] = parts(min)

  return a !== x ? a > x : b !== y ? b > y : c >= z
}
