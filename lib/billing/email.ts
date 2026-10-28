import type { BillingLineItem, Currency } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { monthLabel } from '@/lib/billing/shared'

export type BillingEmailKind =
  | 'issued'
  | 'pre_due'
  | 'due'
  | 'overdue_5'
  | 'overdue_12'
  | 'renewal_notice'

export interface InvoiceEmailData {
  clientName: string
  monthKey: string
  amount: number
  currency: Currency
  dueDate: string
  lineItems: BillingLineItem[]
  /** Días de atraso (solo overdue_*). */
  daysOverdue?: number
}

export interface RenewalEmailData {
  clientName: string
  paidUntilMonthKey: string
  amount: number | null
  /** Parte en USD, se convierte al dólar blue del día de la liquidación. */
  usdAmount?: number | null
  currency: Currency
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(date: string) {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

function paymentLines() {
  const alias = process.env.BILLING_PAYMENT_ALIAS
  const holder = process.env.BILLING_PAYMENT_HOLDER
  const lines: string[] = []
  if (alias) lines.push(`Alias: ${alias}`)
  if (holder) lines.push(`Titular: ${holder}`)
  return lines
}

interface Message {
  subject: string
  intro: string
  closing: string
  rows: BillingLineItem[]
  total?: { label: string; amount: number; currency: Currency }
  extra?: string[]
}

function renderMessage(m: Message) {
  const pay = paymentLines()
  const text = [
    m.intro,
    '',
    ...m.rows.map((r) => `- ${r.concept}: ${formatCurrency(r.amount, m.total?.currency)}`),
    ...(m.total ? ['', `${m.total.label}: ${formatCurrency(m.total.amount, m.total.currency)}`] : []),
    ...(m.extra ?? []),
    ...(pay.length ? ['', 'Datos para transferir:', ...pay] : []),
    '',
    m.closing,
    'Coco Soft',
  ].join('\n')

  const rowsHtml = m.rows
    .map(
      (r) =>
        `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(r.concept)}</td><td style="padding:4px 0;text-align:right">${formatCurrency(r.amount, m.total?.currency)}</td></tr>`,
    )
    .join('')
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:520px">
<p>${escapeHtml(m.intro)}</p>
${m.rows.length ? `<table style="border-collapse:collapse;width:100%">${rowsHtml}</table>` : ''}
${m.total ? `<p><strong>${escapeHtml(m.total.label)}: ${formatCurrency(m.total.amount, m.total.currency)}</strong></p>` : ''}
${(m.extra ?? []).map((l) => `<p>${escapeHtml(l)}</p>`).join('')}
${pay.length ? `<p>Datos para transferir:<br>${pay.map(escapeHtml).join('<br>')}</p>` : ''}
<p>${escapeHtml(m.closing)}<br>Coco Soft</p>
</div>`

  return { subject: m.subject, text, html }
}

export function buildInvoiceEmail(kind: Exclude<BillingEmailKind, 'renewal_notice'>, d: InvoiceEmailData) {
  const month = monthLabel(d.monthKey)
  const base = {
    rows: d.lineItems,
    total: { label: 'Total', amount: d.amount, currency: d.currency },
  }
  const due = formatDate(d.dueDate)

  switch (kind) {
    case 'issued':
      return renderMessage({
        ...base,
        subject: `Liquidación de ${month} - Coco Soft`,
        intro: `Hola ${d.clientName}, te dejamos la liquidación de ${month}. Vence el ${due}.`,
        closing: 'Cualquier duda, escribinos. ¡Gracias!',
      })
    case 'pre_due':
      return renderMessage({
        ...base,
        subject: `Recordatorio: la liquidación de ${month} vence el ${due}`,
        intro: `Hola ${d.clientName}, te recordamos que la liquidación de ${month} vence el ${due}.`,
        closing: 'Si ya la abonaste, ignorá este mensaje. ¡Gracias!',
      })
    case 'due':
      return renderMessage({
        ...base,
        subject: `Hoy vence la liquidación de ${month}`,
        intro: `Hola ${d.clientName}, hoy vence la liquidación de ${month}.`,
        closing: 'Si ya la abonaste, avisanos y la registramos. ¡Gracias!',
      })
    case 'overdue_5':
    case 'overdue_12':
      return renderMessage({
        ...base,
        subject: `Liquidación de ${month} vencida`,
        intro: `Hola ${d.clientName}, la liquidación de ${month} venció el ${due} y figura impaga (${d.daysOverdue ?? ''} días de atraso).`,
        extra: [
          kind === 'overdue_12'
            ? 'Necesitamos regularizarla a la brevedad para no afectar la continuidad del servicio.'
            : 'Por favor regularizala o avisanos si hay algún inconveniente.',
        ],
        closing: 'Si ya la abonaste, enviános el comprobante. ¡Gracias!',
      })
  }
}

export function buildRenewalEmail(d: RenewalEmailData) {
  const until = monthLabel(d.paidUntilMonthKey)
  return renderMessage({
    subject: 'Aviso de renovación - Coco Soft',
    intro: `Hola ${d.clientName}, tu período pagado llega hasta ${until}.`,
    rows: [],
    extra: [
      d.amount != null || d.usdAmount
        ? `Para renovar, el monto mensual del servicio es ${[
            d.amount != null ? formatCurrency(d.amount, d.currency) : null,
            d.usdAmount ? `USD ${d.usdAmount} al dólar blue del día` : null,
          ]
            .filter(Boolean)
            .join(' + ')}. Escribinos y coordinamos la renovación.`
        : 'Escribinos y coordinamos la renovación.',
    ],
    closing: '¡Gracias por seguir confiando en nosotros!',
  })
}

export async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.BILLING_FROM_EMAIL
  if (!apiKey || !from) throw new Error('Faltan RESEND_API_KEY o BILLING_FROM_EMAIL')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text, html: input.html }),
  })
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`)
  }
}

export async function sendOwnerUsageAlert(
  rows: { name: string; plan: string | null; diskMb: number; limitMb: number }[],
) {
  const to = process.env.BILLING_OWNER_EMAIL
  if (!to) throw new Error('Falta BILLING_OWNER_EMAIL')
  const lines = rows.map(
    (r) =>
      `- ${r.name}${r.plan ? ` (plan ${r.plan})` : ''}: ${r.diskMb.toFixed(0)} MB de ${r.limitMb} MB incluidos`,
  )
  const text = ['Estos clientes superaron el disco incluido en su plan:', '', ...lines, '', 'Evaluá subirlos de plan.'].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px"><p>Estos clientes superaron el disco incluido en su plan:</p><ul>${lines
    .map((l) => `<li>${escapeHtml(l.slice(2))}</li>`)
    .join('')}</ul><p>Evaluá subirlos de plan.</p></div>`
  await sendEmail({ to, subject: 'Coco Soft: clientes pasados del uso incluido', text, html })
}
