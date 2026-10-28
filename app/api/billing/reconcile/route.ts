import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/billing/auth'
import { reconcileMercadoPagoPayments } from '@/lib/billing/reconcile'
import { errorMessage } from '@/lib/billing/shared'
import { syncMercadoPagoForUser } from '@/lib/mercadopago/sync'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

/** Cron diario: sincroniza Mercado Pago y concilia pagos con liquidaciones pendientes. */
export async function GET(request: Request) {
  const auth = authorizeCron(request)
  if ('response' in auth) return auth.response

  try {
    let mercadopago: unknown = { skipped: 'dry' }
    if (!auth.dry) {
      try {
        mercadopago = await syncMercadoPagoForUser(auth.userId)
      } catch (error) {
        mercadopago = { error: errorMessage(error) }
      }
    }
    const reconciled = await reconcileMercadoPagoPayments(createAdminClient(), auth.userId, auth.dry)
    return NextResponse.json({ ok: true, dry: auth.dry, mercadopago, reconciled })
  } catch (error) {
    console.error('[billing/reconcile]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
