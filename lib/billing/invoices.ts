import type { createAdminClient } from '@/lib/supabase/admin'
import type {
  BillingClient,
  BillingInvoice,
  BillingLineItem,
  BillingPlan,
} from '@/lib/types'
import {
  buildInvoiceEmail,
  buildRenewalEmail,
  sendEmail,
  type BillingEmailKind,
} from '@/lib/billing/email'
import { fetchBlueRate, type FxQuote } from '@/lib/billing/fx'
import {
  addDays,
  argentinaToday,
  clientMonthlyParts,
  roundMoney,
  daysBetween,
  errorMessage,
  lastDayOfMonth,
  monthLabel,
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
 * Registra el recordatorio antes de mandar el mail: si dos ejecuciones corren a la vez,
 * solo una lo consigue (índice único). Devuelve false si ya estaba registrado.
 */
async function claimReminder(
  admin: Admin,
  userId: string,
  target: { invoiceId?: string; clientId?: string },
  kind: string,
) {
  const { error } = await admin.from('billing_reminders').insert({
    user_id: userId,
    invoice_id: target.invoiceId ?? null,
    client_id: target.clientId ?? null,
    kind,
  })
  if (!error) return true
  if (error.code === '23505') return false
  throw error
}

async function releaseReminder(
  admin: Admin,
  target: { invoiceId?: string; clientId?: string },
  kind: string,
) {
  const query = admin.from('billing_reminders').delete().eq('kind', kind)
  await (target.invoiceId
    ? query.eq('invoice_id', target.invoiceId)
    : query.eq('client_id', target.clientId!))
}

export function invoiceEmailParams(invoice: BillingInvoice, client: BillingClient, today: string) {
  return {
    clientName: client.name,
    monthKey: invoice.month_key,
    amount: Number(invoice.amount),
    currency: invoice.currency,
    dueDate: invoice.due_date,
    lineItems: invoice.line_items ?? [],
    daysOverdue: Math.max(0, daysBetween(invoice.due_date, today)),
  }
}

/** Envía un recordatorio de liquidación una sola vez por tipo. */
export async function sendInvoiceReminder(
  admin: Admin,
  userId: string,
  invoice: BillingInvoice,
  client: BillingClient,
  kind: Exclude<BillingEmailKind, 'renewal_notice'>,
): Promise<{ sent: boolean; error?: string }> {
  const fail = async (message: string) => {
    if (kind === 'issued') {
      await admin
        .from('billing_invoices')
        .update({ send_error: message, updated_at: new Date().toISOString() })
        .eq('id', invoice.id)
    }
    return { sent: false, error: message }
  }

  if (!client.email) return fail('El cliente no tiene email')

  const target = { invoiceId: invoice.id }
  if (!(await claimReminder(admin, userId, target, kind))) return { sent: false }

  try {
    const mail = buildInvoiceEmail(kind, invoiceEmailParams(invoice, client, argentinaToday().date))
    await sendEmail({ to: client.email, ...mail })
  } catch (error) {
    await releaseReminder(admin, target, kind)
    return fail(errorMessage(error))
  }

  if (kind === 'issued') {
    const now = new Date().toISOString()
    await admin
      .from('billing_invoices')
      .update({ sent_at: now, send_error: null, updated_at: now })
      .eq('id', invoice.id)
  }
  return { sent: true }
}

/** Reenvío manual desde la app: no consulta ni registra recordatorios. */
export async function resendInvoiceEmail(
  admin: Admin,
  invoice: BillingInvoice,
  client: BillingClient,
) {
  if (!client.email) throw new Error('El cliente no tiene email')
  const today = argentinaToday().date
  const overdue = invoice.due_date < today
  const mail = buildInvoiceEmail(overdue ? 'overdue_5' : 'issued', invoiceEmailParams(invoice, client, today))
  await sendEmail({ to: client.email, ...mail })
  const now = new Date().toISOString()
  await admin
    .from('billing_invoices')
    .update({ sent_at: invoice.sent_at ?? now, send_error: null, updated_at: now })
    .eq('id', invoice.id)
}

/** Genera la liquidación del mes para los clientes cuyo billing_day es hoy. */
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
        detail: existing ? 'ya existe la liquidación del mes' : `${amount} ${currency}${fx ? ` (USD ${parts.usd} a $${fx.rate})` : ''}, vence ${dueDate}${client.email ? '' : ' (sin email: no se enviaría)'}`,
      })
      continue
    }

    const { data: invoice, error } = await admin
      .from('billing_invoices')
      .insert({
        user_id: userId,
        client_id: client.id,
        month_key: today.monthKey,
        amount,
        currency,
        status: 'sent',
        due_date: dueDate,
        line_items: lineItems,
        usd_amount: fx ? parts.usd : null,
        fx_rate: fx?.rate ?? null,
        fx_source: fx?.source ?? null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        results.push({ client: client.name, action: 'omitido', detail: 'ya existe la liquidación del mes' })
        continue
      }
      throw error
    }

    const mail = await sendInvoiceReminder(admin, userId, invoice as BillingInvoice, client, 'issued')
    results.push({
      client: client.name,
      action: 'generada',
      detail: mail.sent ? 'mail enviado' : `sin mail: ${mail.error ?? 'ya registrado'}`,
    })
  }

  return { today: today.date, results }
}

