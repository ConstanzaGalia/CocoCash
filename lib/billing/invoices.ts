import type { createAdminClient } from '@/lib/supabase/admin'
import type { BillingClient, BillingLineItem, BillingPlan } from '@/lib/types'
import { fetchBlueRate, type FxQuote } from '@/lib/billing/fx'
import {
  addDays,
  argentinaToday,
  clientMonthlyParts,
  monthLabel,
  roundMoney,
} from '@/lib/billing/shared'

type Admin = ReturnType<typeof createAdminClient>

function formatArDate(date: string) {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

export type ActionResult = { client: string; action: string; detail?: string }

export async function loadPlansById(admin: Admin, userId: string) {
  const { data, error } = await admin.from('billing_plans').select('*').eq('user_id', userId)
  if (error) throw error
  return new Map(((data ?? []) as BillingPlan[]).map((plan) => [plan.id, plan]))
}

export async function loadActiveClients(admin: Admin, userId: string) {
  const { data, error } = await admin
    .from('billing_clients')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) throw error
  return (data ?? []) as BillingClient[]
}

/**
 * Genera la liquidación del mes para los clientes cuyo billing_day es hoy.
 * No manda nada: el aviso al cliente se hace a mano por WhatsApp desde la app.
 */
export async function issueDueInvoices(admin: Admin, userId: string, dry: boolean) {
  const today = argentinaToday()
  const [clients, plans] = await Promise.all([loadActiveClients(admin, userId), loadPlansById(admin, userId)])
  const results: ActionResult[] = []
  let fxQuote: FxQuote | null = null

  for (const client of clients) {
    if (client.billing_day !== today.day) continue

    if (client.paid_until_month_key && client.paid_until_month_key >= today.monthKey) {
      results.push({ client: client.name, action: 'omitido', detail: `pagado hasta ${client.paid_until_month_key}` })
      continue
    }

    const plan = client.plan_id ? plans.get(client.plan_id) : null
    const parts = clientMonthlyParts(client, plan)
    if (parts.ars <= 0 && parts.usd <= 0) {
      results.push({ client: client.name, action: 'omitido', detail: 'sin monto (plan o monto propio)' })
      continue
    }

    // La cotización se consulta una sola vez por corrida y solo si algún cliente tiene USD
    let fx: FxQuote | null = null
    if (parts.usd > 0) {
      fxQuote ??= await fetchBlueRate()
      fx = fxQuote
    }

    const planLabel = plan ? ` - plan ${plan.name}` : ''
    const lineItems: BillingLineItem[] = []
    if (parts.ars > 0) {
      lineItems.push({
        concept: `Servicio mensual${planLabel} (hosting, base de datos y mantenimiento) - ${monthLabel(today.monthKey)}`,
        amount: parts.ars,
      })
    }
    const usdInArs = fx ? roundMoney(parts.usd * fx.rate) : 0
    if (fx) {
      lineItems.push({
        concept: `Servicio en dólares: USD ${parts.usd} x ${fx.source === 'blue' ? 'dólar blue' : 'cotización de referencia'} $${fx.rate} (${formatArDate(today.date)})`,
        amount: usdInArs,
      })
    }
    const amount = roundMoney(parts.ars + usdInArs)
    // Con componente en USD la liquidación se emite en pesos
    const currency = fx ? 'ARS' : client.currency
    const dueDate = addDays(today.date, client.due_days)

    if (dry) {
      const { data: existing } = await admin
        .from('billing_invoices')
        .select('id')
        .eq('client_id', client.id)
        .eq('month_key', today.monthKey)
        .maybeSingle()
      results.push({
        client: client.name,
        action: existing ? 'omitido' : 'generaría',
        detail: existing ? 'ya existe la liquidación del mes' : `${amount} ${currency}${fx ? ` (USD ${parts.usd} a $${fx.rate})` : ''}, vence ${dueDate}`,
      })
      continue
    }

    const { error } = await admin
      .from('billing_invoices')
      .insert({
        user_id: userId,
        client_id: client.id,
        month_key: today.monthKey,
        amount,
        currency,
        status: 'sent',
        sent_at: new Date().toISOString(),
        due_date: dueDate,
        line_items: lineItems,
        usd_amount: fx ? parts.usd : null,
        fx_rate: fx?.rate ?? null,
        fx_source: fx?.source ?? null,
      })

    if (error) {
      if (error.code === '23505') {
        results.push({ client: client.name, action: 'omitido', detail: 'ya existe la liquidación del mes' })
        continue
      }
      throw error
    }

    results.push({ client: client.name, action: 'generada', detail: `${amount} ${currency}, vence ${dueDate}` })
  }

  return { today: today.date, results }
}
