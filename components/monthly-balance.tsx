'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { Currency, Transaction } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface MonthlyBalanceProps {
  transactions: Transaction[]
}

function buildSeries(transactions: Transaction[], currency: Currency) {
  const now = new Date()
  const months: { label: string; year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      label: MONTH_LABELS[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth(),
    })
  }

  const filtered = transactions.filter((t) => t.currency === currency)
  return months.map((m) => {
    const monthTx = filtered.filter((t) => {
      const date = new Date(t.date)
      return date.getFullYear() === m.year && date.getMonth() === m.month
    })
    const ingresos = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const gastos = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return { mes: m.label, ingresos, gastos, balance: ingresos - gastos }
  })
}

export function MonthlyBalance({ transactions }: MonthlyBalanceProps) {
  const hasUsd = useMemo(
    () => transactions.some((tx) => tx.currency === 'USD'),
    [transactions],
  )
  const [currency, setCurrency] = useState<Currency>('ARS')
  const data = useMemo(() => buildSeries(transactions, currency), [transactions, currency])
  const current = data[data.length - 1]
  const netBalance = current.balance
  const isPositive = netBalance >= 0

  const chartConfig = {
    ingresos: { label: 'Ingresos', color: 'var(--chart-1)' },
    gastos: { label: 'Gastos', color: 'var(--chart-2)' },
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        className={
          isPositive
            ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
            : 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20'
        }
      >
        <CardHeader className="pb-2">
          <CardTitle className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            Resultado del mes ({currency})
          </CardTitle>
          <CardDescription>Cobros menos gastos de este mes. No es el disponible.</CardDescription>
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

      <Card className="lg:col-span-2 border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Evolucion mensual</CardTitle>
              <CardDescription>Ingresos vs gastos de los ultimos 6 meses</CardDescription>
            </div>
            {hasUsd && (
              <div className="flex gap-1 shrink-0">
                {(['ARS', 'USD'] as Currency[]).map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={currency === item ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setCurrency(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
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
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [
                      formatCurrency(Number(value), currency),
                      name === 'ingresos' ? ' Ingresos' : ' Gastos',
                    ]}
                  />
                }
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