/** Tipo de recordatorio que corresponde hoy según el vencimiento (uno solo por ejecución). */
export function reminderKindFor(invoice: BillingInvoice, today: string) {
  const daysToDue = daysBetween(today, invoice.due_date)
  const overdue = -daysToDue
  if (overdue >= 12) return 'overdue_12' as const
  if (overdue >= 5) return 'overdue_5' as const
  if (daysToDue <= 0) return 'due' as const
  const issuedToday = invoice.sent_at?.slice(0, 10) === today
  if (daysToDue <= 3 && !issuedToday) return 'pre_due' as const
  return null
}

export async function sendDueReminders(admin: Admin, userId: string, dry: boolean) {
  const today = argentinaToday()
  const [clients, { data: invoices, error }] = await Promise.all([
    loadActiveClients(admin, userId),
    admin.from('billing_invoices').select('*').eq('user_id', userId).eq('status', 'sent'),
  ])
  if (error) throw error

  const clientsById = new Map(clients.map((c) => [c.id, c]))
  const [{ data: sentKinds }, plans] = await Promise.all([
    admin.from('billing_reminders').select('invoice_id, client_id, kind').eq('user_id', userId),
    loadPlansById(admin, userId),
  ])
  const already = new Set((sentKinds ?? []).map((r) => `${r.invoice_id ?? r.client_id}:${r.kind}`))
  const results: ActionResult[] = []

  for (const invoice of (invoices ?? []) as BillingInvoice[]) {
    const client = clientsById.get(invoice.client_id)
    if (!client) continue

    // La liquidación nunca llegó a salir (sin email o falló el envío): se reintenta
    const kind = invoice.sent_at ? reminderKindFor(invoice, today.date) : 'issued'
    if (!kind || already.has(`${invoice.id}:${kind}`)) continue

    if (dry) {
      results.push({ client: client.name, action: 'enviaría', detail: `${kind} (${invoice.month_key})${client.email ? '' : ' - sin email'}` })
      continue
    }
    const mail = await sendInvoiceReminder(admin, userId, invoice, client, kind)
    results.push({
      client: client.name,
      action: mail.sent ? 'enviado' : 'sin enviar',
      detail: `${kind} (${invoice.month_key})${mail.error ? `: ${mail.error}` : ''}`,
    })
  }

  // Aviso de renovación ~15 días antes de que termine el período pagado
  for (const client of clients) {
    if (!client.paid_until_month_key) continue
    const periodEnd = lastDayOfMonth(client.paid_until_month_key)
    const daysLeft = daysBetween(today.date, periodEnd)
    if (daysLeft < 0 || daysLeft > 15) continue

    const kind = `renewal_notice:${client.paid_until_month_key}`
    if (already.has(`${client.id}:${kind}`)) continue

    if (dry) {
      results.push({ client: client.name, action: 'enviaría', detail: `${kind}${client.email ? '' : ' - sin email'}` })
      continue
    }
    if (!client.email) {
      results.push({ client: client.name, action: 'sin enviar', detail: `${kind}: el cliente no tiene email` })
      continue
    }
    const target = { clientId: client.id }
    if (!(await claimReminder(admin, userId, target, kind))) continue
    try {
      const plan = client.plan_id ? plans.get(client.plan_id) : null
      const parts = clientMonthlyParts(client, plan)
      const mail = buildRenewalEmail({
        clientName: client.name,
        paidUntilMonthKey: client.paid_until_month_key,
        amount: parts.ars > 0 ? parts.ars : null,
        usdAmount: parts.usd > 0 ? parts.usd : null,
        currency: client.currency,
      })
      await sendEmail({ to: client.email, ...mail })
      results.push({ client: client.name, action: 'enviado', detail: kind })
    } catch (error) {
      await releaseReminder(admin, target, kind)
      results.push({ client: client.name, action: 'sin enviar', detail: `${kind}: ${errorMessage(error)}` })
    }
  }

  return { today: today.date, results }
}
