'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  computeWalletLedger,
  createTransfer,
  ensureSystemWallets,
  getWallet,
  useAccounts,
  useFixedExpensePayments,
  useMonthlyIncomes,
  useTransactions,
  useTransfers,
  WALLET_SLOTS,
  walletName,
} from '@/hooks/use-finance-data'
import type { AccountKind, Currency } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

export type WalletSlot = { kind: AccountKind; currency: Currency }

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetTo?: WalletSlot | null
  presetFrom?: WalletSlot | null
}

function slotKey(slot: WalletSlot) {
  return `${slot.kind}-${slot.currency}`
}

export function TransferDialog({ open, onOpenChange, presetTo, presetFrom }: TransferDialogProps) {
  const { accounts } = useAccounts()
  const { transactions } = useTransactions()
  const { transfers } = useTransfers()
  const { payments } = useFixedExpensePayments()
  const { monthlyIncomes } = useMonthlyIncomes()
  const ledger = useMemo(
    () => computeWalletLedger(accounts, transactions, transfers, payments, monthlyIncomes),
    [accounts, transactions, transfers, payments, monthlyIncomes],
  )
  const [fromKey, setFromKey] = useState('')
  const [toKey, setToKey] = useState('')
  const [amount, setAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wallets = useMemo(() => {
    return WALLET_SLOTS.map((slot) => {
      const match = accounts
        .filter((account) => (account.kind || 'available') === slot.kind && account.currency === slot.currency)
        .sort((a, b) => Number(b.balance) - Number(a.balance))[0]
      return {
        ...slot,
        key: slotKey(slot),
        label: walletName(slot.kind, slot.currency),
        account: match ?? null,
      }
    })
  }, [accounts])

  const fromWallet = wallets.find((wallet) => wallet.key === fromKey)
  const toWallet = wallets.find((wallet) => wallet.key === toKey)
  const toOptions = wallets.filter((wallet) => wallet.key !== fromKey)
  const isFx = Boolean(fromWallet && toWallet && fromWallet.currency !== toWallet.currency)

  const rate = useMemo(() => {
    const fromValue = parseFloat(amount) || 0
    const toValue = parseFloat(toAmount) || 0
    if (!isFx || fromValue <= 0 || toValue <= 0) return null
    if (fromWallet?.currency === 'USD' && toWallet?.currency === 'ARS') {
      return { label: 'Tipo de cambio', value: toValue / fromValue, suffix: 'ARS por USD' }
    }
    if (fromWallet?.currency === 'ARS' && toWallet?.currency === 'USD') {
      return { label: 'Tipo de cambio', value: fromValue / toValue, suffix: 'ARS por USD' }
    }
    return {
      label: 'Tipo de cambio',
      value: toValue / fromValue,
      suffix: `${toWallet?.currency} por ${fromWallet?.currency}`,
    }
  }, [amount, toAmount, isFx, fromWallet, toWallet])

  useEffect(() => {
    if (!open) return
    ensureSystemWallets().catch((err) => console.error('Error preparing wallets:', err))
  }, [open])

  useEffect(() => {
    if (!open) return
    const fallbackFrom = presetFrom ? slotKey(presetFrom) : slotKey({ kind: 'available', currency: 'ARS' })
    setFromKey(fallbackFrom)
    setToKey(presetTo ? slotKey(presetTo) : '')
  }, [open, presetFrom, presetTo])

  useEffect(() => {
    if (!open) {
      setAmount('')
      setToAmount('')
      setNotes('')
      setError(null)
      setFromKey('')
      setToKey('')
    }
  }, [open])

  const handleSave = async () => {
    if (!fromWallet) return
    if (!toWallet) {
      setError('Elegí hacia dónde va el dinero')
      return
    }
    const fromAccount = fromWallet.account ?? (await getWallet(fromWallet.kind, fromWallet.currency))
    const toAccount = toWallet.account ?? (await getWallet(toWallet.kind, toWallet.currency))
    const fromValue = parseFloat(amount) || 0
    const toValue = isFx ? parseFloat(toAmount) || 0 : fromValue
    if (fromValue <= 0 || toValue <= 0) {
      setError('Completá los montos')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createTransfer({
        from_account_id: fromAccount.id,
        to_account_id: toAccount.id,
        amount: fromValue,
        currency: fromWallet.currency,
        to_amount: toValue,
        to_currency: toWallet.currency,
        notes:
          notes ||
          (isFx
            ? `Cambio ${fromWallet.currency} → ${toWallet.currency}`
            : toWallet.kind === 'savings'
              ? 'Ahorro'
              : 'Traspaso'),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo hacer el traspaso')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Traspaso</DialogTitle>
          <DialogDescription>
            Mové plata entre disponible y ahorros. Si cambiás de moneda, cargá cuánto sale y cuánto entra.
            No se cuenta como gasto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Desde</label>
            <Select value={fromKey} onValueChange={setFromKey}>
              <SelectTrigger>
                <SelectValue placeholder="Origen" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.key} value={wallet.key}>
                    {wallet.label} · {formatCurrency(ledger.slot(wallet.kind, wallet.currency), wallet.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Hacia</label>
            <Select value={toKey} onValueChange={setToKey}>
              <SelectTrigger>
                <SelectValue placeholder="Destino" />
              </SelectTrigger>
              <SelectContent>
                {toOptions.map((wallet) => (
                  <SelectItem key={wallet.key} value={wallet.key}>
                    {wallet.label} · {formatCurrency(ledger.slot(wallet.kind, wallet.currency), wallet.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Sale {fromWallet ? `(${fromWallet.currency})` : ''}
            </label>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={fromWallet?.currency === 'USD' ? '3000' : '0'}
            />
          </div>
          {isFx && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Entra ({toWallet?.currency})</label>
              <Input
                type="number"
                inputMode="decimal"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                placeholder={toWallet?.currency === 'ARS' ? '3000000' : '0'}
              />
              {rate && (
                <p className="text-xs text-muted-foreground">
                  {rate.label}: {rate.value.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {rate.suffix}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nota (opcional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: ahorro del mes" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!fromKey || !toKey || !amount || (isFx && !toAmount) || saving}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Traspasar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function useWallets() {
  const { accounts, isLoading: loadingAccounts } = useAccounts()
  const { transactions, isLoading: loadingTransactions } = useTransactions()
  const { transfers, isLoading: loadingTransfers } = useTransfers()
  const { payments, isLoading: loadingPayments } = useFixedExpensePayments()
  const { monthlyIncomes, isLoading: loadingIncomes } = useMonthlyIncomes()
  return useMemo(() => {
    const ledger = computeWalletLedger(accounts, transactions, transfers, payments, monthlyIncomes)
    return {
      isLoading:
        loadingAccounts || loadingTransactions || loadingTransfers || loadingPayments || loadingIncomes,
      availableArs: ledger.availableArs,
      availableUsd: ledger.availableUsd,
      savingsArs: ledger.savingsArs,
      savingsUsd: ledger.savingsUsd,
    }
  }, [
    accounts,
    transactions,
    transfers,
    payments,
    monthlyIncomes,
    loadingAccounts,
    loadingTransactions,
    loadingTransfers,
    loadingPayments,
    loadingIncomes,
  ])
}
