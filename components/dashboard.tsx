'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  PiggyBank,
  TrendingDown,
  FileText,
} from 'lucide-react'
import {
  useAccounts,
  useFixedExpensePayments,
  useFixedExpenses,
  useIncomeSources,
  useMonthlyIncomes,
  useTransactions,
  useTransfers,
  ensureSystemWallets,
} from '@/hooks/use-finance-data'
import { MonthlyBalance } from '@/components/monthly-balance'
import { MonthPicker } from '@/components/month-picker'
import { IncomeAmountDialog } from '@/components/income-sources-view'
import { useWallets } from '@/components/transfer-dialog'
import { computeFlowForMonth } from '@/lib/budget-flow'
import type { IncomeSource } from '@/lib/types'
import { cn, dateToMonthKey, formatCurrency, formatDueDateLabel, formatMonthLabel, toMonthKey } from '@/lib/utils'

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid gap-3 grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  )
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return isDesktop
}

function DualAmount({
  ars,
  usd,
  arsClassName,
  size = 'md',
}: {
  ars: number
  usd: number
  arsClassName?: string
  size?: 'sm' | 'md' | 'xl'
}) {
  const arsSize =
    size === 'xl' ? 'text-4xl md:text-5xl font-bold tracking-tight' : size === 'sm' ? 'font-semibold' : 'text-lg md:text-2xl font-bold'
  return (
    <div>
      <p className={cn(arsSize, arsClassName)}>{formatCurrency(ars)}</p>
      {usd !== 0 && (
        <p className={cn('text-muted-foreground', size === 'xl' ? 'text-sm mt-1' : 'text-xs mt-0.5')}>
          {formatCurrency(usd, 'USD')}
        </p>
      )}
    </div>
  )
}

