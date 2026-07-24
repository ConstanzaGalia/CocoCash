'use client'

import { useState } from 'react'
import { useSubscriptions, createSubscription, updateSubscription, deleteSubscription, toggleSubscriptionPaid } from '@/hooks/use-finance-data'
import type { Subscription } from '@/lib/types'
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
import { Plus, Pencil, Trash2, CalendarCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface SubscriptionFormData {
  name: string
  amount: string
  currency: 'ARS' | 'USD'
  billing_date: string
  category: string
  is_paid: boolean
}

const initialFormData: SubscriptionFormData = {
  name: '',
  amount: '',
  currency: 'ARS',
  billing_date: '1',
  category: 'Streaming',
  is_paid: false,
}

export function SubscriptionsView() {
  const { subscriptions, isLoading } = useSubscriptions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<Subscription | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<SubscriptionFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)

  const handleOpenCreate = () => {
    setEditingSub(null)
    setFormData(initialFormData)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (sub: Subscription) => {
    setEditingSub(sub)
    setFormData({
      name: sub.name,
      amount: sub.amount.toString(),
      currency: sub.currency,
      billing_date: sub.billing_date.toString(),
      category: sub.category,
      is_paid: sub.is_paid,
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
      const subData = {
        name: formData.name,
        amount: parseFloat(formData.amount) || 0,
        currency: formData.currency,
        billing_date: parseInt(formData.billing_date) || 1,
        category: formData.category,
        is_paid: formData.is_paid,
      }

      if (editingSub) {
        await updateSubscription(editingSub.id, subData)
      } else {
        await createSubscription(subData)
      }

      setIsDialogOpen(false)
      setFormData(initialFormData)
      setEditingSub(null)
    } catch (error) {
      console.error('Error saving subscription:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deletingId) {
      try {
        await deleteSubscription(deletingId)
        setIsDeleteOpen(false)
        setDeletingId(null)
      } catch (error) {
        console.error('Error deleting subscription:', error)
      }
    }
  }

  const handleTogglePaid = async (id: string, isPaid: boolean) => {
    try {
      await toggleSubscriptionPaid(id, isPaid)
    } catch (error) {
      console.error('Error toggling paid status:', error)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Suscripciones</h1>
          <p className="text-muted-foreground">Gestiona tus suscripciones mensuales</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Suscripcion
        </Button>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-amber-500" />
            Todas las Suscripciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay suscripciones. Crea una nueva suscripcion para comenzar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pagado</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Dia Cobro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow 
                    key={sub.id}
                    className={cn(sub.is_paid && 'opacity-50')}
                  >
                    <TableCell>
                      <Checkbox
                        checked={sub.is_paid}
                        onCheckedChange={(checked) => handleTogglePaid(sub.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className={cn(
                      'font-medium',
                      sub.is_paid && 'line-through'
                    )}>
                      {sub.name}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-muted">
                        {sub.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'font-medium',
                        sub.currency === 'USD' ? 'text-blue-400' : 'text-amber-400'
                      )}>
                        {formatCurrency(Number(sub.amount), sub.currency)}
                      </span>
                    </TableCell>
                    <TableCell>Dia {sub.billing_date}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(sub)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDelete(sub.id)}
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
              {editingSub ? 'Editar Suscripcion' : 'Nueva Suscripcion'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Netflix, Spotify"
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
                  {CATEGORIES.subscription.map((cat) => (
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
              <label className="text-sm font-medium">Dia de Cobro</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.billing_date}
                onChange={(e) => setFormData({ ...formData, billing_date: e.target.value })}
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
                editingSub ? 'Guardar' : 'Crear'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Suscripcion</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara la suscripcion permanentemente.
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
