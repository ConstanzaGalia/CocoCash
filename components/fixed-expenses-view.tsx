'use client'

import { useMemo, useState } from 'react'
import {
  useFixedExpenses,
  useFixedExpensePayments,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  recordFixedExpensePayment,
  updateFixedExpensePayment,
  deleteFixedExpensePaymentForMonth,
  setFixedExpenseActive,
  getWallet,
  useCards,
  useCardItems,
  useCardStatementPayments,
  recordCardStatementPayment,
  deleteCardStatementPayment,
} from '@/hooks/use-finance-data'
import type { Card as BudgetCard, CardStatementPayment, Currency, FixedExpense, FixedExpensePayment } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import { CategoryPicker, mergeCategories } from '@/components/category-picker'
import { cardItemsForMonth, cardMonthTotal, currenciesWithBalance } from '@/lib/card-billing'
import {
  cn,
  toMonthKey,
  formatMonthLabel,
  shiftMonthKey,
  formatDueDateLabel,
  dueDateForMonth,
} from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CreditCard,
  CircleHelp,
  Archive,
  ArchiveRestore,
} from 'lucide-react'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface ExpenseFormData {
  name: string
  amount: string
  currency: 'ARS' | 'USD'
  due_day: string
  category: string
  notes: string
}

const initialFormData: ExpenseFormData = {
  name: '',
  amount: '',
  currency: 'ARS',
  due_day: '10',
  category: 'Servicios',
  notes: '',
}

