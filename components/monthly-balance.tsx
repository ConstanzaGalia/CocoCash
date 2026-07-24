'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Transaction } from '@/lib/types'

function formatCurrency(amount: number, currency: string = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface MonthlyBalanceProps {
  transactions: Transaction[]
  currency?: 'ARS' | 'USD'
}

export function MonthlyBalance({ transactions, currency = 'ARS' }: MonthlyBalanceProps) {
  const now = new Date()

  // Construir los ultimos 6 meses
  const months: { key: string; label: string; year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth(),
    })
  }

  const filtered = transactions.filter((t) => t.currency === currency)

  const data = months.map((m) => {
    const monthTx = filtered.filter((t) => {
      const date = new Date(t.date)
      return date.getFullYear() === m.year && date.getMonth() === m.month
    })
    const ingresos = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const gastos = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return { mes: m.label, ingresos, gastos, balance: ingresos - gastos }
  })

  const current = data[data.length - 1]
  const netBalance = current.balance
  const isPositive = netBalance >= 0

  const chartConfig = {
    ingresos: { label: 'Ingresos', color: 'var(--chart-1)' },
    gastos: { label: 'Gastos', color: 'var(--chart-2)' },
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Balance neto del mes */}
      <Card
        className={
          isPositive
            ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
            : 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20'
        }
      >
        <CardHeader className="pb-2">
          <CardTitle className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            Balance neto del mes ({currency})
          </CardTitle>
          <CardDescription>Ingresos menos gastos de este mes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}
            {formatCurrency(netBalance, currency)}
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ingresos</span>
              <span className="font-medium text-emerald-400">{formatCurrency(current.ingresos, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gastos</span>
              <span className="font-medium text-red-400">{formatCurrency(current.gastos, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grafico evolucion */}
      <Card className="lg:col-span-2 border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Evolucion mensual</CardTitle>
          <CardDescription>Ingresos vs gastos de los ultimos 6 meses ({currency})</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={data} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`
                  return `${v}`
                }}
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value, name) => [formatCurrency(Number(value), currency), name === 'ingresos' ? ' Ingresos' : ' Gastos']} />}
              />
              <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
