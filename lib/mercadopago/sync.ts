import { createAdminClient } from '@/lib/supabase/admin'
import { getConnectionForUser, getValidAccessToken } from '@/lib/mercadopago/connection'
import {
  fetchMercadoPagoBalance,
  searchMercadoPagoPayments,
  type MercadoPagoPayment,
} from '@/lib/mercadopago/oauth'

/** Error con status HTTP sugerido, para que las rutas lo traduzcan sin adivinar. */
export class MercadoPagoSyncError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

function mapPaymentToTransaction(
  payment: MercadoPagoPayment,
  userId: string,
  accountId: string,
  mpUserId: string,
) {
  if (payment.status !== 'approved') return null

  const amount = Math.abs(Number(payment.transaction_amount) || 0)
  if (amount === 0) return null

  const isCollector = String(payment.collector_id) === String(mpUserId)
  const type = isCollector ? 'income' : 'expense'
  const dateSource = payment.date_approved || payment.date_created
  const date = dateSource ? dateSource.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const currency = (payment.currency_id === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'

  return {
    user_id: userId,
    account_id: accountId,
    credit_card_id: null,
    type,
    amount,
    currency,
    category: isCollector ? 'Ventas' : 'Otros',
    description: payment.description || `Mercado Pago #${payment.id}`,
    date,
    is_paid: true,
    source: 'mercadopago',
    external_id: String(payment.id),
  }
}

/** Importa los pagos recientes de Mercado Pago del usuario. No requiere sesión. */
export async function syncMercadoPagoForUser(userId: string) {
  const connection = await getConnectionForUser(userId)
  if (!connection || !connection.account_id) {
    throw new MercadoPagoSyncError('Mercado Pago no conectado', 400)
  }

  const { accessToken, connection: fresh } = await getValidAccessToken(connection)
  const admin = createAdminClient()
  const accountId = fresh.account_id!

  const payments = await searchMercadoPagoPayments(accessToken, {
    beginDate: 'NOW-90DAYS',
    limit: 50,
  })

  let imported = 0
  let updated = 0
  let skipped = 0

  for (const payment of payments) {
    const row = mapPaymentToTransaction(payment, userId, accountId, fresh.mp_user_id)
    if (!row) {
      skipped++
      continue
    }

    const { data: existing } = await admin
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'mercadopago')
      .eq('external_id', row.external_id)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('transactions')
        .update({
          amount: row.amount,
          description: row.description,
          date: row.date,
          type: row.type,
          currency: row.currency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) throw error
      updated++
    } else {
      const { error } = await admin.from('transactions').insert(row)
      if (error) {
        if (error.code === '23505') {
          skipped++
        } else {
          throw error
        }
      } else {
        imported++
      }
    }
  }

  const balance = await fetchMercadoPagoBalance(accessToken, fresh.mp_user_id)
  if (balance != null) {
    await admin
      .from('accounts')
      .update({ balance, updated_at: new Date().toISOString() })
      .eq('id', accountId)
  }

  const lastSyncedAt = new Date().toISOString()
  await admin
    .from('mercadopago_connections')
    .update({
      last_synced_at: lastSyncedAt,
      updated_at: lastSyncedAt,
    })
    .eq('user_id', userId)

  return {
    ok: true,
    imported,
    updated,
    skipped,
    paymentsFound: payments.length,
    balanceUpdated: balance != null,
    balance,
    lastSyncedAt,
  }
}
