'use client'

import { useMemo, useState } from 'react'
import {
  createCard,
  createCardItem,
  deleteCard,
  deleteCardItem,
  setCardActive,
  updateCard,
  updateCardItem,
  useCardItems,
  useCards,
} from '@/hooks/use-finance-data'
import type { Card, CardItem, Currency } from '@/lib/types'
import {
  cardItemsForMonth,
  cardMonthTotal,
  installmentEndMonth,
} from '@/lib/card-billing'
import { cn, formatCurrency, formatMonthLabel, toMonthKey } from '@/lib/utils'
import { Card as UiCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Archive, ArchiveRestore, ChevronDown, CircleHelp, CreditCard, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

type ItemDialogMode = 'installment' | 'debit'

function LabelWithTip({
  children,
  tip,
  className,
}: {
  children: React.ReactNode
  tip: string
  className?: string
}) {
  return (
    <span className={className ?? 'inline-flex items-center gap-1 text-sm font-medium'}>
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex text-muted-foreground hover:text-foreground"
            aria-label="Más info"
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left leading-snug">
          {tip}
        </TooltipContent>
      </Tooltip>
    </span>
  )
}

export function CardsView() {
  const { cards, isLoading: loadingCards, error: cardsError } = useCards()
  const { cardItems, isLoading: loadingItems } = useCardItems()
  const monthKey = toMonthKey()

  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [cardName, setCardName] = useState('')
  const [cardDueDay, setCardDueDay] = useState('10')
  const [savingCard, setSavingCard] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null)

  const [itemDialog, setItemDialog] = useState<{
    card: Card
    mode: ItemDialogMode
    editing?: CardItem
  } | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemAmount, setItemAmount] = useState('')
  const [itemCurrency, setItemCurrency] = useState<Currency>('ARS')
  const [itemStart, setItemStart] = useState(monthKey)
  const [itemInstallments, setItemInstallments] = useState('3')
  const [itemEnd, setItemEnd] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [openCardIds, setOpenCardIds] = useState<Record<string, boolean>>({})

  const itemsByCard = useMemo(() => {
    const map = new Map<string, CardItem[]>()
    for (const item of cardItems) {
      const list = map.get(item.card_id) || []
      list.push(item)
      map.set(item.card_id, list)
    }
    return map
  }, [cardItems])

  const activeCards = useMemo(
    () => cards.filter((card) => card.is_active !== false),
    [cards],
  )
  const archivedCards = useMemo(
    () => cards.filter((card) => card.is_active === false),
    [cards],
  )

  const handleArchive = async (id: string) => {
    try {
      await setCardActive(id, false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo archivar')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await setCardActive(id, true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo restaurar')
    }
  }

  const openCreateCard = () => {
    setEditingCard(null)
    setCardName('')
    setCardDueDay('10')
    setCardError(null)
    setCardDialogOpen(true)
  }

  const openEditCard = (card: Card) => {
    setEditingCard(card)
    setCardName(card.name)
    setCardDueDay(String(card.due_day))
    setCardError(null)
    setCardDialogOpen(true)
  }

  const handleSaveCard = async () => {
    if (!cardName.trim()) {
      setCardError('Poné un nombre')
      return
    }
    setSavingCard(true)
    setCardError(null)
    try {
      const payload = { name: cardName.trim(), due_day: parseInt(cardDueDay, 10) || 10 }
      if (editingCard) await updateCard(editingCard.id, payload)
      else await createCard(payload)
      setCardDialogOpen(false)
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSavingCard(false)
    }
  }

  const openItemDialog = (card: Card, mode: ItemDialogMode, editing?: CardItem) => {
    setItemDialog({ card, mode, editing })
    setItemError(null)
    if (editing) {
      setItemName(editing.name)
      setItemAmount(String(editing.amount))
      setItemCurrency(editing.currency)
      setItemStart(editing.start_month_key)
      setItemInstallments(String(editing.installments || 1))
      setItemEnd(editing.end_month_key || '')
    } else {
      setItemName('')
      setItemAmount('')
      setItemCurrency('ARS')
      setItemStart(monthKey)
      setItemInstallments(mode === 'installment' ? '3' : '1')
      setItemEnd('')
    }
  }

  const handleSaveItem = async () => {
    if (!itemDialog) return
    if (!itemName.trim()) {
      setItemError('Poné un nombre')
      return
    }
    const amount = parseFloat(itemAmount.replace(',', '.')) || 0
    if (amount <= 0) {
      setItemError('Monto inválido')
      return
    }
    setSavingItem(true)
    setItemError(null)
    try {
      if (itemDialog.editing) {
        await updateCardItem(itemDialog.editing.id, {
          name: itemName.trim(),
          amount,
          currency: itemCurrency,
          start_month_key: itemStart,
          installments:
            itemDialog.mode === 'installment' ? parseInt(itemInstallments, 10) || 1 : null,
          end_month_key: itemDialog.mode === 'debit' ? itemEnd || null : null,
        })
      } else {
        await createCardItem({
          card_id: itemDialog.card.id,
          kind: itemDialog.mode,
          name: itemName.trim(),
          amount,
          currency: itemCurrency,
          start_month_key: itemStart,
          installments:
            itemDialog.mode === 'installment' ? parseInt(itemInstallments, 10) || 1 : null,
          end_month_key: itemDialog.mode === 'debit' ? itemEnd || null : null,
        })
      }
      setItemDialog(null)
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSavingItem(false)
    }
  }

  if (loadingCards || loadingItems) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            Tarjetas
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-muted-foreground hover:text-foreground"
                  aria-label="Cómo cargar la tarjeta"
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-left leading-snug">
                Cargá todo por el mes de vencimiento (cuando lo pagás). El resumen que cierra en
                septiembre y vence en octubre va en octubre.
              </TooltipContent>
            </Tooltip>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuotas y débitos · total del mes en Fijos
          </p>
        </div>
        <Button onClick={openCreateCard} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Nueva tarjeta
        </Button>
      </div>

      {cardsError && (
        <UiCard className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-4 text-sm">
            Ejecutá en Supabase <code className="text-xs">scripts/007_cards.sql</code> y{' '}
            <code className="text-xs">scripts/009_archive_cards.sql</code> para crear
            las tablas de tarjetas.
          </CardContent>
        </UiCard>
      )}

      {activeCards.length === 0 && !cardsError ? (
        <UiCard className="border-border/50">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {archivedCards.length > 0
              ? 'No hay tarjetas activas. Restaurá una archivada o creá una nueva.'
              : 'Todavía no hay tarjetas. Creá una (solo el nombre) y cargá cuotas o débitos.'}
          </CardContent>
        </UiCard>
      ) : (
        <div className="space-y-4">
          {activeCards.map((card) => {
            const items = itemsByCard.get(card.id) || []
            const monthLines = cardItemsForMonth(items, monthKey)
            const ars = cardMonthTotal(items, monthKey, 'ARS')
            const usd = cardMonthTotal(items, monthKey, 'USD')
            const installments = items.filter((i) => i.kind === 'installment')
            const debits = items.filter((i) => i.kind === 'debit')

            return (
              <Collapsible
                key={card.id}
                open={openCardIds[card.id] === true}
                onOpenChange={(open) =>
                  setOpenCardIds((prev) => ({ ...prev, [card.id]: open }))
                }
              >
                <UiCard className="border-border/50 bg-card/50">
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-0">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start justify-between gap-3 p-6 pb-3 text-left"
                      >
                        <div className="min-w-0">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="h-5 w-5 shrink-0 text-primary" />
                            <span className="truncate">{card.name}</span>
                          </CardTitle>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                            <LabelWithTip
                              className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"
                              tip="Día en que vence el resumen y sale la plata del Disponible. No es el día de cierre."
                            >
                              Vence día {card.due_day}
                            </LabelWithTip>
                            <span>· A pagar este mes:</span>{' '}
                            {ars > 0 || usd > 0 ? (
                              <>
                                {ars > 0 && formatCurrency(ars, 'ARS')}
                                {ars > 0 && usd > 0 && ' · '}
                                {usd > 0 && formatCurrency(usd, 'USD')}
                              </>
                            ) : (
                              'sin cargos'
                            )}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                            openCardIds[card.id] && 'rotate-180',
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex shrink-0 gap-1 py-4 pr-4">
                      <Button variant="ghost" size="icon" onClick={() => openEditCard(card)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Archivar (conserva el historial)"
                        onClick={() => handleArchive(card.id)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500"
                        onClick={() => setDeletingCardId(card.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openItemDialog(card, 'installment')}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Compra en cuotas
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openItemDialog(card, 'debit')}>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Débito / suscripción
                        </Button>
                      </div>

                      {monthLines.length > 0 && (
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                          <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <LabelWithTip
                              className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                              tip="Lo que figura acá es lo que pagás este mes al vencer el resumen, no el mes en que compraste."
                            >
                              A pagar · {formatMonthLabel(monthKey)}
                            </LabelWithTip>
                          </p>
                          <ul className="space-y-1.5 text-sm">
                            {monthLines.map((line) => (
                              <li key={line.item.id} className="flex justify-between gap-3">
                                <span className="min-w-0 truncate">
                                  {line.item.name}
                                  {line.installmentLabel ? ` · ${line.installmentLabel}` : ''}
                                </span>
                                <span className="shrink-0 font-medium">
                                  {formatCurrency(line.amount, line.item.currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {installments.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Cuotas</p>
                          <ul className="space-y-2">
                            {installments.map((item) => {
                              const monthly = Number(item.amount) / (item.installments || 1)
                              const end = installmentEndMonth(
                                item.start_month_key,
                                item.installments || 1,
                              )
                              return (
                                <li
                                  key={item.id}
                                  className="flex items-start justify-between gap-2 rounded-lg border border-border/40 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatCurrency(Number(item.amount), item.currency)} en{' '}
                                      {item.installments} · {formatCurrency(monthly, item.currency)}
                                      /mes · pago {formatMonthLabel(item.start_month_key)} →{' '}
                                      {formatMonthLabel(end)}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openItemDialog(card, 'installment', item)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-500"
                                      onClick={() => setDeletingItemId(item.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}

                      {debits.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Débitos / suscripciones
                          </p>
                          <ul className="space-y-2">
                            {debits.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-start justify-between gap-2 rounded-lg border border-border/40 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatCurrency(Number(item.amount), item.currency)}/mes · pago desde{' '}
                                    {formatMonthLabel(item.start_month_key)}
                                    {item.end_month_key
                                      ? ` · hasta ${formatMonthLabel(item.end_month_key)}`
                                      : ' · sin fin'}
                                  </p>
                                </div>
                                <div className="flex shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openItemDialog(card, 'debit', item)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-500"
                                    onClick={() => setDeletingItemId(item.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {items.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Sin cuotas ni débitos todavía.
                        </p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </UiCard>
              </Collapsible>
            )
          })}
        </div>
      )}

      {archivedCards.length > 0 && (
        <UiCard className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4 text-muted-foreground" />
              Archivadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="mb-2 text-xs text-muted-foreground">
              No aparecen en Fijos ni en la lista activa. Cuotas, débitos y pagos se conservan.
            </p>
            {archivedCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-muted-foreground">{card.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Vence el día {card.due_day}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleRestore(card.id)}>
                    <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                    Restaurar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => setDeletingCardId(card.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </UiCard>
      )}

      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Editar tarjeta' : 'Nueva tarjeta'}</DialogTitle>
            <DialogDescription>Nombre y día de vencimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Visa Galicia"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <LabelWithTip tip="Día del vencimiento del resumen (cuando lo pagás). Ej.: cierre 27/8 y vencimiento 7/9 → día 7.">
                Día de vencimiento
              </LabelWithTip>
              <Input
                type="number"
                min={1}
                max={31}
                value={cardDueDay}
                onChange={(e) => setCardDueDay(e.target.value)}
              />
            </div>
            {cardError && <p className="text-sm text-red-500">{cardError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCard} disabled={savingCard} className="bg-primary hover:bg-primary/90">
              {savingCard && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(itemDialog)} onOpenChange={(open) => !open && setItemDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {itemDialog?.editing
                ? itemDialog.mode === 'installment'
                  ? 'Editar cuotas'
                  : 'Editar débito'
                : itemDialog?.mode === 'installment'
                  ? 'Compra en cuotas'
                  : 'Débito / suscripción'}
            </DialogTitle>
            <DialogDescription>
              {itemDialog?.mode === 'installment'
                ? 'Se prorratea el total mes a mes.'
                : 'Se suma cada mes de pago hasta el que indiques.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={itemDialog?.mode === 'installment' ? 'Sillón' : 'Netflix'}
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium">
                  {itemDialog?.mode === 'installment' ? 'Total' : 'Monto mensual'}
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={itemAmount}
                  onChange={(e) => setItemAmount(e.target.value)}
                  className="min-w-0"
                />
              </div>
              <div className="w-[5.5rem] space-y-2">
                <label className="text-sm font-medium">Moneda</label>
                <Select
                  value={itemCurrency}
                  onValueChange={(v: Currency) => setItemCurrency(v)}
                >
                  <SelectTrigger className="w-full">
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
              <LabelWithTip
                tip={
                  itemDialog?.mode === 'installment'
                    ? 'Mes en que pagás la 1ª cuota (vencimiento del resumen), no el mes de la compra. Si compraste en abril y la 1/6 vence en mayo, poné mayo.'
                    : 'Primer mes en que ese débito sale en el resumen que pagás.'
                }
              >
                {itemDialog?.mode === 'installment' ? 'Mes 1ª cuota' : 'Desde (pago)'}
              </LabelWithTip>
              <Input
                type="month"
                value={itemStart}
                onChange={(e) => setItemStart(e.target.value)}
                className="w-full min-w-0"
              />
            </div>
            {itemDialog?.mode === 'installment' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Cuotas</label>
                <Input
                  type="number"
                  min={1}
                  value={itemInstallments}
                  onChange={(e) => setItemInstallments(e.target.value)}
                  className="w-full sm:max-w-[8rem]"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <LabelWithTip tip="Último mes de pago inclusive. Vacío = sigue siempre. Para dar de baja Netflix en abril, poné hasta marzo.">
                  Hasta (pago)
                </LabelWithTip>
                <Input
                  type="month"
                  value={itemEnd}
                  onChange={(e) => setItemEnd(e.target.value)}
                  className="w-full min-w-0"
                />
              </div>
            )}
            {itemError && <p className="text-sm text-red-500">{itemError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setItemDialog(null)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={savingItem}
              className="w-full bg-primary hover:bg-primary/90 sm:w-auto"
            >
              {savingItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingCardId)} onOpenChange={(o) => !o && setDeletingCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tarjeta</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran cuotas, débitos y pagos de resumen. Si solo querés dejar de usarla, archivála.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={async () => {
                if (!deletingCardId) return
                await deleteCard(deletingCardId)
                setDeletingCardId(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingItemId)} onOpenChange={(o) => !o && setDeletingItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ítem</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de contar en los resúmenes futuros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={async () => {
                if (!deletingItemId) return
                await deleteCardItem(deletingItemId)
                setDeletingItemId(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
