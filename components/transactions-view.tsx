'use client'

import { useMemo, useState } from 'react'
import {
  deleteTransaction,
  deleteTransfer,
  getWallet,
  updateIncomeCobro,
  updateTransaction,
  useAccounts,
  useIncomeSources,
  useMonthlyIncomes,
  useTransactions,
  useTransfers,
  walletName,
} from '@/hooks/use-finance-data'
import type { Transaction, Transfer } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import { CategoryPicker, mergeCategories } from '@/components/category-picker'
import { cn, dateToMonthKey, formatCurrency, formatMonthLabel, toMonthKey } from '@/lib/utils'
import { MonthPicker } from '@/components/month-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Trash2, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type Filter = 'all' | 'income' | 'expense' | 'transfer'

type CashItem =
  | { kind: 'tx'; id: string; date: string; tx: Transaction }
  | { kind: 'transfer'; id: string; date: string; transfer: Transfer }

interface ExpenseFormData {
  amount: string
  category: string
  date: string
  description: string
  currency: 'ARS' | 'USD'
}

interface IncomeFormData {
  amount: string
  income_source_id: string
  date: string
  description: string
}

const initialExpenseForm: ExpenseFormData = {
  amount: '',
  category: 'Comida',
  date: new Date().toISOString().split('T')[0],
  description: '',
  currency: 'ARS',
}

const initialIncomeForm: IncomeFormData = {
  amount: '',
  income_source_id: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
}

