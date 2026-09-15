'use client'

import { useMemo, useState } from 'react'
import {
  deleteTransaction,
  deleteTransfer,
  getWallet,
  updateTransaction,
  useAccounts,
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

const initialFormData: ExpenseFormData = {
  amount: '',
  category: 'Comida',
  date: new Date().toISOString().split('T')[0],
  description: '',
  currency: 'ARS',
}

export function TransactionsView() {
  const { transactions, isLoading: loadingTx } = useTransactions()
  const { transfers, isLoading: loadingTransfers } = useTransfers()
  const { accounts } = useAccounts()
  const [filter, setFilter] = useState<Filter>('all')
  const currentMonthKey = toMonthKey()
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const isCurrentMonth = monthKey === currentMonthKey
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [formData, setFormData] = useState<ExpenseFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [deleting, setDeleting] = useState<{ type: 'tx' | 'transfer'; id: string } | null>(null)

  const accountName = (id: string) => {
    const account = accounts.find((item) => item.id === id)
    if (!account) return 'Bolsillo'
    return walletName(account.kind || 'available', account.currency)
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
    if (tx.type !== 'expense') return
    setEditingTx(tx)
    setFormData({
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date.split('T')[0],
      description: tx.description || '',
      currency: tx.currency,
    })
  }

  const handleSubmit = async () => {
    if (!editingTx) return
    setIsSaving(true)
    try {
      const wallet = await getWallet('available', formData.currency)
      await updateTransaction(editingTx.id, {
        amount: parseFloat(formData.amount) || 0,
        category: formData.category,
        date: formData.date,
        description: formData.description || null,
        currency: formData.currency,
        type: 'expense',
        account_id: wallet.id,
      })
      setEditingTx(null)
    } catch (error) {
      console.error('Error saving transaction:', error)
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
              className="mt-1 text-xs text-emerald-400 hover:underline"
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
                ? 'bg-emerald-500 hover:bg-emerald-600'
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
                return (
                  <div
                    key={`tx-${item.id}`}
                    className="rounded-xl border border-border/50 bg-background/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isIncome ? (
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-400" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 shrink-0 text-red-400" />
                          )}
                          <p className="font-medium truncate">{tx.description || tx.category}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isIncome ? 'Cobro' : tx.category} ·{' '}
                          {format(new Date(tx.date), 'dd MMM yyyy', { locale: es })} · {tx.currency}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'text-base font-bold shrink-0',
                          isIncome ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(Number(tx.amount), tx.currency)}
                      </p>
                    </div>
                    <div className="mt-3 flex justify-end gap-1">
                      {!isIncome && (
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(tx)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
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

      <Dialog open={Boolean(editingTx)} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar gasto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ej: supermercado"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto</label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Moneda</label>
                <Select
                  value={formData.currency}
                  onValueChange={(value: 'ARS' | 'USD') => setFormData({ ...formData, currency: value })}
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
                  value={formData.category}
                  onChange={(value) => setFormData({ ...formData, category: value })}
                  options={categoryOptions}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTx(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.amount || isSaving}
              className="bg-emerald-500 hover:bg-emerald-600"
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
