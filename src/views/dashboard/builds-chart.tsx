'use client'

// Third-party Imports
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

// Component Imports
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const config = {
  success: { label: 'Succeeded', color: 'oklch(0.627 0.17 149.2)' },
  failed: { label: 'Failed', color: 'var(--destructive)' },
  other: { label: 'Other', color: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)' }
} satisfies ChartConfig

const BuildsChart = ({ days }: { days: { date: string; success: number; failed: number; other: number }[] }) => {
  const data = days.map(d => ({
    ...d,
    label: new Date(`${d.date}T12:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' })
  }))

  return (
    <ChartContainer config={config} className='aspect-auto h-56 w-full'>
      <BarChart data={data} margin={{ left: -20, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis dataKey='label' tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent />} />
        <Bar dataKey='success' stackId='a' fill='var(--color-success)' radius={[0, 0, 0, 0]} />
        <Bar dataKey='failed' stackId='a' fill='var(--color-failed)' />
        <Bar dataKey='other' stackId='a' fill='var(--color-other)' radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

export default BuildsChart
