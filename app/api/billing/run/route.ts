import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/billing/auth'
import { issueDueInvoices } from '@/lib/billing/invoices'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

/** Cron diario: genera y envía la liquidación de los clientes cuyo billing_day es hoy. */
export async function GET(request: Request) {
  const auth = authorizeCron(request)
  if ('response' in auth) return auth.response

  try {
    const result = await issueDueInvoices(createAdminClient(), auth.userId, auth.dry)
    return NextResponse.json({ ok: true, dry: auth.dry, ...result })
  } catch (error) {
    console.error('[billing/run]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
