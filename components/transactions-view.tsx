'use client'

import { useState } from 'react'
import { useTransactions, useAccounts, createTransaction, updateTransaction, deleteTransaction, toggleTransactionPaid } from '@/hooks/use-finance-data'
import type { Transaction } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Plus, Pencil, Trash2, Receipt, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface TransactionFormData {
  amount: string
  category: string
  date: string
  description: string
  is_paid: boolean
  account_id: string
  currency: 'ARS' | 'USD'
  type: 'income' | 'expense'
}

const initialFormData: TransactionFormData = {
  amount: '',
  category: 'Otros',
  date: new Date().toISOString().split('T')[0],
  description: '',
  is_paid: true,
  account_id: '',
  currency: 'ARS',
  type: 'expense',
}

export function TransactionsView() {
  const { transactions, isLoading } = useTransactions()
  const { accounts } = useAccounts()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [isSaving, setIsSaving] = useState(false)

  const handleOpenCreate = () => {
    setEditingTx(null)
    setFormData({
      ...initialFormData,
      account_id: accounts[0]?.id || '',
    })
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setFormData({
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date.split('T')[0],
      description: tx.description || '',
      is_paid: tx.is_paid,
      account_id: tx.account_id || '',
      currency: tx.currency,
      type: tx.type,
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
      const txData = {
        amount: parseFloat(formData.amount) || 0,
        category: formData.category,
        date: formData.date,
        description: formData.description || null,
        is_paid: formData.is_paid,
        account_id: formData.account_id || null,
        credit_card_id: null,
        currency: formData.currency,
        type: formData.type,
      }

      if (editingTx) {
        await updateTransaction(editingTx.id, txData)
      } else {
        await createTransaction(txData)
      }

      setIsDialogOpen(false)
      setFormData(initialFormData)
      setEditingTx(null)
    } catch (error) {
      console.error('Error saving transaction:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deletingId) {
      try {
        await deleteTransaction(deletingId)
        setIsDeleteOpen(false)
        setDeletingId(null)
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
    }
  }

  const handleTogglePaid = async (id: string, isPaid: boolean) => {
    try {
      await toggleTransactionPaid(id, isPaid)
    } catch (error) {
      console.error('Error toggling paid status:', error)
    }
  }

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return 'Sin cuenta'
    return accounts.find(a => a.id === accountId)?.name || 'Sin cuenta'
  }

  const filteredTransactions = transactions.filter(tx => {
    if (filterType === 'all') return true
    return tx.type === filterType
  })

  const categories = formData.type === 'income' ? CATEGORIES.income : CATEGORIES.expense

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
          <h1 className="text-3xl font-bold text-foreground">Transacciones</h1>
          <p className="text-muted-foreground">Gestiona tus ingresos y gastos</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Transaccion
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('all')}
        >
          Todas
        </Button>
        <Button
          variant={filterType === 'income' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('income')}
          className={filterType === 'income' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
        >
          <ArrowUpRight className="h-4 w-4 mr-1" />
          Ingresos
        </Button>
        <Button
          variant={filterType === 'expense' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('expense')}
          className={filterType === 'expense' ? 'bg-red-500 hover:bg-red-600' : ''}
        >
          <ArrowDownRight className="h-4 w-4 mr-1" />
          Gastos
        </Button>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-500" />
            Todas las Transacciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transacciones. Crea una nueva transaccion para comenzar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pagado</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow 
                    key={tx.id}
                    className={cn(!tx.is_paid && 'opacity-60')}
                  >
                    <TableCell>
                      <Checkbox
                        checked={tx.is_paid}
                        onCheckedChange={(checked) => handleTogglePaid(tx.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className={cn(
                      'font-medium',
                      !tx.is_paid && 'line-through'
                    )}>
                      <div className="flex items-center gap-2">
                        {tx.type === 'income' ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-400" />
                        )}
                        {tx.description || tx.category}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                        {tx.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(tx.date), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>{getAccountName(tx.account_id)}</TableCell>
                    <TableCell className={cn(
                      'text-right font-medium',
                      tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount), tx.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(tx)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDelete(tx.id)}
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
              {editingTx ? 'Editar Transaccion' : 'Nueva Transaccion'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={formData.type}
                onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value, category: value === 'income' ? 'Salario' : 'Otros' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripcion</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ej: Supermercado, Sueldo"
              />
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
            <div className="grid grid-cols-2 gap-4">
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
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Cuenta (opcional)</label>
              <Select
                value={formData.account_id}
                onValueChange={(value) => setFormData({ ...formData, account_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.amount || isSaving}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingTx ? 'Guardar' : 'Crear'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Transaccion</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara la transaccion permanentemente.
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
