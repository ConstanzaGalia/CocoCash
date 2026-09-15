'use client'

import { useMemo, useState } from 'react'
import {
  useFixedExpensePayments,
  useFixedExpenses,
  useTransactions,
} from '@/hooks/use-finance-data'
import type { Currency, FixedExpense, FixedExpensePayment, Transaction } from '@/lib/types'
import {
  dateToMonthKey,
  formatCurrency,
  formatMonthLabel,
  shiftMonthKey,
  toMonthKey,
  cn,
} from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'

type PieScope = 'variable' | 'fixed' | 'all'
type RangeId = '3' | '6' | 'year' | '12'

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const PIE_COLORS = [
  '#34d399',
  '#f87171',
  '#60a5fa',
  '#c084fc',
  '#fbbf24',
  '#fb7185',
  '#22d3ee',
  '#a3e635',
  '#fb923c',
  '#818cf8',
]

const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: '3', label: '3 meses' },
  { id: '6', label: '6 meses' },
  { id: 'year', label: 'Este año' },
  { id: '12', label: '12 meses' },
]

function shortMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-')
  return `${MONTH_SHORT[Number(month) - 1]} ${year.slice(2)}`
}

function compactAxis(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`
  return `${value}`
}

function monthsForRange(endKey: string, range: RangeId) {
  if (range === 'year') {
    const year = endKey.slice(0, 4)
    const endMonth = Number(endKey.slice(5, 7))
    return Array.from({ length: endMonth }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
  }
  const count = range === '3' ? 3 : range === '6' ? 6 : 12
  return Array.from({ length: count }, (_, index) => shiftMonthKey(endKey, index - (count - 1)))
}

function rangeLabel(endKey: string, range: RangeId) {
  const months = monthsForRange(endKey, range)
  if (months.length === 1) return formatMonthLabel(months[0])
  return `${shortMonthLabel(months[0])} – ${shortMonthLabel(months[months.length - 1])}`
}

function paymentTxIds(payments: FixedExpensePayment[]) {
  return new Set(payments.map((payment) => payment.transaction_id).filter(Boolean) as string[])
}

function variableExpenses(
  transactions: Transaction[],
  payments: FixedExpensePayment[],
  monthKey: string,
  currency: Currency,
) {
  const linked = paymentTxIds(payments)
  return transactions.filter(
    (tx) =>
      tx.type === 'expense' &&
      tx.currency === currency &&
      dateToMonthKey(tx.date) === monthKey &&
      !linked.has(tx.id),
  )
}

function paidFixedTotal(payments: FixedExpensePayment[], monthKey: string, currency: Currency) {
  return payments
    .filter((payment) => payment.month_key === monthKey && payment.currency === currency)
    .reduce((sum, payment) => sum + Number(payment.amount_paid), 0)
}

function groupByCategory(rows: { category: string; amount: number }[]) {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = row.category.trim() || 'Otros'
    map.set(key, (map.get(key) ?? 0) + row.amount)
  }
  const sorted = [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  if (sorted.length <= 7) return sorted
  const head = sorted.slice(0, 6)
  const other = sorted.slice(6).reduce((sum, item) => sum + item.value, 0)
  return [...head, { name: 'Otros', value: other }]
}

function expensesInRange(
  fixedExpenses: FixedExpense[],
  payments: FixedExpensePayment[],
  months: string[],
  currency: Currency,
) {
  const monthSet = new Set(months)
  const byId = new Map(fixedExpenses.map((expense) => [expense.id, expense]))
  const ids = new Set<string>()
  for (const expense of fixedExpenses) {
    if (expense.currency === currency) ids.add(expense.id)
  }
  for (const payment of payments) {
    if (payment.currency !== currency || !monthSet.has(payment.month_key)) continue
    ids.add(payment.fixed_expense_id)
  }
  return [...ids].map((id) => {
    const expense = byId.get(id)
    return {
      id,
      name: expense?.name || 'Gasto eliminado',
      category: expense?.category || 'Otros',
    }
  })
}

function amountForExpense(
  payments: FixedExpensePayment[],
  expenseId: string,
  monthKey: string,
  currency: Currency,
) {
  return payments
    .filter(
      (payment) =>
        payment.fixed_expense_id === expenseId &&
        payment.month_key === monthKey &&
        payment.currency === currency,
    )
    .reduce((sum, payment) => sum + Number(payment.amount_paid), 0)
}

export function ComparativesView() {
  const { transactions, isLoading: loadingTx } = useTransactions()
  const { payments, isLoading: loadingPayments } = useFixedExpensePayments()
  const { fixedExpenses, isLoading: loadingFixed } = useFixedExpenses()
  const monthKey = toMonthKey()
  const [range, setRange] = useState<RangeId>('6')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [pieScope, setPieScope] = useState<PieScope>('variable')
  const [expenseId, setExpenseId] = useState('all')

  const hasUsd = useMemo(
    () =>
      transactions.some((tx) => tx.currency === 'USD') ||
      payments.some((payment) => payment.currency === 'USD'),
    [transactions, payments],
  )

  const months = useMemo(() => monthsForRange(monthKey, range), [monthKey, range])

  const series = useMemo(
    () =>
      months.map((key) => {
        const fijos = paidFixedTotal(payments, key, currency)
        const variables = variableExpenses(transactions, payments, key, currency).reduce(
          (sum, tx) => sum + Number(tx.amount),
          0,
        )
        return {
          mes: shortMonthLabel(key),
          monthKey: key,
          fijos,
          variables,
          total: fijos + variables,
        }
      }),
    [months, payments, transactions, currency],
  )

  const breakdownExpenses = useMemo(
    () => expensesInRange(fixedExpenses, payments, months, currency),
    [fixedExpenses, payments, months, currency],
  )

  const selectedExpense = breakdownExpenses.find((expense) => expense.id === expenseId) ?? null

  const breakdownSeries = useMemo(() => {
    const ranked = breakdownExpenses
      .map((expense) => ({
        ...expense,
        total: months.reduce((sum, key) => sum + amountForExpense(payments, expense.id, key, currency), 0),
      }))
      .sort((a, b) => b.total - a.total)

    if (expenseId !== 'all' && selectedExpense) {
      return months.map((key) => ({
        mes: shortMonthLabel(key),
        monthKey: key,
        monto: amountForExpense(payments, selectedExpense.id, key, currency),
      }))
    }

    const head = ranked.filter((expense) => expense.total > 0).slice(0, 6)
    const rest = ranked.filter((expense) => expense.total > 0).slice(6)
    return months.map((key) => {
      const row: Record<string, string | number> = { mes: shortMonthLabel(key), monthKey: key }
      for (const expense of head) {
        row[expense.id] = amountForExpense(payments, expense.id, key, currency)
      }
      row.otros = rest.reduce((sum, expense) => sum + amountForExpense(payments, expense.id, key, currency), 0)
      return row
    })
  }, [breakdownExpenses, months, payments, currency, expenseId, selectedExpense])

  const stackedKeys = useMemo(() => {
    if (expenseId !== 'all') return []
    const ranked = breakdownExpenses
      .map((expense) => ({
        ...expense,
        total: months.reduce((sum, key) => sum + amountForExpense(payments, expense.id, key, currency), 0),
      }))
      .filter((expense) => expense.total > 0)
      .sort((a, b) => b.total - a.total)
    const head = ranked.slice(0, 6)
    const hasOtros = ranked.length > 6
    return [
      ...head.map((expense, index) => ({
        key: expense.id,
        label: expense.name,
        color: PIE_COLORS[index % PIE_COLORS.length],
      })),
      ...(hasOtros ? [{ key: 'otros', label: 'Otros', color: '#64748b' }] : []),
    ]
  }, [breakdownExpenses, months, payments, currency, expenseId])

  const stackedConfig = Object.fromEntries(
    stackedKeys.map((item) => [item.key, { label: item.label, color: item.color }]),
  )

  const singleConfig = {
    monto: { label: selectedExpense?.name || 'Monto', color: '#c084fc' },
  }

  const tableRows = useMemo(() => {
    return breakdownExpenses
      .map((expense) => {
        const byMonth = months.map((key) => amountForExpense(payments, expense.id, key, currency))
        const total = byMonth.reduce((sum, value) => sum + value, 0)
        const withValue = byMonth.map((value, index) => ({ value, index })).filter((item) => item.value > 0)
        const first = withValue[0]
        const last = withValue[withValue.length - 1]
        const delta =
          first && last && first.index !== last.index && first.value > 0
            ? ((last.value - first.value) / first.value) * 100
            : null
        return { ...expense, byMonth, total, delta }
      })
      .filter((row) => row.total > 0)
      .filter((row) => expenseId === 'all' || row.id === expenseId)
      .sort((a, b) => b.total - a.total)
  }, [breakdownExpenses, months, payments, currency, expenseId])

  const monthFijos = paidFixedTotal(payments, monthKey, currency)
  const monthVariables = variableExpenses(transactions, payments, monthKey, currency).reduce(
    (sum, tx) => sum + Number(tx.amount),
    0,
  )

  const pieRows = useMemo(() => {
    const expenseById = new Map(fixedExpenses.map((expense) => [expense.id, expense]))
    const fixedRows = payments
      .filter((payment) => payment.month_key === monthKey && payment.currency === currency)
      .map((payment) => ({
        category: expenseById.get(payment.fixed_expense_id)?.category || 'Fijos',
        amount: Number(payment.amount_paid),
      }))
    const variableRows = variableExpenses(transactions, payments, monthKey, currency).map((tx) => ({
      category: tx.category || 'Otros',
      amount: Number(tx.amount),
    }))
    const rows =
      pieScope === 'fixed' ? fixedRows : pieScope === 'variable' ? variableRows : [...fixedRows, ...variableRows]
    return groupByCategory(rows)
  }, [fixedExpenses, payments, transactions, monthKey, currency, pieScope])

  const pieTotal = pieRows.reduce((sum, item) => sum + item.value, 0)
  const pieConfig = Object.fromEntries(
    pieRows.map((item, index) => [
      item.name,
      { label: item.name, color: PIE_COLORS[index % PIE_COLORS.length] },
    ]),
  )

  const barConfig = {
    fijos: { label: 'Fijos', color: '#c084fc' },
    variables: { label: 'Variables', color: '#f87171' },
  }

  if (loadingTx || loadingPayments || loadingFixed) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Comparativas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desglose de fijos y variables en el rango que elijas.
          </p>
        </div>
        {hasUsd && (
          <div className="flex gap-1">
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

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {RANGE_OPTIONS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={range === item.id ? 'default' : 'outline'}
            size="sm"
            className="h-8 shrink-0"
            onClick={() => setRange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SummaryCard title="Gastos fijos" amount={monthFijos} currency={currency} amountClassName="text-purple-400" />
        <SummaryCard title="Variables" amount={monthVariables} currency={currency} amountClassName="text-red-400" />
        <SummaryCard
          title="Total gastado"
          amount={monthFijos + monthVariables}
          currency={currency}
          className="col-span-2 md:col-span-1"
        />
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fijos vs variables</CardTitle>
          <CardDescription>{rangeLabel(monthKey, range)}</CardDescription>
        </CardHeader>
        <CardContent>
          {series.every((item) => item.total === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay gastos en estos meses.
            </p>
          ) : (
            <ChartContainer config={barConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={series} accessibilityLayer barGap={4}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="monthKey"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={months.length > 6 ? 1 : 0}
                  tickFormatter={shortMonthLabel}
                />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={compactAxis} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [
                        formatCurrency(Number(value), currency),
                        name === 'fijos' ? ' Fijos' : ' Variables',
                      ]}
                    />
                  }
                />
                <Bar id="bar-fijos" name="fijos" dataKey="fijos" fill="var(--color-fijos)" maxBarSize={36} />
                <Bar id="bar-variables" name="variables" dataKey="variables" fill="var(--color-variables)" maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Desglose de fijos</CardTitle>
              <CardDescription>
                Cómo se movió cada gasto · {rangeLabel(monthKey, range)}
              </CardDescription>
            </div>
            <Select
              value={breakdownExpenses.some((expense) => expense.id === expenseId) ? expenseId : 'all'}
              onValueChange={setExpenseId}
            >
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Elegí un gasto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los fijos</SelectItem>
                {breakdownExpenses.map((expense) => (
                  <SelectItem key={expense.id} value={expense.id}>
                    {expense.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tableRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay fijos pagos en este rango.
            </p>
          ) : expenseId !== 'all' && selectedExpense ? (
            <ChartContainer config={singleConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={breakdownSeries} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="monthKey"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={months.length > 6 ? 1 : 0}
                  tickFormatter={shortMonthLabel}
                />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={compactAxis} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [formatCurrency(Number(value), currency), ` ${selectedExpense.name}`]}
                    />
                  }
                />
                <Bar id="bar-monto" name="monto" dataKey="monto" fill="var(--color-monto)" maxBarSize={48} />
              </BarChart>
            </ChartContainer>
          ) : (
            <ChartContainer config={stackedConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={breakdownSeries} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="monthKey"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={months.length > 6 ? 1 : 0}
                  tickFormatter={shortMonthLabel}
                />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={compactAxis} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        const label = stackedKeys.find((item) => item.key === name)?.label || name
                        return [formatCurrency(Number(value), currency), ` ${label}`]
                      }}
                    />
                  }
                />
                {stackedKeys.map((item) => (
                  <Bar key={item.key} id={`bar-${item.key}`} name={item.key} dataKey={item.key} stackId="fijos" fill={item.color} />
                ))}
              </BarChart>
            </ChartContainer>
          )}

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Gasto</th>
                  {months.map((key) => (
                    <th key={key} className="py-2 px-1 font-medium text-right whitespace-nowrap">
                      {shortMonthLabel(key)}
                    </th>
                  ))}
                  <th className="py-2 pl-3 font-medium text-right">Total</th>
                  <th className="py-2 pl-3 font-medium text-right">Var.</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.id} className="border-t border-border/40">
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="text-left font-medium hover:text-primary"
                        onClick={() => setExpenseId(row.id === expenseId ? 'all' : row.id)}
                      >
                        {row.name}
                      </button>
                      <p className="text-[11px] text-muted-foreground">{row.category}</p>
                    </td>
                    {row.byMonth.map((value, index) => (
                      <td key={months[index]} className="py-2 px-1 text-right tabular-nums whitespace-nowrap">
                        {value ? formatCurrency(value, currency) : '—'}
                      </td>
                    ))}
                    <td className="py-2 pl-3 text-right tabular-nums font-medium whitespace-nowrap">
                      {formatCurrency(row.total, currency)}
                    </td>
                    <td
                      className={cn(
                        'py-2 pl-3 text-right tabular-nums whitespace-nowrap',
                        row.delta == null
                          ? 'text-muted-foreground'
                          : row.delta > 0
                            ? 'text-red-400'
                            : row.delta < 0
                              ? 'text-primary'
                              : 'text-muted-foreground',
                      )}
                    >
                      {row.delta == null
                        ? '—'
                        : `${row.delta > 0 ? '+' : ''}${Math.round(row.delta)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base capitalize">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Categorías · este mes
              </CardTitle>
              <CardDescription>Cómo se reparte lo gastado este mes</CardDescription>
            </div>
            <div className="flex gap-1">
              {(
                [
                  { id: 'variable', label: 'Variables' },
                  { id: 'fixed', label: 'Fijos' },
                  { id: 'all', label: 'Todo' },
                ] as const
              ).map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={pieScope === item.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPieScope(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pieTotal === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay gastos de este tipo este mes.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 md:items-center">
              <ChartContainer config={pieConfig} className="mx-auto aspect-square h-[220px] w-full max-w-[260px]">
                <PieChart>
                  <Pie data={pieRows} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} paddingAngle={2}>
                    {pieRows.map((item, index) => (
                      <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [formatCurrency(Number(value), currency), ` ${name}`]}
                      />
                    }
                  />
                </PieChart>
              </ChartContainer>
              <ul className="space-y-2">
                {pieRows.map((item, index) => {
                  const pct = pieTotal === 0 ? 0 : Math.round((item.value / pieTotal) * 100)
                  return (
                    <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {pct}% · {formatCurrency(item.value, currency)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title,
  amount,
  currency,
  className,
  amountClassName,
}: {
  title: string
  amount: number
  currency: Currency
  className?: string
  amountClassName?: string
}) {
  return (
    <Card className={cn('border-border/50 bg-card/50', className)}>
      <CardContent className="pt-5 space-y-1">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className={cn('text-xl font-bold md:text-2xl', amountClassName)}>{formatCurrency(amount, currency)}</p>
      </CardContent>
    </Card>
  )
}
