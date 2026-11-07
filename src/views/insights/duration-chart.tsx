'use client'

// Third-party Imports
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

// Component Imports
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const config = {
  ios: { label: 'iOS', color: 'var(--chart-1)' },
  android: { label: 'Android', color: 'var(--chart-2)' }
} satisfies ChartConfig

type Point = { label: string; platform: 'ios' | 'android'; minutes: number }

const DurationChart = ({ points }: { points: Point[] }) => {
  if (points.length === 0) return <p className='text-muted-foreground py-16 text-center text-sm'>No successful builds yet.</p>

  // One row per build; the other platform's value stays empty so each line only connects its own builds.
  const data = points.map(p => ({ label: p.label, [p.platform]: Math.round(p.minutes * 10) / 10 }))

  return (
    <ChartContainer config={config} className='aspect-auto h-56 w-full'>
      <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis dataKey='label' tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
        <YAxis tickLine={false} axisLine={false} width={44} unit='m' />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey='ios' stroke='var(--color-ios)' strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line dataKey='android' stroke='var(--color-android)' strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ChartContainer>
  )
}

export default DurationChart
