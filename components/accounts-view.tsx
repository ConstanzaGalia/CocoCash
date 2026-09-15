'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  useAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from '@/hooks/use-finance-data'
import type { Account, AccountKind, MercadoPagoStatus } from '@/lib/types'
import { TransferDialog } from '@/components/transfer-dialog'
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
import {
  Plus,
  Pencil,
  Trash2,
  Wallet,
  Loader2,
  Link2,
  RefreshCw,
  Unlink,
  ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { mutate } from 'swr'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface AccountFormData {
  name: string
  currency: 'ARS' | 'USD'
  kind: AccountKind
}

const initialFormData: AccountFormData = {
  name: '',
  currency: 'ARS',
  kind: 'available',
}

export function AccountsView() {
  const { accounts, isLoading } = useAccounts()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<AccountFormData>(initialFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [mpStatus, setMpStatus] = useState<MercadoPagoStatus | null>(null)
  const [mpLoading, setMpLoading] = useState(true)
  const [mpSyncing, setMpSyncing] = useState(false)
  const [mpMessage, setMpMessage] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const loadMpStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/mercadopago/status')
      if (!res.ok) throw new Error('status failed')
      const data = (await res.json()) as MercadoPagoStatus
      setMpStatus(data)
    } catch {
      setMpStatus({ connected: false })
    } finally {
      setMpLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMpStatus()

    const params = new URLSearchParams(window.location.search)
    if (params.get('mp') === 'connected') {
      setMpMessage('Mercado Pago conectado. Ya podés sincronizar movimientos.')
    }
    const err = params.get('mp_error')
    if (err === 'config') {
      setMpMessage('Faltan credenciales de Mercado Pago en el servidor (.env).')
    } else if (err === 'denied') {
      setMpMessage('No se autorizó el acceso a Mercado Pago.')
    } else if (err === 'state' || err === 'callback') {
      setMpMessage('Hubo un problema al conectar Mercado Pago. Probá de nuevo.')
    }
  }, [loadMpStatus])

  const handleOpenCreate = () => {
    setEditingAccount(null)
    setFormData(initialFormData)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (account: Account) => {
    setEditingAccount(account)
    setFormData({
      name: account.name,
      currency: account.currency,
      kind: account.kind || 'available',
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
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name: formData.name,
          currency: formData.currency,
          kind: formData.kind,
        })
      } else {
        await createAccount({
          name: formData.name,
          currency: formData.currency,
          balance: 0,
          kind: formData.kind,
        })
      }

      setIsDialogOpen(false)
      setFormData(initialFormData)
      setEditingAccount(null)
    } catch (error) {
      console.error('Error saving account:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deletingId) {
      try {
        await deleteAccount(deletingId)
        setIsDeleteOpen(false)
        setDeletingId(null)
      } catch (error) {
        console.error('Error deleting account:', error)
      }
    }
  }

  const handleSync = async () => {
    setMpSyncing(true)
    setMpMessage(null)
    try {
      const res = await fetch('/api/mercadopago/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar')
      setMpMessage(
        `Sync OK: ${data.imported} nuevos, ${data.updated} actualizados` +
          (data.balanceUpdated ? `, saldo ${formatCurrency(data.balance, 'ARS')}` : ''),
      )
      mutate('accounts')
      mutate('transactions')
      await loadMpStatus()
    } catch (error) {
      setMpMessage(error instanceof Error ? error.message : 'Error al sincronizar')
    } finally {
      setMpSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setMpLoading(true)
    setMpMessage(null)
    try {
      const res = await fetch('/api/mercadopago/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('No se pudo desconectar')
      setMpMessage('Mercado Pago desconectado. La cuenta queda en CocoCash; podés borrarla si querés.')
      await loadMpStatus()
    } catch {
      setMpMessage('Error al desconectar Mercado Pago.')
      setMpLoading(false)
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
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Cuentas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            El saldo solo cambia con ingresos, gastos y traspasos.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <Button variant="outline" onClick={() => setTransferOpen(true)} className="w-full md:w-auto">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Traspaso
          </Button>
          <Button onClick={handleOpenCreate} className="w-full bg-primary hover:bg-primary/90 md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cuenta
          </Button>
        </div>
      </div>

      {/* Mercado Pago */}
      {/* <Card className="border-sky-500/20 bg-sky-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-sky-400" />
            Mercado Pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mpLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando conexión...
            </div>
          ) : mpStatus?.connected ? (
            <>
              <div>
                <p className="font-medium">
                  Conectado
                  {mpStatus.nickname ? ` · ${mpStatus.nickname}` : ''}
                </p>
                {mpStatus.email && (
                  <p className="text-sm text-muted-foreground">{mpStatus.email}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {mpStatus.lastSyncedAt
                    ? `Última sync: ${new Date(mpStatus.lastSyncedAt).toLocaleString('es-AR')}`
                    : 'Todavía no sincronizaste movimientos'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSync}
                  disabled={mpSyncing}
                  className="bg-sky-500 hover:bg-sky-600"
                >
                  {mpSyncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sincronizar
                </Button>
                <Button variant="outline" onClick={handleDisconnect}>
                  <Unlink className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Conectá tu cuenta de Mercado Pago para traer movimientos a CocoCash.
                Cada usuario conecta la suya.
              </p>
              <Button asChild className="bg-sky-500 hover:bg-sky-600">
                <a href="/api/mercadopago/connect">
                  <Link2 className="h-4 w-4 mr-2" />
                  Conectar Mercado Pago
                </a>
              </Button>
            </>
          )}
          {mpMessage && (
            <p className="text-sm text-muted-foreground border border-border/50 rounded-md px-3 py-2">
              {mpMessage}
            </p>
          )}
        </CardContent>
      </Card> */}

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Todas las Cuentas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay cuentas. Crea una nueva cuenta para comenzar.
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-xl border border-border/50 bg-background/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{account.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              account.kind === 'savings'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-primary/10 text-primary',
                            )}
                          >
                            {account.kind === 'savings' ? 'Ahorros' : 'Disponible'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                            {account.currency}
                          </span>
                        </div>
                      </div>
                      <p
                        className={cn(
                          'text-lg font-bold shrink-0',
                          Number(account.balance) >= 0 ? 'text-primary' : 'text-red-400',
                        )}
                      >
                        {formatCurrency(Number(account.balance), account.currency)}
                      </p>
                    </div>
                    <div className="mt-3 flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(account)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(account.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          account.kind === 'savings'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {account.kind === 'savings' ? 'Ahorros' : 'Disponible'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          account.source === 'mercadopago'
                            ? 'bg-sky-500/10 text-sky-400'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {account.source === 'mercadopago' ? 'Mercado Pago' : 'Manual'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          account.currency === 'USD'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {account.currency}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium',
                        Number(account.balance) >= 0 ? 'text-primary' : 'text-red-400',
                      )}
                    >
                      {formatCurrency(Number(account.balance), account.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDelete(account.id)}
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
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: BBVA, Efectivo"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Moneda</label>
              <Select
                value={formData.currency}
                onValueChange={(value: 'ARS' | 'USD') =>
                  setFormData({ ...formData, currency: value })
                }
                disabled={Boolean(editingAccount)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS - Pesos Argentinos</SelectItem>
                  <SelectItem value="USD">USD - Dolares</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={formData.kind}
                onValueChange={(value: AccountKind) => setFormData({ ...formData, kind: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponible (gastos del mes)</SelectItem>
                  <SelectItem value="savings">Ahorros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingAccount && (
              <p className="text-sm text-muted-foreground">
                Saldo actual:{' '}
                <span className="font-medium text-foreground">
                  {formatCurrency(Number(editingAccount.balance), editingAccount.currency)}
                </span>
                . Para cambiarlo usá un ingreso, un gasto o un traspaso.
              </p>
            )}
            {!editingAccount && (
              <p className="text-sm text-muted-foreground">
                Empieza en $0. El saldo se arma con cobros, gastos y traspasos.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editingAccount ? (
                'Guardar'
              ) : (
                'Crear'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara la cuenta permanentemente.
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
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  )
}