export function Dashboard({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { accounts, isLoading: loadingAccounts } = useAccounts()
  const { transactions, isLoading: loadingTransactions } = useTransactions()
  const { fixedExpenses, isLoading: loadingFixed } = useFixedExpenses()
  const { payments, isLoading: loadingPayments } = useFixedExpensePayments()
  const { incomeSources, error: incomeError, isLoading: loadingSources } = useIncomeSources()
  const { monthlyIncomes, isLoading: loadingIncomes } = useMonthlyIncomes()
  const { transfers, isLoading: loadingTransfers } = useTransfers()
  const wallets = useWallets()
  const isDesktop = useIsDesktop()

  const [incomeSource, setIncomeSource] = useState<IncomeSource | null>(null)
  const currentMonthKey = toMonthKey()
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const isCurrentMonth = monthKey === currentMonthKey

  useEffect(() => {
    ensureSystemWallets().catch((error) => console.error('Error preparing wallets:', error))
  }, [])

  const isLoading =
    loadingAccounts ||
    loadingTransactions ||
    loadingFixed ||
    loadingPayments ||
    loadingSources ||
    loadingIncomes ||
    loadingTransfers

  const monthIncomes = useMemo(
    () => monthlyIncomes.filter((income) => income.month_key === monthKey),
    [monthlyIncomes, monthKey],
  )

  const cobrosBySource = useMemo(() => {
    const map = new Map<string, typeof monthIncomes>()
    for (const income of monthIncomes) {
      const list = map.get(income.income_source_id) ?? []
      list.push(income)
      map.set(income.income_source_id, list)
    }
    return map
  }, [monthIncomes])

  const monthPayments = useMemo(
    () => payments.filter((payment) => payment.month_key === monthKey),
    [payments, monthKey],
  )

  const linkedExpenseTxIds = useMemo(
    () => new Set(monthPayments.map((payment) => payment.transaction_id).filter(Boolean) as string[]),
    [monthPayments],
  )

  const monthTransactions = useMemo(
    () => transactions.filter((tx) => dateToMonthKey(tx.date) === monthKey),
    [transactions, monthKey],
  )

  const savingsIds = useMemo(
    () => new Set(accounts.filter((account) => account.kind === 'savings').map((account) => account.id)),
    [accounts],
  )

  const flow = useMemo(
    () =>
      computeFlowForMonth(monthKey, monthlyIncomes, payments, transactions, transfers, savingsIds),
    [monthKey, monthlyIncomes, payments, transactions, transfers, savingsIds],
  )

  const paidExpenseIds = new Set(monthPayments.map((payment) => payment.fixed_expense_id))
  const pendingFixed = fixedExpenses.filter((expense) => !paidExpenseIds.has(expense.id))
  const pendingFixedArs = pendingFixed
    .filter((expense) => expense.currency === 'ARS')
    .reduce((sum, expense) => sum + Number(expense.amount), 0)
  const pendingFixedUsd = pendingFixed
    .filter((expense) => expense.currency === 'USD')
    .reduce((sum, expense) => sum + Number(expense.amount), 0)
  const fixedProgress =
    fixedExpenses.length === 0
      ? 0
      : Math.round(((fixedExpenses.length - pendingFixed.length) / fixedExpenses.length) * 100)

  const recentVariables = monthTransactions
    .filter((tx) => tx.type === 'expense' && !linkedExpenseTxIds.has(tx.id))
    .slice(0, 5)

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Balance</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {isCurrentMonth
              ? 'Cobros, gastos y ahorros de este mes.'
              : `Cobros, gastos y ahorros de ${formatMonthLabel(monthKey)}.`}
          </p>
          {!isCurrentMonth && (
            <button
              type="button"
              className="mt-1 text-xs text-emerald-400 hover:underline"
              onClick={() => setMonthKey(currentMonthKey)}
            >
              Volver al mes actual
            </button>
          )}
        </div>
        <MonthPicker value={monthKey} onChange={setMonthKey} />
      </div>

      {incomeError && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-4 text-sm text-amber-200">
            Para ingresos, ahorros y traspasos hay que ejecutar en Supabase los scripts{' '}
            <code className="text-xs">scripts/004_budget_flow.sql</code> y{' '}
            <code className="text-xs">scripts/006_multiple_incomes.sql</code>.
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-none md:shadow-sm bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/20">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground capitalize">
                {isCurrentMonth ? 'Este mes' : formatMonthLabel(monthKey)}
              </p>
              <p
                className={cn(
                  'text-4xl md:text-5xl font-bold tracking-tight',
                  flow.ARS.leftover >= 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {formatCurrency(flow.ARS.leftover)}
              </p>
              {flow.USD.income !== 0 || flow.USD.paidFixed !== 0 || flow.USD.variable !== 0 || flow.USD.saved !== 0 ? (
                <p className="text-sm text-muted-foreground mt-1">
                  En dólares:{' '}
                  <span className={flow.USD.leftover >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {formatCurrency(flow.USD.leftover, 'USD')}
                  </span>
                </p>
              ) : null}
            </div>
            {isCurrentMonth ? (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => onNavigate?.('savings')}
              >
                <PiggyBank className="h-4 w-4 mr-1" />
                Ahorros
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Cobros del mes, menos gastos y lo que pasaste a ahorros.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Ingresos</p>
              <DualAmount ars={flow.ARS.income} usd={flow.USD.income} arsClassName="text-emerald-400" size="sm" />
            </div>
            <div>
              <p className="text-muted-foreground">Gastos fijos</p>
              <DualAmount ars={flow.ARS.paidFixed} usd={flow.USD.paidFixed} arsClassName="text-red-400" size="sm" />
            </div>
            <div>
              <p className="text-muted-foreground">Variables</p>
              <DualAmount ars={flow.ARS.variable} usd={flow.USD.variable} arsClassName="text-red-400" size="sm" />
            </div>
            <div>
              <p className="text-muted-foreground">A ahorros</p>
              <DualAmount ars={flow.ARS.saved} usd={flow.USD.saved} arsClassName="text-blue-400" size="sm" />
            </div>
          </div>
          {(flow.ARS.extra !== 0 || flow.USD.extra !== 0) && (
            <p className="text-xs text-amber-400">
              Hay {formatCurrency(flow.ARS.extra)}
              {flow.USD.extra !== 0 ? ` y ${formatCurrency(flow.USD.extra, 'USD')}` : ''} en
              movimientos viejos que no son cobros. No entran acá:{' '}
              <button
                type="button"
                onClick={() => onNavigate?.('transactions')}
                className="underline underline-offset-2"
              >
                revisalos en Movimientos
              </button>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => onNavigate?.('savings')}
        className="grid grid-cols-2 gap-3 w-full text-left"
      >
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-5 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <PiggyBank className="h-3.5 w-3.5 text-blue-400" />
              Ahorros ARS
            </p>
            <p className="text-xl md:text-2xl font-bold text-blue-400">
              {formatCurrency(wallets.savingsArs)}
            </p>
            <p className="text-xs text-blue-400/80">Ver cuentas y traspasar</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-5 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <PiggyBank className="h-3.5 w-3.5 text-blue-400" />
              Ahorros USD
            </p>
            <p className="text-xl md:text-2xl font-bold text-blue-400">
              {formatCurrency(wallets.savingsUsd, 'USD')}
            </p>
            <p className="text-xs text-blue-400/80">Ver cuentas y traspasar</p>
          </CardContent>
        </Card>
      </button>

      <div>
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold capitalize">Ingresos de {formatMonthLabel(monthKey)}</h2>
        </div>
        {incomeSources.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-card/40">
            <CardContent className="py-6 text-sm text-muted-foreground space-y-3">
              <p>Configurá tus fuentes de ingreso (trabajo, profesión, extra, etc.).</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate?.('income')}
                className="bg-emerald-500/10 border-emerald-500/30"
              >
                Agregar fuentes
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x md:grid md:grid-cols-3 md:overflow-visible">
            {incomeSources.map((source) => {
              const cobros = cobrosBySource.get(source.id) ?? []
              const total = cobros.reduce((sum, income) => sum + Number(income.amount), 0)
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setIncomeSource(source)}
                  className="min-w-[70%] snap-start rounded-xl border border-border/50 bg-card/50 p-4 text-left md:min-w-0"
                >
                  <p className="text-sm text-muted-foreground truncate">
                    {source.name} · {source.currency}
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(total, source.currency)}
                  </p>
                  <p className="text-xs text-emerald-400 mt-2">
                    {cobros.length === 0
                      ? 'Agregar cobro'
                      : `${cobros.length} cobro${cobros.length === 1 ? '' : 's'} · sumar otro`}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Variables</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <DualAmount ars={flow.ARS.variable} usd={flow.USD.variable} arsClassName="text-red-400" />
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Fijos pendientes
            </CardTitle>
            <FileText className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            <DualAmount ars={pendingFixedArs} usd={pendingFixedUsd} />
            <Progress value={fixedProgress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              {pendingFixed.length} por pagar · {fixedProgress}%
            </p>
          </CardContent>
        </Card>
      </div>

      {isDesktop ? <MonthlyBalance transactions={transactions} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-500" />
              {isCurrentMonth ? 'Gastos fijos pendientes' : 'Fijos sin pagar'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingFixed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos los fijos de este mes están pagos</p>
            ) : (
              pendingFixed.slice(0, 6).map((expense) => (
                <div key={expense.id} className="flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{expense.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence {formatDueDateLabel(expense.due_day, monthKey)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-purple-400 shrink-0">
                    {formatCurrency(Number(expense.amount), expense.currency)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-400" />
              {isCurrentMonth ? 'Gastos del día' : 'Gastos variables'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentVariables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isCurrentMonth
                  ? 'Todavía no hay gastos variables. Usá el botón + para anotar uno al toque.'
                  : 'No hay gastos variables en este mes.'}
              </p>
            ) : (
              recentVariables.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || tx.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-400 shrink-0">
                    -{formatCurrency(Number(tx.amount), tx.currency)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <IncomeAmountDialog
        open={Boolean(incomeSource)}
        onOpenChange={(open) => {
          if (!open) setIncomeSource(null)
        }}
        source={incomeSource}
        monthKey={monthKey}
      />
    </div>
  )
}
