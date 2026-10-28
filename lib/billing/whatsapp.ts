import type { BillingClient, BillingInvoice } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { monthLabel } from '@/lib/billing/shared'

export interface PaymentInfo {
  aliasArs: string | null
  aliasUsd: string | null
  holder: string | null
}

function formatDate(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Número para wa.me: solo dígitos y con 549 si parece un celular argentino de 10 dígitos. */
export function whatsappNumber(raw: string) {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('54')) digits = digits.slice(2)
  if (digits.startsWith('9')) digits = digits.slice(1)
  digits = digits.replace(/^0/, '')
  return digits.length === 10 ? `549${digits}` : raw.replace(/\D/g, '')
}

export function buildWhatsappMessage(invoice: BillingInvoice, client: BillingClient, pay: PaymentInfo) {
  const lines = [
    `Hola ${client.name}! Este es un mensaje automático de recordatorio de Coco Soft.`,
    '',
    `Liquidación de ${monthLabel(invoice.month_key)}:`,
    ...(invoice.line_items ?? []).map((item) => `• ${item.concept}: ${formatCurrency(Number(item.amount), invoice.currency)}`),
    `*Total: ${formatCurrency(Number(invoice.amount), invoice.currency)}*`,
    `Vence el ${formatDate(invoice.due_date)}.`,
  ]

  const methods = [
    pay.aliasArs ? `• Pesos (ARS): ${pay.aliasArs}` : null,
    pay.aliasUsd ? `• Dólares (USD): ${pay.aliasUsd}` : null,
  ].filter((line): line is string => Boolean(line))
  if (methods.length) {
    lines.push('', 'Datos para transferir:', ...methods)
    if (pay.holder) lines.push(`Titular: ${pay.holder}`)
  }

  lines.push('', 'Si ya lo abonaste, ignorá este mensaje. ¡Gracias!')
  return lines.join('\n')
}

export function buildWhatsappUrl(invoice: BillingInvoice, client: BillingClient, pay: PaymentInfo) {
  const number = whatsappNumber(client.whatsapp ?? '')
  return `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsappMessage(invoice, client, pay))}`
}