export function TransactionsView() {
  const { transactions, isLoading: loadingTx } = useTransactions()
  const { transfers, isLoading: loadingTransfers } = useTransfers()
  const { accounts } = useAccounts()
  const { incomeSources } = useIncomeSources()
  const { monthlyIncomes } = useMonthlyIncomes()
  const [filter, setFilter] = useState<Filter>('all')
  const currentMonthKey = toMonthKey()
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const isCurrentMonth = monthKey === currentMonthKey
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null)
  const [editingIncome, setEditingIncome] = useState<Transaction | null>(null)
  const [expenseForm, setExpenseForm] = useState<ExpenseFormData>(initialExpenseForm)
  const [incomeForm, setIncomeForm] = useState<IncomeFormData>(initialIncomeForm)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ type: 'tx' | 'transfer'; id: string } | null>(null)

  const activeSources = useMemo(
    () => incomeSources.filter((source) => source.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [incomeSources],
  )

  const selectedIncomeSource = activeSources.find((s) => s.id === incomeForm.income_source_id)
    || incomeSources.find((s) => s.id === incomeForm.income_source_id)

  const accountName = (id: string) => {
    const account = accounts.find((item) => item.id === id)
    if (!account) return 'Bolsillo'
    return walletName(account.kind || 'available', account.currency)
  }

  const sourceNameForTx = (tx: Transaction) => {
    const cobro = monthlyIncomes.find((income) => income.transaction_id === tx.id)
    if (cobro) {
      const source = incomeSources.find((item) => item.id === cobro.income_source_id)
      if (source) return source.name
    }
    return tx.category
  }

  const items = useMemo<CashItem[]>(() => {
    const txItems: CashItem[] = transactions.map((tx) => ({
      kind: 'tx',
      id: tx.id,
      date: tx.date,
      tx,
    }))
    const transferItems: CashItem[] = transfers.map((transfer) => ({
      kind: 'transfer',
      id: transfer.id,
      date: transfer.date,
      transfer,
    }))
    return [...txItems, ...transferItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }, [transactions, transfers])

  const monthItems = items.filter((item) => dateToMonthKey(item.date) === monthKey)

  const filtered = monthItems.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'transfer') return item.kind === 'transfer'
    return item.kind === 'tx' && item.tx.type === filter
  })

  const categoryOptions = mergeCategories(
    CATEGORIES.expense,
    transactions.filter((tx) => tx.type === 'expense').map((tx) => tx.category),
  )

  const handleOpenEdit = (tx: Transaction) => {
    setSaveError(null)
    if (tx.type === 'income') {
      const cobro = monthlyIncomes.find((income) => income.transaction_id === tx.id)
      const matchedByName = incomeSources.find(
        (source) => source.name === tx.category && source.currency === tx.currency,
      )
      const sourceId = cobro?.income_source_id || matchedByName?.id || activeSources[0]?.id || ''
      const note =
        tx.description && tx.description !== tx.category ? tx.description : ''
      setEditingIncome(tx)
      setIncomeForm({
        amount: tx.amount.toString(),
        income_source_id: sourceId,
        date: tx.date.split('T')[0],
        description: note,
      })
      return
    }

    setEditingExpense(tx)
    setExpenseForm({
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date.split('T')[0],
      description: tx.description || '',
      currency: tx.currency,
    })
  }

  const handleSubmitExpense = async () => {
    if (!editingExpense) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const wallet = await getWallet('available', expenseForm.currency)
      await updateTransaction(editingExpense.id, {
        amount: parseFloat(expenseForm.amount) || 0,
        category: expenseForm.category,
        date: expenseForm.date,
        description: expenseForm.description || null,
        currency: expenseForm.currency,
        type: 'expense',
        account_id: wallet.id,
      })
      setEditingExpense(null)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmitIncome = async () => {
    if (!editingIncome || !incomeForm.income_source_id) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateIncomeCobro(editingIncome.id, {
        income_source_id: incomeForm.income_source_id,
        amount: parseFloat(incomeForm.amount.replace(',', '.')) || 0,
        date: incomeForm.date,
        description: incomeForm.description.trim() || null,
      })
      setEditingIncome(null)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el cobro')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      if (deleting.type === 'tx') await deleteTransaction(deleting.id)
      else await deleteTransfer(deleting.id)
      setDeleting(null)
    } catch (error) {
      console.error('Error deleting movement:', error)
    }
  }

  if (loadingTx || loadingTransfers) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Movimientos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCurrentMonth
              ? 'Flujo de caja: cobros, gastos y traspasos. Cargá uno nuevo con el botón +.'
              : `Cobros, gastos y traspasos de ${formatMonthLabel(monthKey)}.`}
          </p>
          {!isCurrentMonth && (
            <button
              type="button"
              className="mt-1 text-xs text-primary hover:underline"
              onClick={() => setMonthKey(currentMonthKey)}
            >
              Volver al mes actual
            </button>
          )}
        </div>
        <MonthPicker value={monthKey} onChange={setMonthKey} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(
          [
            { id: 'all', label: 'Todos' },
            { id: 'income', label: 'Entradas' },
            { id: 'expense', label: 'Salidas' },
            { id: 'transfer', label: 'Traspasos' },
          ] as const
        ).map((item) => (
          <Button
            key={item.id}
            variant={filter === item.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(item.id)}
            className={
              filter === item.id && item.id === 'income'
                ? 'bg-primary hover:bg-primary/90'
                : filter === item.id && item.id === 'expense'
                  ? 'bg-red-500 hover:bg-red-600'
                  : undefined
            }
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base capitalize">
            Flujo de caja · {isCurrentMonth ? 'este mes' : formatMonthLabel(monthKey)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {monthItems.length === 0
                ? isCurrentMonth
                  ? 'Todavía no hay movimientos. Usá el + para un cobro o un gasto.'
                  : `No hay movimientos en ${formatMonthLabel(monthKey)}.`
                : 'No hay movimientos con este filtro.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                if (item.kind === 'transfer') {
                  const { transfer } = item
                  const isFx = transfer.currency !== transfer.to_currency
                  return (
                    <div
                      key={`tr-${item.id}`}
                      className="rounded-xl border border-border/50 bg-background/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4 shrink-0 text-blue-400" />
                            <p className="font-medium truncate">
                              {accountName(transfer.from_account_id)} → {accountName(transfer.to_account_id)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Traspaso · {format(new Date(transfer.date), 'dd MMM yyyy', { locale: es })}
                            {transfer.notes ? ` · ${transfer.notes}` : ''}
                          </p>
                        </div>
                        <p className="text-sm font-bold shrink-0 text-blue-400 text-right">
                          -{formatCurrency(Number(transfer.amount), transfer.currency)}
                          {isFx && (
                            <>
                              <br />
                              +{formatCurrency(Number(transfer.to_amount), transfer.to_currency)}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting({ type: 'transfer', id: transfer.id })}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                }

                const { tx } = item
                const isIncome = tx.type === 'income'
                const label = isIncome ? sourceNameForTx(tx) : tx.category
                return (
                  <div
                    key={`tx-${item.id}`}
                    className="rounded-xl border border-border/50 bg-background/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isIncome ? (
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 shrink-0 text-red-400" />
                          )}
                          <p className="font-medium truncate">
                            {isIncome
                              ? tx.description && tx.description !== label
                                ? `${label} · ${tx.description}`
                                : label
                              : tx.description || tx.category}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isIncome ? 'Cobro' : tx.category} ·{' '}
                          {format(new Date(tx.date), 'dd MMM yyyy', { locale: es })} · {tx.currency}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'text-base font-bold shrink-0',
                          isIncome ? 'text-primary' : 'text-red-400',
                        )}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(Number(tx.amount), tx.currency)}
                      </p>
                    </div>
                    <div className="mt-3 flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(tx)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting({ type: 'tx', id: tx.id })}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingExpense)} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar gasto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción</label>
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="Ej: supermercado"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto</label>
                <Input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Moneda</label>
                <Select
                  value={expenseForm.currency}
                  onValueChange={(value: 'ARS' | 'USD') => setExpenseForm({ ...expenseForm, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <CategoryPicker
                  value={expenseForm.category}
                  onChange={(value) => setExpenseForm({ ...expenseForm, category: value })}
                  options={categoryOptions}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                />
              </div>
            </div>
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingExpense(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitExpense}
              disabled={!expenseForm.amount || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingIncome)} onOpenChange={(open) => !open && setEditingIncome(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cobro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fuente</label>
              <Select
                value={incomeForm.income_source_id}
                onValueChange={(value) => setIncomeForm({ ...incomeForm, income_source_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí la fuente" />
                </SelectTrigger>
                <SelectContent>
                  {(activeSources.length > 0 ? activeSources : incomeSources).map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name} · {source.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIncomeSource && (
                <p className="text-xs text-muted-foreground">
                  Se acredita en Disponible {selectedIncomeSource.currency}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={incomeForm.date}
                  onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nota (opcional)</label>
              <Input
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                placeholder="Ej: primera quincena"
              />
            </div>
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingIncome(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitIncome}
              disabled={!incomeForm.amount || !incomeForm.income_source_id || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar movimiento</AlertDialogTitle>
            <AlertDialogDescription>
              Se revierte del disponible o del ahorro. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
