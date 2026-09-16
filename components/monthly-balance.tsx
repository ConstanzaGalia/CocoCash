'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type {
  CardStatementPayment,
  Currency,
  FixedExpensePayment,
  MonthlyIncome,
  Transaction,
  Transfer,
} from '@/lib/types'
import { computeFlowForMonth } from '@/lib/budget-flow'
import { formatCurrency, shiftMonthKey } from '@/lib/utils'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface MonthlyBalanceProps {
  monthKey: string
  monthlyIncomes: MonthlyIncome[]
  payments: FixedExpensePayment[]
  cardPayments: CardStatementPayment[]
  transactions: Transaction[]
  transfers: Transfer[]
  savingsIds: Set<string>
}

function monthLabelFromKey(monthKey: string) {
  const month = Number(monthKey.slice(5, 7)) - 1
  return MONTH_LABELS[month] ?? monthKey
}

function buildSeries(
  endMonthKey: string,
  monthlyIncomes: MonthlyIncome[],
  payments: FixedExpensePayment[],
  cardPayments: CardStatementPayment[],
  transactions: Transaction[],
  transfers: Transfer[],
  savingsIds: Set<string>,
  currency: Currency,
) {
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    months.push(shiftMonthKey(endMonthKey, -i))
  }

  return months.map((key) => {
    const flow = computeFlowForMonth(
      key,
      monthlyIncomes,
      payments,
      transactions,
      transfers,
      savingsIds,
      cardPayments,
    )[currency]
    const ingresos = flow.income + flow.extra
    const gastos = flow.paidFixed + flow.variable
    return {
      mes: monthLabelFromKey(key),
      monthKey: key,
      ingresos,
      gastos,
      fijos: flow.paidFixed,
      variables: flow.variable,
      balance: ingresos - gastos,
    }
  })
}

export function MonthlyBalance({
  monthKey,
  monthlyIncomes,
  payments,
  cardPayments,
  transactions,
  transfers,
  savingsIds,
}: MonthlyBalanceProps) {
  const hasUsd = useMemo(() => {
    return (
      monthlyIncomes.some((item) => item.currency === 'USD') ||
      payments.some((item) => item.currency === 'USD') ||
      cardPayments.some((item) => item.currency === 'USD') ||
      transactions.some((tx) => tx.currency === 'USD')
    )
  }, [monthlyIncomes, payments, cardPayments, transactions])

  const [currency, setCurrency] = useState<Currency>('ARS')
  const data = useMemo(
    () =>
      buildSeries(
        monthKey,
        monthlyIncomes,
        payments,
        cardPayments,
        transactions,
        transfers,
        savingsIds,
        currency,
      ),
    [monthKey, monthlyIncomes, payments, cardPayments, transactions, transfers, savingsIds, currency],
  )
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
            ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20'
            : 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20'
        }
      >
        <CardHeader className="pb-2">
          <CardTitle className={`text-sm font-medium ${isPositive ? 'text-primary' : 'text-red-400'}`}>
            Resultado del mes ({currency})
          </CardTitle>
          <CardDescription>
            Cobros menos fijos pagos (incl. tarjetas) y variables. No es el disponible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${isPositive ? 'text-primary' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}
            {formatCurrency(netBalance, currency)}
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ingresos</span>
              <span className="font-medium text-primary">
                {formatCurrency(current.ingresos, currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gastos</span>
              <span className="font-medium text-red-400">
                {formatCurrency(current.gastos, currency)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>Fijos + tarjetas</span>
              <span>{formatCurrency(current.fijos, currency)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Variables</span>
              <span>{formatCurrency(current.variables, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Evolucion mensual</CardTitle>
              <CardDescription>
                Ingresos vs gastos (fijos, tarjetas y variables) · últimos 6 meses hasta el mes
                elegido
              </CardDescription>
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
