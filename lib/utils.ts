import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Clave de mes YYYY-MM */
export function toMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/** Toma YYYY-MM de una fecha ISO o Date, sin corrimiento de huso */
export function dateToMonthKey(date: string | Date): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}/.test(date)) return date.slice(0, 7)
  return toMonthKey(typeof date === 'string' ? new Date(date) : date)
}

/** Etiqueta legible: "julio 2026" */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

/** Suma o resta meses a una clave YYYY-MM */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return toMonthKey(date)
}

/** Fecha de vencimiento para un mes dado (día + monthKey) */
export function dueDateForMonth(dueDay: number, monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(dueDay, lastDay))
}

export function formatDueDateLabel(dueDay: number, monthKey: string): string {
  return dueDateForMonth(dueDay, monthKey).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
}
