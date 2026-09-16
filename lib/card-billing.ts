import type { CardItem, Currency } from '@/lib/types'
import { shiftMonthKey } from '@/lib/utils'

/** Diferencia en meses: end - start (0 si mismo mes). */
export function monthsBetween(startMonthKey: string, endMonthKey: string): number {
  const [sy, sm] = startMonthKey.split('-').map(Number)
  const [ey, em] = endMonthKey.split('-').map(Number)
  return (ey - sy) * 12 + (em - sm)
}

export type CardMonthLine = {
  item: CardItem
  amount: number
  /** Para cuotas: "2/6" */
  installmentLabel?: string
}

/** Monto de un ítem que cae en un mes (0 si no aplica). */
export function cardItemAmountForMonth(item: CardItem, monthKey: string): CardMonthLine | null {
  if (item.kind === 'installment') {
    const count = item.installments ?? 0
    if (count < 1) return null
    const index = monthsBetween(item.start_month_key, monthKey)
    if (index < 0 || index >= count) return null
    const amount = Number(item.amount) / count
    return {
      item,
      amount,
      installmentLabel: `${index + 1}/${count}`,
    }
  }

  // débito: desde start inclusive hasta end inclusive (null = sin fin)
  if (monthKey < item.start_month_key) return null
  if (item.end_month_key && monthKey > item.end_month_key) return null
  return { item, amount: Number(item.amount) }
}

export function cardItemsForMonth(items: CardItem[], monthKey: string, currency?: Currency) {
  return items
    .filter((item) => (currency ? item.currency === currency : true))
    .map((item) => cardItemAmountForMonth(item, monthKey))
    .filter((line): line is CardMonthLine => line !== null && line.amount > 0)
}

export function cardMonthTotal(items: CardItem[], monthKey: string, currency: Currency): number {
  return cardItemsForMonth(items, monthKey, currency).reduce((sum, line) => sum + line.amount, 0)
}

/** Monedas con algo a pagar en el mes para una tarjeta. */
export function currenciesWithBalance(items: CardItem[], monthKey: string): Currency[] {
  const totals: Record<Currency, number> = { ARS: 0, USD: 0 }
  for (const line of cardItemsForMonth(items, monthKey)) {
    totals[line.item.currency] += line.amount
  }
  return (['ARS', 'USD'] as Currency[]).filter((c) => totals[c] > 0)
}

/** Último mes de una compra en cuotas. */
export function installmentEndMonth(startMonthKey: string, installments: number): string {
  return shiftMonthKey(startMonthKey, Math.max(installments, 1) - 1)
}
