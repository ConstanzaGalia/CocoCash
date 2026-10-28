import type { createAdminClient } from '@/lib/supabase/admin'
import type { BillingInvoice, Transaction } from '@/lib/types'

type Admin = ReturnType<typeof createAdminClient>

export type ReconcileResult = {
  invoiceId: string
  month_key: string
  action: 'conciliada' | 'conciliaría' | 'manual'
  transactionId?: string
  reason?: string
}

/**
 * Marca como pagadas las liquidaciones `sent` que tienen exactamente un ingreso de
 * Mercado Pago con el mismo monto, posterior al envío y aún sin vincular.
 * Es conservadora: si hay dudas (varios candidatos o varias liquidaciones con el mismo
 * monto) no toca nada. Nunca crea transacciones: el ingreso de MP ya existe.
 */
export async function reconcileMercadoPagoPayments(admin: Admin, userId: string, dry: boolean) {
  const { data: invoiceRows, error } = await admin
    .from('billing_invoices')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'sent')
    .not('sent_at', 'is', null)
  if (error) throw error
  const invoices = (invoiceRows ?? []) as BillingInvoice[]
  if (invoices.length === 0) return []

  const [{ data: txRows, error: txError }, { data: linkedRows, error: linkedError }] = await Promise.all([
    admin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'income')
      .eq('source', 'mercadopago'),
    admin
      .from('billing_invoices')
      .select('transaction_id')
      .eq('user_id', userId)
      .not('transaction_id', 'is', null),
  ])
  if (txError) throw txError
  if (linkedError) throw linkedError

  const linked = new Set((linkedRows ?? []).map((row) => row.transaction_id as string))
  const transactions = ((txRows ?? []) as Transaction[]).filter((tx) => !linked.has(tx.id))

  const sameAmountKey = (amount: number, currency: string) => `${currency}:${Number(amount).toFixed(2)}`
  const openByAmount = new Map<string, number>()
  for (const invoice of invoices) {
    const key = sameAmountKey(invoice.amount, invoice.currency)
    openByAmount.set(key, (openByAmount.get(key) ?? 0) + 1)
  }

  const results: ReconcileResult[] = []
  for (const invoice of invoices) {
    const key = sameAmountKey(invoice.amount, invoice.currency)
    const sentDate = invoice.sent_at!.slice(0, 10)
    const candidates = transactions.filter(
      (tx) => sameAmountKey(tx.amount, tx.currency) === key && tx.date >= sentDate,
    )
    if (candidates.length === 0) continue

    if ((openByAmount.get(key) ?? 0) > 1) {
      results.push({
        invoiceId: invoice.id,
        month_key: invoice.month_key,
        action: 'manual',
        reason: 'hay varias liquidaciones abiertas con el mismo monto',
      })
      continue
    }
    if (candidates.length > 1) {
      results.push({
        invoiceId: invoice.id,
        month_key: invoice.month_key,
        action: 'manual',
        reason: `${candidates.length} pagos de Mercado Pago con el mismo monto`,
      })
      continue
    }

    const tx = candidates[0]
    if (dry) {
      results.push({ invoiceId: invoice.id, month_key: invoice.month_key, action: 'conciliaría', transactionId: tx.id })
      continue
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await admin
      .from('billing_invoices')
      .update({
        status: 'paid',
        payment_method: 'mercadopago',
        transaction_id: tx.id,
        account_id: tx.account_id,
        paid_at: `${tx.date}T12:00:00Z`,
        paid_amount: tx.amount,
        updated_at: now,
      })
      .eq('id', invoice.id)
      .eq('status', 'sent')
      .select('id')
    if (updateError) throw updateError
    if (updated?.length) {
      results.push({ invoiceId: invoice.id, month_key: invoice.month_key, action: 'conciliada', transactionId: tx.id })
    }
  }
  return results
}
