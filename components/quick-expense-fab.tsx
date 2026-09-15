'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addMonthlyIncome,
  createTransaction,
  getWallet,
  useIncomeSources,
  useTransactions,
} from '@/hooks/use-finance-data'
import { CATEGORIES, type Currency, type IncomeSource } from '@/lib/types'
import { toMonthKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { CategoryPicker, mergeCategories } from '@/components/category-picker'
import { Loader2, Minus, Plus } from 'lucide-react'

type Mode = 'income' | 'expense'

export function QuickCashFab() {
  const { incomeSources } = useIncomeSources()
  const { transactions } = useTransactions()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Comida')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [source, setSource] = useState<IncomeSource | null>(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeSources = useMemo(
    () => incomeSources.filter((item) => item.is_active !== false),
    [incomeSources],
  )

  const recentCategories = useMemo(() => {
    const names = transactions
      .filter((tx) => tx.type === 'expense')
      .slice(0, 20)
      .map((tx) => tx.category)
    return mergeCategories(CATEGORIES.expense, names).slice(0, 8)
  }, [transactions])

  useEffect(() => {
    if (!open) return
    if (mode === 'income' && !source && activeSources[0]) {
      setSource(activeSources[0])
    }
  }, [open, mode, source, activeSources])

  const openSheet = () => {
    setAmount('')
    setDescription('')
    setCategory(recentCategories[0] || 'Comida')
    setCurrency('ARS')
    setMode('expense')
    setSource(activeSources[0] ?? null)
    setError(null)
    setOpen(true)
  }

  const handleSave = async () => {
    const value = parseFloat(amount.replace(',', '.')) || 0
    if (value <= 0) {
      setError('Ingresá un monto')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (mode === 'income') {
        if (!source) {
          setError('Elegí de qué sueldo o fuente viene')
          setSaving(false)
          return
        }
        const wallet = await getWallet('available', source.currency)
        await addMonthlyIncome({
          income_source_id: source.id,
          source_name: source.name,
          month_key: toMonthKey(),
          amount: value,
          currency: source.currency,
          account_id: wallet.id,
          notes: description.trim() || null,
        })
      } else {
        const wallet = await getWallet('available', currency)
        await createTransaction({
          type: 'expense',
          amount: value,
          currency,
          category: category.trim() || 'Otros',
          description: description.trim() || category.trim() || 'Gasto del día',
          date: new Date().toISOString().split('T')[0],
          is_paid: true,
          account_id: wallet.id,
          credit_card_id: null,
          source: 'manual',
        })
      }
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {open ? null : (
        <Button
          type="button"
          onClick={openSheet}
          className="fixed z-40 h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-lg right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-6 md:right-6"
          aria-label="Agregar movimiento"
        >
          <Plus className="h-7 w-7" />
        </Button>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto flex h-auto max-h-[90dvh] w-full max-w-lg flex-col">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle>Nuevo movimiento</DrawerTitle>
            <DrawerDescription>
              {mode === 'income'
                ? 'Suma al disponible y queda en el flujo de caja.'
                : 'Se descuenta del disponible.'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 max-h-[calc(90dvh-12rem)]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('income')
                  setError(null)
                }}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${
                  mode === 'income'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <Plus className="h-4 w-4" />
                Ingreso
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('expense')
                  setError(null)
                }}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${
                  mode === 'expense'
                    ? 'border-red-500 bg-red-500/15 text-red-400'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <Minus className="h-4 w-4" />
                Gasto
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cuánto</label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-14 text-2xl font-semibold"
              />
            </div>

            {mode === 'income' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">De qué fuente</label>
                {activeSources.length === 0 ? (
                  <p className="text-sm text-amber-400">
                    Primero creá una fuente en Ingresos (Sueldo STP, Sueldo FW, etc.).
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeSources.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSource(item)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium border ${
                          source?.id === item.id
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {item.name} · {item.currency}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Moneda</label>
                  <div className="flex gap-2">
                    {(['ARS', 'USD'] as Currency[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrency(item)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium border ${
                          currency === item
                            ? 'border-red-500 bg-red-500/15 text-red-400'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Qué fue</label>
                  <div className="flex flex-wrap gap-2">
                    {recentCategories.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCategory(item)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium border ${
                          category === item
                            ? 'border-red-500 bg-red-500/15 text-red-400'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <CategoryPicker value={category} onChange={setCategory} options={recentCategories} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Nota (opcional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={mode === 'income' ? 'Ej: primera quincena' : 'Ej: almuerzo, uber'}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
          <DrawerFooter className="shrink-0 border-t border-border/40 bg-background pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              onClick={handleSave}
              disabled={saving || !amount || (mode === 'income' && activeSources.length === 0)}
              className={
                mode === 'income'
                  ? 'h-12 w-full bg-emerald-500 hover:bg-emerald-600'
                  : 'h-12 w-full bg-red-500 hover:bg-red-600'
              }
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {mode === 'income' ? 'Sumar cobro' : 'Guardar gasto'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
