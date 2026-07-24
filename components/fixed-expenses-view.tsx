'use client'

import { useState } from 'react'
import { useFixedExpenses, createFixedExpense, updateFixedExpense, deleteFixedExpense, toggleFixedExpensePaid } from '@/hooks/use-finance-data'
import type { FixedExpense } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Plus, Pencil, Trash2, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface FixedExpenseFormData {
  name: string
  amount: string
  currency: 'ARS' | 'USD'
  due_day: string
  category: string
  notes: string
  is_paid_this_month: boolean
}

const initialFormData: FixedExpenseFormData = {
  name: '',
  amount: '',
  currency: 'ARS',
  due_day: '10',
  category: 'Servicios',
  notes: '',
  is_paid_this_month: false,
}

export function FixedExpensesView() {
  const { fixedExpenses, isLoading } = useFixedExpenses()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FixedExpenseFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)

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
      is_paid_this_month: expense.is_paid_this_month,
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
        is_paid_this_month: formData.is_paid_this_month,
        last_paid_date: formData.is_paid_this_month ? new Date().toISOString().split('T')[0] : null,
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

  const handleTogglePaid = async (id: string, isPaid: boolean) => {
    try {
      await toggleFixedExpensePaid(id, isPaid)
    } catch (error) {
      console.error('Error toggling paid status:', error)
    }
  }

  const currentDay = new Date().getDate()
  const pendingExpenses = fixedExpenses.filter(e => !e.is_paid_this_month)
  const paidExpenses = fixedExpenses.filter(e => e.is_paid_this_month)
  const totalPending = pendingExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gastos Fijos</h1>
          <p className="text-muted-foreground">Recordatorios de pagos mensuales que no debes olvidar</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Gasto Fijo
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-400" />
              Pendientes este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">{formatCurrency(totalPending, 'ARS')}</div>
            <p className="text-xs text-muted-foreground">{pendingExpenses.length} gastos por pagar</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Pagados este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{paidExpenses.length}</div>
            <p className="text-xs text-muted-foreground">de {fixedExpenses.length} totales</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-400" />
              Proximos a vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingExpenses.filter(e => e.due_day <= currentDay + 5 && e.due_day >= currentDay).length}
            </div>
            <p className="text-xs text-muted-foreground">en los proximos 5 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Expenses Highlight */}
      {pendingExpenses.length > 0 && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <AlertCircle className="h-5 w-5" />
              Gastos Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {pendingExpenses.map((expense) => {
                const isOverdue = expense.due_day < currentDay
                const isDueSoon = expense.due_day <= currentDay + 3 && expense.due_day >= currentDay
                return (
                  <div 
                    key={expense.id}
                    className={cn(
                      'p-4 rounded-lg border',
                      isOverdue ? 'border-red-500/30 bg-red-500/10' : 
                      isDueSoon ? 'border-orange-500/30 bg-orange-500/10' : 
                      'border-border/50 bg-card/50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{expense.name}</p>
                        <p className="text-sm text-muted-foreground">{expense.category}</p>
                      </div>
                      <Checkbox
                        checked={expense.is_paid_this_month}
                        onCheckedChange={(checked) => handleTogglePaid(expense.id, checked as boolean)}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-lg font-bold">{formatCurrency(Number(expense.amount), expense.currency)}</span>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded',
                        isOverdue ? 'bg-red-500/20 text-red-400' :
                        isDueSoon ? 'bg-orange-500/20 text-orange-400' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {isOverdue ? 'Vencido' : `Dia ${expense.due_day}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Fixed Expenses Table */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            Todos los Gastos Fijos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fixedExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay gastos fijos. Crea uno nuevo para recordar tus pagos mensuales.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pagado</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Dia Venc.</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedExpenses.map((expense) => (
                  <TableRow 
                    key={expense.id}
                    className={cn(expense.is_paid_this_month && 'opacity-50')}
                  >
                    <TableCell>
                      <Checkbox
                        checked={expense.is_paid_this_month}
                        onCheckedChange={(checked) => handleTogglePaid(expense.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className={cn(
                      'font-medium',
                      expense.is_paid_this_month && 'line-through'
                    )}>
                      {expense.name}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-muted">
                        {expense.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'font-medium',
                        expense.currency === 'USD' ? 'text-blue-400' : 'text-purple-400'
                      )}>
                        {formatCurrency(Number(expense.amount), expense.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'px-2 py-1 rounded text-xs',
                        !expense.is_paid_this_month && expense.due_day < currentDay ? 'bg-red-500/20 text-red-400' :
                        !expense.is_paid_this_month && expense.due_day <= currentDay + 3 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-muted'
                      )}>
                        Dia {expense.due_day}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {expense.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                          onClick={() => handleOpenDelete(expense.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Alquiler, Luz, Internet"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.fixedExpense.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto</label>
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
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingExpense ? 'Guardar' : 'Crear'
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
              Esta accion no se puede deshacer. Se eliminara el gasto fijo permanentemente.
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
