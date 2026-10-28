import type { BillingClient, BillingPlan } from '@/lib/types'

const AR_TZ = 'America/Argentina/Buenos_Aires'

/** Fecha de hoy en Argentina (los crons de Vercel corren en UTC). */
export function argentinaToday(now: Date = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return { date, monthKey: date.slice(0, 7), day: Number(date.slice(8, 10)) }
}

function toUtcMs(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(date: string, days: number) {
  return new Date(toUtcMs(date) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Días de `a` a `b` (positivo si b es posterior). */
export function daysBetween(a: string, b: string) {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000)
}

/** Último día del mes YYYY-MM como YYYY-MM-DD. */
export function lastDayOfMonth(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Montos mensuales: cada parte (ARS y USD) usa el override del cliente o, si no hay, el del plan. */
export function clientMonthlyParts(client: BillingClient, plan: BillingPlan | null | undefined) {
  const ars = client.monthly_amount_override ?? plan?.monthly_amount ?? 0
  const usd = client.usd_amount_override ?? plan?.usd_amount ?? 0
  return { ars: Number(ars), usd: Number(usd) }
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function getOwnerUserId() {
  const id = process.env.BILLING_OWNER_USER_ID
  if (!id) throw new Error('Falta BILLING_OWNER_USER_ID')
  return id
}

/** true solo para el usuario configurado en BILLING_OWNER_USER_ID. */
export function isBillingOwner(userId: string | null | undefined) {
  const owner = process.env.BILLING_OWNER_USER_ID
  return Boolean(userId && owner && userId === owner)
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
