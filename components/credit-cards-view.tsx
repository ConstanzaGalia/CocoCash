'use client'

import { useState } from 'react'
import { useCreditCards, createCreditCard, updateCreditCard, deleteCreditCard } from '@/hooks/use-finance-data'
import type { CreditCard } from '@/lib/types'
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
import { Plus, Pencil, Trash2, CreditCard as CreditCardIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface CardFormData {
  name: string
  last_four_digits: string
  credit_limit: string
  current_balance: string
  closing_date: string
  due_date: string
  currency: 'ARS' | 'USD'
}

const initialFormData: CardFormData = {
  name: '',
  last_four_digits: '',
  credit_limit: '',
  current_balance: '0',
  closing_date: '10',
  due_date: '25',
  currency: 'ARS',
}

export function CreditCardsView() {
  const { creditCards, isLoading } = useCreditCards()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CardFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)

  const handleOpenCreate = () => {
    setEditingCard(null)
    setFormData(initialFormData)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (card: CreditCard) => {
    setEditingCard(card)
    setFormData({
      name: card.name,
      last_four_digits: card.last_four_digits,
      credit_limit: card.credit_limit.toString(),
      current_balance: card.current_balance.toString(),
      closing_date: card.closing_date.toString(),
      due_date: card.due_date.toString(),
      currency: card.currency,
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
      const cardData = {
        name: formData.name,
        last_four_digits: formData.last_four_digits,
        credit_limit: parseFloat(formData.credit_limit) || 0,
        current_balance: parseFloat(formData.current_balance) || 0,
        closing_date: parseInt(formData.closing_date) || 10,
        due_date: parseInt(formData.due_date) || 25,
        currency: formData.currency,
      }

      if (editingCard) {
        await updateCreditCard(editingCard.id, cardData)
      } else {
        await createCreditCard(cardData)
      }

      setIsDialogOpen(false)
      setFormData(initialFormData)
      setEditingCard(null)
    } catch (error) {
      console.error('Error saving card:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deletingId) {
      try {
        await deleteCreditCard(deletingId)
        setIsDeleteOpen(false)
        setDeletingId(null)
      } catch (error) {
        console.error('Error deleting card:', error)
      }
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
          <h1 className="text-3xl font-bold text-foreground">Tarjetas de Credito</h1>
          <p className="text-muted-foreground">Gestiona tus tarjetas de credito</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarjeta
        </Button>
      </div>

      {/* Cards Grid View */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {creditCards.map((card) => {
          const usagePercent = (Number(card.current_balance) / Number(card.credit_limit)) * 100
          return (
            <Card 
              key={card.id} 
              className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <CreditCardIcon className="h-8 w-8 text-amber-400" />
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    card.currency === 'USD' 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'bg-emerald-500/20 text-emerald-400'
                  )}>
                    {card.currency}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-slate-400 text-xs mb-1">Consumo actual</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(Number(card.current_balance), card.currency)}
                  </p>
                  <p className="text-xs text-slate-400">
                    de {formatCurrency(Number(card.credit_limit), card.currency)} limite
                  </p>
                </div>
                <div className="mb-4">
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className={cn(
                        'h-2 rounded-full transition-all',
                        usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{usagePercent.toFixed(0)}% utilizado</p>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm font-medium text-white">{card.name}</p>
                    <p className="text-xs text-slate-400">
                      **** {card.last_four_digits} | Cierre: {card.closing_date} | Venc: {card.due_date}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-white"
                      onClick={() => handleOpenEdit(card)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-400"
                      onClick={() => handleOpenDelete(card.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {creditCards.length === 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No hay tarjetas de credito. Crea una nueva tarjeta para comenzar.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table View */}
      {creditCards.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-amber-500" />
              Lista de Tarjetas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ultimos 4</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Consumo</TableHead>
                  <TableHead className="text-right">Limite</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">{card.name}</TableCell>
                    <TableCell>**** {card.last_four_digits}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        card.currency === 'USD' 
                          ? 'bg-blue-500/10 text-blue-400' 
                          : 'bg-emerald-500/10 text-emerald-400'
                      )}>
                        {card.currency}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-400">
                      {formatCurrency(Number(card.current_balance), card.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-400">
                      {formatCurrency(Number(card.credit_limit), card.currency)}
                    </TableCell>
                    <TableCell>Dia {card.closing_date}</TableCell>
                    <TableCell>Dia {card.due_date}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(card)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDelete(card.id)}
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
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCard ? 'Editar Tarjeta' : 'Nueva Tarjeta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Visa BBVA"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ultimos 4 digitos</label>
                <Input
                  value={formData.last_four_digits}
                  onChange={(e) => setFormData({ ...formData, last_four_digits: e.target.value.slice(0, 4) })}
                  placeholder="1234"
                  maxLength={4}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Limite</label>
                <Input
                  type="number"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  placeholder="500000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Consumo actual</label>
                <Input
                  type="number"
                  value={formData.current_balance}
                  onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  placeholder="0"
                />
              </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de Cierre</label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.closing_date}
                  onChange={(e) => setFormData({ ...formData, closing_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de Vencimiento</label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || !formData.credit_limit || isSaving}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingCard ? 'Guardar' : 'Crear'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Tarjeta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara la tarjeta permanentemente.
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
