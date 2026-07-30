'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, TrendingUp, TrendingDown, CreditCard, CalendarCheck, FileText } from 'lucide-react'
import { useAccounts, useSubscriptions, useCreditCards, useTransactions, useFixedExpenses, useFixedExpensePayments } from '@/hooks/use-finance-data'
import { MonthlyBalance } from '@/components/monthly-balance'
import { cn, toMonthKey, formatDueDateLabel } from '@/lib/utils'

function formatCurrency(amount: number, currency: string = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function Dashboard() {
  const { accounts, isLoading: loadingAccounts } = useAccounts()
  const { subscriptions, isLoading: loadingSubscriptions } = useSubscriptions()
  const { creditCards, isLoading: loadingCards } = useCreditCards()
  const { transactions, isLoading: loadingTransactions } = useTransactions()
  const { fixedExpenses, isLoading: loadingFixed } = useFixedExpenses()
  const { payments, isLoading: loadingPayments } = useFixedExpensePayments()

  const isLoading = loadingAccounts || loadingSubscriptions || loadingCards || loadingTransactions || loadingFixed || loadingPayments

  if (isLoading) {
    return <LoadingSkeleton />
  }

  // Calcular totales
  const totalARS = accounts.filter(a => a.currency === 'ARS').reduce((sum, a) => sum + Number(a.balance), 0)
  const totalUSD = accounts.filter(a => a.currency === 'USD').reduce((sum, a) => sum + Number(a.balance), 0)

  // Transacciones del mes actual
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthKey = toMonthKey()
  const monthTransactions = transactions.filter(t => {
    const date = new Date(t.date)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })

  const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
  const monthExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)

  // Suscripciones pendientes
  const pendingSubscriptions = subscriptions.filter(s => !s.is_paid)
  const totalPendingSubs = pendingSubscriptions.reduce((sum, s) => sum + Number(s.amount), 0)

  // Gastos fijos pendientes (sin pago registrado este mes)
  const paidExpenseIds = new Set(
    payments.filter((p) => p.month_key === monthKey).map((p) => p.fixed_expense_id),
  )
  const pendingFixed = fixedExpenses.filter((f) => !paidExpenseIds.has(f.id))
  const totalPendingFixed = pendingFixed.reduce((sum, f) => sum + Number(f.amount), 0)
  const fixedProgress =
    fixedExpenses.length === 0
      ? 0
      : Math.round(((fixedExpenses.length - pendingFixed.length) / fixedExpenses.length) * 100)

  // Total consumido en tarjetas
  const totalCardBalance = creditCards.reduce((sum, c) => sum + Number(c.current_balance), 0)
  const totalCardLimit = creditCards.reduce((sum, c) => sum + Number(c.credit_limit), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de tus finanzas personales</p>
      </div>

      {/* Balance Total */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400">Balance Total ARS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">{formatCurrency(totalARS)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts.filter(a => a.currency === 'ARS').length} cuentas en pesos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-400">Balance Total USD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{formatCurrency(totalUSD, 'USD')}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts.filter(a => a.currency === 'USD').length} cuentas en dolares
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Mensual - Ingresos vs Gastos */}
      <MonthlyBalance transactions={transactions} currency="ARS" />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos del mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(monthIncome)}</div>
            <p className="text-xs text-muted-foreground">{monthTransactions.filter(t => t.type === 'income').length} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gastos del mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{formatCurrency(monthExpenses)}</div>
            <p className="text-xs text-muted-foreground">{monthTransactions.filter(t => t.type === 'expense').length} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Suscripciones pendientes</CardTitle>
            <CalendarCheck className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPendingSubs)}</div>
            <p className="text-xs text-muted-foreground">{pendingSubscriptions.length} por pagar</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gastos fijos pendientes</CardTitle>
            <FileText className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPendingFixed)}</div>
            <p className="text-xs text-muted-foreground">
              {pendingFixed.length} por pagar · {fixedProgress}% del mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Cuentas */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" />
              Cuentas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay cuentas registradas</p>
            ) : (
              accounts.slice(0, 4).map((account) => (
                <div key={account.id} className="flex justify-between items-center">
                  <span className="text-sm text-foreground">{account.name}</span>
                  <span className={cn(
                    'text-sm font-medium',
                    Number(account.balance) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {formatCurrency(Number(account.balance), account.currency)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Gastos Fijos Pendientes */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-500" />
              Gastos Fijos Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingFixed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos los gastos fijos estan pagados</p>
            ) : (
              pendingFixed.slice(0, 4).map((expense) => (
                <div key={expense.id} className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-foreground">{expense.name}</span>
                    <p className="text-xs text-muted-foreground">
                      Vence {formatDueDateLabel(expense.due_day, monthKey)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-purple-400">
                    {formatCurrency(Number(expense.amount), expense.currency)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Tarjetas de Credito */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              Tarjetas de Credito
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creditCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay tarjetas registradas</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(totalCardBalance)}</div>
                  <p className="text-xs text-muted-foreground">
                    de {formatCurrency(totalCardLimit)} limite total
                  </p>
                </div>
                {totalCardLimit > 0 && (
                  <div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all" 
                        style={{ width: `${Math.min((totalCardBalance / totalCardLimit) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((totalCardBalance / totalCardLimit) * 100).toFixed(0)}% utilizado
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ultimas Transacciones */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Ultimas transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay transacciones registradas</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === 'income' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                    }`}>
                      {tx.type === 'income' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.description || tx.category}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString('es-AR')}</p>
                    </div>
                  </div>
                  <span className={`font-semibold ${tx.type === 'income' ? 'text-emerald-500' : 'text-red-400'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount), tx.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