export function FixedExpensesView() {
  const { fixedExpenses, isLoading: loadingExpenses } = useFixedExpenses()
  const { payments, isLoading: loadingPayments } = useFixedExpensePayments()
  const { cards, isLoading: loadingCards } = useCards()
  const { cardItems, isLoading: loadingCardItems } = useCardItems()
  const { cardPayments, isLoading: loadingCardPayments } = useCardStatementPayments()
  const [monthKey, setMonthKey] = useState(() => toMonthKey())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null)
  const [payingExpense, setPayingExpense] = useState<FixedExpense | null>(null)
  const [payingCard, setPayingCard] = useState<{
    card: BudgetCard
    currency: Currency
    amount: number
  } | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ExpenseFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null)

  const isLoading =
    loadingExpenses || loadingPayments || loadingCards || loadingCardItems || loadingCardPayments
  const currentMonthKey = toMonthKey()
  const isCurrentMonth = monthKey === currentMonthKey

  const paymentsByExpenseId = useMemo(() => {
    const map = new Map<string, FixedExpensePayment>()
    for (const payment of payments) {
      if (payment.month_key === monthKey) {
        map.set(payment.fixed_expense_id, payment)
      }
    }
    return map
  }, [payments, monthKey])

  const cardPaymentKey = (cardId: string, currency: Currency) => `${cardId}:${currency}`

  const paymentsByCard = useMemo(() => {
    const map = new Map<string, CardStatementPayment>()
    for (const payment of cardPayments) {
      if (payment.month_key === monthKey) {
        map.set(cardPaymentKey(payment.card_id, payment.currency), payment)
      }
    }
    return map
  }, [cardPayments, monthKey])

  const activeFixedExpenses = useMemo(
    () => fixedExpenses.filter((expense) => expense.is_active !== false),
    [fixedExpenses],
  )
  const archivedFixedExpenses = useMemo(
    () => fixedExpenses.filter((expense) => expense.is_active === false),
    [fixedExpenses],
  )

  const checklist = useMemo(() => {
    return activeFixedExpenses.map((expense) => {
      const payment = paymentsByExpenseId.get(expense.id) ?? null
      const dueDate = dueDateForMonth(expense.due_day, monthKey)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isOverdue = !payment && dueDate < today && monthKey <= currentMonthKey
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const isDueSoon = !payment && !isOverdue && daysUntilDue >= 0 && daysUntilDue <= 3 && isCurrentMonth
      return { expense, payment, isOverdue, isDueSoon, dueDate }
    })
  }, [activeFixedExpenses, paymentsByExpenseId, monthKey, currentMonthKey, isCurrentMonth])

  const cardChecklist = useMemo(() => {
    const rows: {
      card: BudgetCard
      currency: Currency
      amount: number
      payment: CardStatementPayment | null
      lines: ReturnType<typeof cardItemsForMonth>
      isOverdue: boolean
      isDueSoon: boolean
    }[] = []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const card of cards) {
      const items = cardItems.filter((item) => item.card_id === card.id)
      for (const currency of currenciesWithBalance(items, monthKey)) {
        const amount = cardMonthTotal(items, monthKey, currency)
        if (amount <= 0) continue
        const payment = paymentsByCard.get(cardPaymentKey(card.id, currency)) ?? null
        const dueDate = dueDateForMonth(card.due_day, monthKey)
        const isOverdue = !payment && dueDate < today && monthKey <= currentMonthKey
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const isDueSoon =
          !payment && !isOverdue && daysUntilDue >= 0 && daysUntilDue <= 3 && isCurrentMonth
        rows.push({
          card,
          currency,
          amount,
          payment,
          lines: cardItemsForMonth(items, monthKey, currency),
          isOverdue,
          isDueSoon,
        })
      }
    }
    return rows
  }, [cards, cardItems, monthKey, paymentsByCard, currentMonthKey, isCurrentMonth])

  const paidItems = checklist.filter((item) => item.payment)
  const pendingItems = checklist.filter((item) => !item.payment)
  const paidCards = cardChecklist.filter((item) => item.payment)
  const pendingCards = cardChecklist.filter((item) => !item.payment)

  const totalChecklistCount = activeFixedExpenses.length + cardChecklist.length
  const totalPaidCount = paidItems.length + paidCards.length
  const totalEstimated =
    activeFixedExpenses.reduce((sum, e) => sum + Number(e.amount), 0) +
    cardChecklist.reduce((sum, row) => sum + (row.currency === 'ARS' ? row.amount : 0), 0)
  const totalPaid =
    paidItems.reduce((sum, item) => sum + Number(item.payment!.amount_paid), 0) +
    paidCards
      .filter((row) => row.currency === 'ARS')
      .reduce((sum, row) => sum + Number(row.payment!.amount_paid), 0)
  const totalPending =
    pendingItems.reduce((sum, item) => sum + Number(item.expense.amount), 0) +
    pendingCards
      .filter((row) => row.currency === 'ARS')
      .reduce((sum, row) => sum + row.amount, 0)
  const progressPercent =
    totalChecklistCount === 0 ? 0 : Math.round((totalPaidCount / totalChecklistCount) * 100)

  const monthlyMovements = useMemo(() => {
    return payments
      .filter((payment) => payment.month_key === monthKey)
      .map((payment) => {
        const expense = fixedExpenses.find((item) => item.id === payment.fixed_expense_id)
        if (!expense) return null
        return { expense, payment }
      })
      .filter((row): row is { expense: FixedExpense; payment: FixedExpensePayment } => row !== null)
      .sort((a, b) => b.payment.paid_at.localeCompare(a.payment.paid_at))
  }, [payments, monthKey, fixedExpenses])

  const handleOpenCreate = () => {
    setEditingExpense(null)
    setFormData(initialFormData)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (expense: FixedExpense) => {
    setEditingExpense(expense)
    setFormData({
      name: expense.name,
      amount: expense.amount.toString(),
      currency: expense.currency,
      due_day: expense.due_day.toString(),
      category: expense.category,
      notes: expense.notes || '',
    })
    setIsDialogOpen(true)
  }

  const handleOpenDelete = (id: string) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleSubmit = async () => {
    setIsSaving(true)
    try {
      const expenseData = {
        name: formData.name,
        amount: parseFloat(formData.amount) || 0,
        currency: formData.currency,
        due_day: parseInt(formData.due_day) || 10,
        category: formData.category,
        notes: formData.notes || null,
        is_paid_this_month: false,
        last_paid_date: null as string | null,
        is_active: true,
      }

      if (editingExpense) {
        await updateFixedExpense(editingExpense.id, expenseData)
      } else {
        await createFixedExpense(expenseData)
      }

      setIsDialogOpen(false)
      setFormData(initialFormData)
      setEditingExpense(null)
    } catch (error) {
      console.error('Error saving fixed expense:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deletingId) {
      try {
        await deleteFixedExpense(deletingId)
        setIsDeleteOpen(false)
        setDeletingId(null)
      } catch (error) {
        console.error('Error deleting fixed expense:', error)
      }
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await setFixedExpenseActive(id, false)
    } catch (error) {
      console.error('Error archiving fixed expense:', error)
      alert(error instanceof Error ? error.message : 'No se pudo archivar')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await setFixedExpenseActive(id, true)
    } catch (error) {
      console.error('Error restoring fixed expense:', error)
      alert(error instanceof Error ? error.message : 'No se pudo restaurar')
    }
  }

  const categoryOptions = mergeCategories(
    CATEGORIES.fixedExpense,
    fixedExpenses.map((expense) => expense.category),
  )

  const handleTogglePaid = async (expense: FixedExpense, checked: boolean) => {
    if (checked) {
      setPayingCard(null)
      setPayingExpense(expense)
      setPayAmount(Number(expense.amount).toString())
      setPayNotes('')
      setIsPayDialogOpen(true)
      return
    }

    try {
      await deleteFixedExpensePaymentForMonth(expense.id, monthKey)
    } catch (error) {
      console.error('Error removing payment:', error)
    }
  }

  const handleToggleCardPaid = async (
    row: { card: BudgetCard; currency: Currency; amount: number },
    checked: boolean,
  ) => {
    if (checked) {
      setPayingExpense(null)
      setPayingCard(row)
      setPayAmount(row.amount.toFixed(2))
      setPayNotes('')
      setIsPayDialogOpen(true)
      return
    }

    try {
      await deleteCardStatementPayment(row.card.id, monthKey, row.currency)
    } catch (error) {
      console.error('Error removing card payment:', error)
    }
  }

  const handleConfirmPayment = async () => {
    setIsPaying(true)
    try {
      if (payingCard) {
        const wallet = await getWallet('available', payingCard.currency)
        await recordCardStatementPayment({
          card_id: payingCard.card.id,
          card_name: payingCard.card.name,
          month_key: monthKey,
          currency: payingCard.currency,
          amount_paid: parseFloat(payAmount) || 0,
          notes: payNotes || null,
          account_id: wallet.id,
        })
        setPayingCard(null)
      } else if (payingExpense) {
        const wallet = await getWallet('available', payingExpense.currency)
        await recordFixedExpensePayment({
          fixed_expense_id: payingExpense.id,
          month_key: monthKey,
          amount_paid: parseFloat(payAmount) || 0,
          currency: payingExpense.currency,
          notes: payNotes || null,
          account_id: wallet.id,
          expense_name: payingExpense.name,
          category: payingExpense.category,
        })
        setPayingExpense(null)
      }
      setIsPayDialogOpen(false)
    } catch (error) {
      console.error('Error recording payment:', error)
    } finally {
      setIsPaying(false)
    }
  }

  const handleUncheckMovement = async (expense: FixedExpense) => {
    try {
      await deleteFixedExpensePaymentForMonth(expense.id, monthKey)
    } catch (error) {
      console.error('Error removing payment:', error)
    }
  }

  const handleUpdateMovement = async (
    payment: FixedExpensePayment,
    updates: Partial<Pick<FixedExpensePayment, 'amount_paid' | 'paid_at' | 'notes'>>,
  ) => {
    setSavingPaymentId(payment.id)
    try {
      await updateFixedExpensePayment(payment.id, updates)
    } catch (error) {
      console.error('Error updating payment:', error)
    } finally {
      setSavingPaymentId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Gastos Fijos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alquiler, servicios, tarjetas y todo lo que se paga todos los meses
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="w-full bg-primary hover:bg-primary/90 md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo gasto fijo
        </Button>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMonthKey((prev) => shiftMonthKey(prev, -1))}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-semibold capitalize">{formatMonthLabel(monthKey)}</p>
          {!isCurrentMonth && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setMonthKey(currentMonthKey)}
            >
              Volver al mes actual
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMonthKey((prev) => shiftMonthKey(prev, 1))}
          disabled={monthKey >= currentMonthKey}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card/50 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progreso de {formatMonthLabel(monthKey)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold">
                  {totalPaidCount}
                  <span className="text-lg text-muted-foreground"> / {totalChecklistCount}</span>
                </p>
                <p className="text-xs text-muted-foreground">pagados este mes</p>
              </div>
              <p className="text-2xl font-bold text-primary">{progressPercent}%</p>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pagado: {formatCurrency(totalPaid, 'ARS')}</span>
              <span>Estimado total: {formatCurrency(totalEstimated, 'ARS')}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-400" />
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {formatCurrency(totalPending, 'ARS')}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingItems.length + pendingCards.length} por pagar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly checklist — solo pendientes */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Checklist · {formatMonthLabel(monthKey)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeFixedExpenses.length === 0 && cardChecklist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay gastos fijos ni resúmenes de tarjeta este mes. Creá un fijo o cargá cuotas en
              Tarjetas.
            </div>
          ) : pendingItems.length === 0 && pendingCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium text-foreground">¡Todo pagado este mes!</p>
              <p className="text-sm mt-1">Los pagos registrados están en Movimientos del mes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingCards.map((row) => (
                <div
                  key={`card-${row.card.id}-${row.currency}`}
                  className={cn(
                    'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
                    row.isOverdue
                      ? 'border-red-500/30 bg-red-500/10'
                      : row.isDueSoon
                        ? 'border-orange-500/30 bg-orange-500/10'
                        : 'border-border/50 bg-card/50',
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Checkbox
                      checked={false}
                      onCheckedChange={(checked) => checked && handleToggleCardPaid(row, true)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="font-medium flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary shrink-0" />
                        {row.card.name} · {row.currency}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label="Qué es este monto"
                            >
                              <CircleHelp className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                            Total a pagar en {formatMonthLabel(monthKey)} (mes de vencimiento). No es
                            el mes de la compra ni el del cierre: si el resumen vence en este mes, va
                            acá.
                          </TooltipContent>
                        </Tooltip>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        A pagar · vence {formatDueDateLabel(row.card.due_day, monthKey)}
                      </p>
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {row.lines.map((line) => (
                          <li key={line.item.id}>
                            · {line.item.name}
                            {line.installmentLabel ? ` ${line.installmentLabel}` : ''} ·{' '}
                            {formatCurrency(line.amount, row.currency)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(row.amount, row.currency)}</p>
                      <p className="text-xs text-muted-foreground">a pagar</p>
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded shrink-0',
                        row.isOverdue
                          ? 'bg-red-500/20 text-red-400'
                          : row.isDueSoon
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {row.isOverdue ? 'Vencido' : row.isDueSoon ? 'Pronto' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ))}

              {pendingItems.map(({ expense, isOverdue, isDueSoon }) => (
                <div
                  key={expense.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
                    isOverdue
                      ? 'border-red-500/30 bg-red-500/10'
                      : isDueSoon
                        ? 'border-orange-500/30 bg-orange-500/10'
                        : 'border-border/50 bg-card/50',
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Checkbox
                      checked={false}
                      onCheckedChange={(checked) =>
                        checked && handleTogglePaid(expense, true)
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{expense.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {expense.category} · vence {formatDueDateLabel(expense.due_day, monthKey)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <p className="font-bold">
                        {formatCurrency(Number(expense.amount), expense.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">estimado</p>
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded shrink-0',
                        isOverdue
                          ? 'bg-red-500/20 text-red-400'
                          : isDueSoon
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isOverdue ? 'Vencido' : isDueSoon ? 'Pronto' : 'Pendiente'}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(expense)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Archivar (conserva el historial)"
                        onClick={() => handleArchive(expense.id)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(expense.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movimientos del mes — pagos registrados */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-400" />
            Movimientos del mes · {formatMonthLabel(monthKey)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyMovements.length === 0 && paidCards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Todavía no hay pagos registrados este mes. Marcá un gasto en la checklist para agregarlo acá.
            </p>
          ) : (
            <>
              {paidCards.length > 0 && (
                <div className="mb-4 space-y-2">
                  {paidCards.map((row) => (
                    <div
                      key={`paid-card-${row.card.id}-${row.currency}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/40 p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          {row.card.name} · {row.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tarjeta · {formatCurrency(Number(row.payment!.amount_paid), row.currency)} ·{' '}
                          {row.payment!.paid_at}
                        </p>
                      </div>
                      <Checkbox
                        checked
                        onCheckedChange={(checked) => {
                          if (!checked) handleToggleCardPaid(row, false)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3 md:hidden">
                {monthlyMovements.map(({ expense, payment }) => (
                  <div
                    key={`${payment.id}-${payment.updated_at}`}
                    className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{expense.name}</p>
                        <p className="text-xs text-muted-foreground">{expense.category}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {expense.is_active !== false && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Archivar"
                            onClick={() => handleArchive(expense.id)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        <Checkbox
                          checked
                          onCheckedChange={(checked) => {
                            if (!checked) handleUncheckMovement(expense)
                          }}
                          disabled={savingPaymentId === payment.id}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Monto</label>
                        <Input
                          type="number"
                          defaultValue={Number(payment.amount_paid)}
                          className="h-9"
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            if (value !== Number(payment.amount_paid)) {
                              handleUpdateMovement(payment, { amount_paid: value })
                            }
                          }}
                          disabled={savingPaymentId === payment.id}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Fecha</label>
                        <Input
                          type="date"
                          defaultValue={payment.paid_at}
                          className="h-9"
                          onBlur={(e) => {
                            if (e.target.value && e.target.value !== payment.paid_at) {
                              handleUpdateMovement(payment, { paid_at: e.target.value })
                            }
                          }}
                          disabled={savingPaymentId === payment.id}
                        />
                      </div>
                    </div>
                    <Input
                      defaultValue={payment.notes ?? ''}
                      placeholder="Notas"
                      className="h-9"
                      onBlur={(e) => {
                        const value = e.target.value.trim() || null
                        if (value !== (payment.notes ?? null)) {
                          handleUpdateMovement(payment, { notes: value })
                        }
                      }}
                      disabled={savingPaymentId === payment.id}
                    />
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Pagado</TableHead>
                  <TableHead>Gasto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="w-32">Monto</TableHead>
                  <TableHead className="w-36">Fecha</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyMovements.map(({ expense, payment }) => (
                  <TableRow key={`${payment.id}-${payment.updated_at}`}>
                    <TableCell>
                      <Checkbox
                        checked
                        onCheckedChange={(checked) => {
                          if (!checked) handleUncheckMovement(expense)
                        }}
                        disabled={savingPaymentId === payment.id}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{expense.name}</TableCell>
                    <TableCell className="text-muted-foreground">{expense.category}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          defaultValue={Number(payment.amount_paid)}
                          className="h-8 w-28"
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            if (value !== Number(payment.amount_paid)) {
                              handleUpdateMovement(payment, { amount_paid: value })
                            }
                          }}
                          disabled={savingPaymentId === payment.id}
                        />
                        <span className="text-xs text-muted-foreground">{payment.currency}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        defaultValue={payment.paid_at}
                        className="h-8"
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== payment.paid_at) {
                            handleUpdateMovement(payment, { paid_at: e.target.value })
                          }
                        }}
                        disabled={savingPaymentId === payment.id}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={payment.notes ?? ''}
                        placeholder="—"
                        className="h-8"
                        onBlur={(e) => {
                          const value = e.target.value.trim() || null
                          if (value !== (payment.notes ?? null)) {
                            handleUpdateMovement(payment, { notes: value })
                          }
                        }}
                        disabled={savingPaymentId === payment.id}
                      />
                    </TableCell>
                    <TableCell>
                      {expense.is_active !== false && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Archivar (conserva el historial)"
                          onClick={() => handleArchive(expense.id)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
            </>
          )}
          {monthlyMovements.length > 0 && (
            <div className="flex justify-end mt-3 pt-3 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Total pagado:{' '}
                <span className="font-semibold text-primary">
                  {formatCurrency(totalPaid, 'ARS')}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates note */}
      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        Los gastos fijos son plantillas. Usá Archivar para sacarlos del checklist sin perder historial.
      </p>

      {archivedFixedExpenses.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4 text-muted-foreground" />
              Archivados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="mb-2 text-xs text-muted-foreground">
              No salen en el checklist. Los pagos de meses anteriores se conservan.
            </p>
            {archivedFixedExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-muted-foreground">{expense.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {expense.category} · {formatCurrency(Number(expense.amount), expense.currency)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleRestore(expense.id)}>
                  <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                  Restaurar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}
            </DialogTitle>
            <DialogDescription>
              Define el servicio y el monto estimado. El monto real se registra al marcar como pagado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Alquiler, Tarjeta Galicia, Gimnasio"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <CategoryPicker
                value={formData.category}
                onChange={(value) => setFormData({ ...formData, category: value })}
                options={categoryOptions}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto estimado</label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Moneda</label>
                <Select
                  value={formData.currency}
                  onValueChange={(value: 'ARS' | 'USD') =>
                    setFormData({ ...formData, currency: value })
                  }
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Dia de Vencimiento</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.due_day}
                onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Numero de cliente, detalles..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.amount || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editingExpense ? (
                'Guardar'
              ) : (
                'Crear'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {payingCard
                ? `${payingCard.card.name} · ${payingCard.currency} · ${formatMonthLabel(monthKey)}`
                : payingExpense
                  ? `${payingExpense.name} · ${formatMonthLabel(monthKey)}`
                  : 'Ingresá el monto que pagaste'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Monto pagado</label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0"
                autoFocus
              />
              {payingCard && (
                <p className="text-xs text-muted-foreground">
                  A pagar: {formatCurrency(payingCard.amount, payingCard.currency)}
                </p>
              )}
              {payingExpense && (
                <p className="text-xs text-muted-foreground">
                  Estimado: {formatCurrency(Number(payingExpense.amount), payingExpense.currency)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Ej: subió la tarifa"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={!payAmount || isPaying}
              className="bg-primary hover:bg-primary/90"
            >
              {isPaying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Confirmar pago'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Gasto Fijo</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la plantilla y todo su historial de pagos. Si solo querés sacarlo del
              checklist, usá Archivar. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
