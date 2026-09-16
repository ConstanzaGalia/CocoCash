'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  deleteTransfer,
  ensureSystemWallets,
  useAccounts,
  useFixedExpensePayments,
  useCardStatementPayments,
  useMonthlyIncomes,
  useTransactions,
  useTransfers,
  walletName,
} from '@/hooks/use-finance-data'
import { TransferDialog, type WalletSlot } from '@/components/transfer-dialog'
import { computeWalletTotals } from '@/lib/budget-flow'
import { cn, formatCurrency } from '@/lib/utils'
import type { AccountKind } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, PiggyBank, Trash2, Wallet } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function SavingsView() {
  const { accounts, isLoading: loadingAccounts } = useAccounts()
  const { monthlyIncomes, isLoading: loadingIncomes } = useMonthlyIncomes()
  const { payments, isLoading: loadingPayments } = useFixedExpensePayments()
  const { cardPayments, isLoading: loadingCardPayments } = useCardStatementPayments()
  const { transactions, isLoading: loadingTx } = useTransactions()
  const { transfers, isLoading: loadingTransfers } = useTransfers()
  const wallets = useMemo(
    () =>
      computeWalletTotals(accounts, transactions, transfers, payments, monthlyIncomes, cardPayments),
    [accounts, transactions, transfers, payments, monthlyIncomes, cardPayments],
  )
  const [transferOpen, setTransferOpen] = useState(false)
  const [presetFrom, setPresetFrom] = useState<WalletSlot | null>(null)
  const [presetTo, setPresetTo] = useState<WalletSlot | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    ensureSystemWallets().catch((error) => console.error('Error preparing wallets:', error))
  }, [])

  const accountLabel = (id: string) => {
    const account = accounts.find((item) => item.id === id)
    if (!account) return 'Bolsillo'
    return walletName((account.kind as AccountKind) || 'available', account.currency)
  }

  const openTransfer = (from?: WalletSlot, to?: WalletSlot) => {
    setPresetFrom(from ?? null)
    setPresetTo(to ?? null)
    setTransferOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteTransfer(deletingId)
      setDeletingId(null)
    } catch (error) {
      console.error('Error deleting transfer:', error)
    }
  }

  const isLoading =
    loadingAccounts ||
    loadingIncomes ||
    loadingPayments ||
    loadingCardPayments ||
    loadingTx ||
    loadingTransfers

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Cuentas de ahorro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acá están los bolsillos de ahorro. Los traspasos no cuentan como gasto.
          </p>
        </div>
        <Button
          onClick={() => openTransfer({ kind: 'available', currency: 'ARS' }, { kind: 'savings', currency: 'ARS' })}
          className="bg-primary hover:bg-primary/90"
        >
          <ArrowRightLeft className="h-4 w-4 mr-2" />
          Nuevo traspaso
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SavingsCard
          title="Ahorros ARS"
          amount={formatCurrency(wallets.savingsArs)}
          onIn={() => openTransfer({ kind: 'available', currency: 'ARS' }, { kind: 'savings', currency: 'ARS' })}
          onOut={() => openTransfer({ kind: 'savings', currency: 'ARS' }, { kind: 'available', currency: 'ARS' })}
        />
        <SavingsCard
          title="Ahorros USD"
          amount={formatCurrency(wallets.savingsUsd, 'USD')}
          onIn={() => openTransfer({ kind: 'available', currency: 'USD' }, { kind: 'savings', currency: 'USD' })}
          onOut={() => openTransfer({ kind: 'savings', currency: 'USD' }, { kind: 'available', currency: 'USD' })}
        />
      </div>

      <div>
        <div className="mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Disponible para traspasar</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cobros menos fijos pagos y variables. Lo que ya pasaste a ahorros no está acá.
          </p>
        </div>
        <div className="grid gap-3 grid-cols-2">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-5 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                Disponible ARS
              </p>
              <p
                className={cn(
                  'text-xl font-bold',
                  wallets.availableArs < 0 ? 'text-red-400' : 'text-foreground',
                )}
              >
                {formatCurrency(wallets.availableArs)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-5 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                Disponible USD
              </p>
              <p className="text-xl font-bold">{formatCurrency(wallets.availableUsd, 'USD')}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Traspasos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransfers ? (
            <Skeleton className="h-24 w-full" />
          ) : transfers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no hay traspasos. Usá Meter, Sacar o Nuevo traspaso.
            </p>
          ) : (
            <div className="space-y-3">
              {transfers.map((transfer) => {
                const isFx = transfer.currency !== transfer.to_currency
                return (
                  <div
                    key={transfer.id}
                    className="rounded-xl border border-border/50 bg-background/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {accountLabel(transfer.from_account_id)} → {accountLabel(transfer.to_account_id)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(transfer.date), 'dd MMM yyyy', { locale: es })}
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
                        className="text-red-400 hover:text-red-300"
                        onClick={() => setDeletingId(transfer.id)}
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

      <TransferDialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open)
          if (!open) {
            setPresetFrom(null)
            setPresetTo(null)
          }
        }}
        presetFrom={presetFrom}
        presetTo={presetTo}
      />

      <AlertDialog open={Boolean(deletingId)} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar traspaso</AlertDialogTitle>
            <AlertDialogDescription>
              Se revierte del disponible y del ahorro. Esta acción no se puede deshacer.
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

function SavingsCard({
  title,
  amount,
  onIn,
  onOut,
}: {
  title: string
  amount: string
  onIn: () => void
  onOut: () => void
}) {
  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
      <CardContent className="pt-5 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <PiggyBank className="h-4 w-4 text-blue-400" />
            {title}
          </p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{amount}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onIn}>
            <ArrowDownLeft className="h-4 w-4 mr-1" />
            Meter
          </Button>
          <Button variant="outline" size="sm" onClick={onOut}>
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Sacar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
