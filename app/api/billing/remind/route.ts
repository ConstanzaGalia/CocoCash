import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/billing/auth'
import { sendDueReminders } from '@/lib/billing/invoices'
import { reconcileMercadoPagoPayments } from '@/lib/billing/reconcile'
import { errorMessage } from '@/lib/billing/shared'
import { syncMercadoPagoForUser } from '@/lib/mercadopago/sync'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

/** Cron diario: sincroniza Mercado Pago, concilia pagos y manda los recordatorios. */
export async function GET(request: Request) {
  const auth = authorizeCron(request)
  if ('response' in auth) return auth.response

  try {
    const admin = createAdminClient()

    // Primero el sync y la conciliación, para no recordarle el pago a quien ya pagó
    let mercadopago: unknown = { skipped: 'dry' }
    if (!auth.dry) {
      try {
        mercadopago = await syncMercadoPagoForUser(auth.userId)
      } catch (error) {
        mercadopago = { error: errorMessage(error) }
      }
    }
    const reconciled = await reconcileMercadoPagoPayments(admin, auth.userId, auth.dry)
    const reminders = await sendDueReminders(admin, auth.userId, auth.dry)

    return NextResponse.json({ ok: true, dry: auth.dry, mercadopago, reconciled, ...reminders })
  } catch (error) {
    console.error('[billing/remind]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
