'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createIncomeSource,
  deleteIncomeSource,
  addMonthlyIncome,
  updateIncomeSource,
  getWallet,
  useIncomeSources,
  useMonthlyIncomes,
} from '@/hooks/use-finance-data'
import type { Currency, IncomeSource } from '@/lib/types'
import { INCOME_SOURCE_SUGGESTIONS } from '@/lib/types'
import { formatCurrency, formatMonthLabel, toMonthKey } from '@/lib/utils'
import { MonthPicker } from '@/components/month-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, Plus, Trash2, TrendingUp, Loader2 } from 'lucide-react'

interface IncomeAmountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: IncomeSource | null
  monthKey: string
}

export function IncomeAmountDialog({
  open,
  onOpenChange,
  source,
  monthKey,
}: IncomeAmountDialogProps) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setNotes('')
    setError(null)
  }, [open, source?.id])

  const handleSave = async () => {
    if (!source) return
    const value = parseFloat(amount.replace(',', '.')) || 0
    if (value <= 0) {
      setError('Ingresá el monto cobrado')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const wallet = await getWallet('available', source.currency)
      await addMonthlyIncome({
        income_source_id: source.id,
        source_name: source.name,
        month_key: monthKey,
        amount: value,
        currency: source.currency,
        account_id: wallet.id,
        notes: notes.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cobro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{source ? `Nuevo cobro · ${source.name}` : 'Nuevo cobro'}</DialogTitle>
          <DialogDescription>
            Se suma al disponible en {source?.currency} y queda en Movimientos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Monto</label>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
              className="h-12 text-lg"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nota (opcional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: primera quincena, aguinaldo"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Sumar cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function IncomeSourcesView() {
  const { incomeSources, isLoading, error } = useIncomeSources()
  const { monthlyIncomes } = useMonthlyIncomes()
  const currentMonthKey = toMonthKey()
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const isCurrentMonth = monthKey === currentMonthKey
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<IncomeSource | null>(null)
  const [editName, setEditName] = useState('')

  const totalsBySource = useMemo(() => {
    const map = new Map<string, number>()
    for (const income of monthlyIncomes) {
      if (income.month_key !== monthKey) continue
      map.set(income.income_source_id, (map.get(income.income_source_id) ?? 0) + Number(income.amount))
    }
    return map
  }, [monthlyIncomes, monthKey])

  const totalArs = monthlyIncomes
    .filter((income) => income.month_key === monthKey && income.currency === 'ARS')
    .reduce((sum, income) => sum + Number(income.amount), 0)
  const totalUsd = monthlyIncomes
    .filter((income) => income.month_key === monthKey && income.currency === 'USD')
    .reduce((sum, income) => sum + Number(income.amount), 0)

  const handleCreate = async (preset?: string) => {
    const nextName = (preset ?? name).trim()
    if (!nextName) return
    setSaving(true)
    try {
      await createIncomeSource({ name: nextName, currency })
      setName('')
    } catch (err) {
      console.error('Error creating income source:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async () => {
    if (!editing || !editName.trim()) return
    setSaving(true)
    try {
      await updateIncomeSource(editing.id, { name: editName.trim() })
      setEditing(null)
    } catch (err) {
      console.error('Error renaming income source:', err)
    } finally {
      setSaving(false)
    }
  }

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
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Fuentes de ingreso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acá armás Sueldo STP, Sueldo FW, extras. Los cobros se cargan con el + y se ven en Movimientos.
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

      {error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-4 text-sm">
            Falta ejecutar en Supabase <code className="text-xs">scripts/004_budget_flow.sql</code> y{' '}
            <code className="text-xs">scripts/006_multiple_incomes.sql</code> para habilitar ingresos configurables.
          </CardContent>
        </Card>
      )}

      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-emerald-400 capitalize">
            Cobrado {isCurrentMonth ? 'este mes' : formatMonthLabel(monthKey)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-emerald-400">{formatCurrency(totalArs)}</p>
          {totalUsd !== 0 && (
            <p className="text-lg font-semibold text-emerald-400/80 mt-1">{formatCurrency(totalUsd, 'USD')}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">El detalle está en Movimientos</p>
        </CardContent>
      </Card>

      {incomeSources.length === 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Todavía no hay fuentes. Creá las tuyas o empezá con estas:
            </p>
            <div className="flex flex-wrap gap-2">
              {INCOME_SOURCE_SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreate(suggestion)}
                  disabled={saving}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {incomeSources.map((source) => (
          <Card key={source.id} className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="truncate">{source.name}</span>
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="mr-1 text-xs text-muted-foreground">{source.currency}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditing(source)
                      setEditName(source.name)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-300"
                    onClick={() => deleteIncomeSource(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(totalsBySource.get(source.id) ?? 0, source.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 capitalize">
                {isCurrentMonth ? 'Este mes' : formatMonthLabel(monthKey)} · cargá cobros con el +
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Nueva fuente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Sueldo STP, Sueldo FW, extra"
            className="sm:flex-1"
          />
          <Select value={currency} onValueChange={(value: Currency) => setCurrency(value)}>
            <SelectTrigger className="sm:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => handleCreate()}
            disabled={!name.trim() || saving}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renombrar fuente</DialogTitle>
          </DialogHeader>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
