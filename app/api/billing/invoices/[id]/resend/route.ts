import { NextResponse } from 'next/server'
import { resendInvoiceEmail } from '@/lib/billing/invoices'
import { errorMessage, isBillingOwner } from '@/lib/billing/shared'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { BillingClient, BillingInvoice } from '@/lib/types'

/** Reenvío manual de la liquidación (sesión de la app, no cron). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!isBillingOwner(user.id)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  try {
    // Con la sesión del usuario: RLS garantiza que la liquidación sea suya
    const { data: invoice } = await supabase.from('billing_invoices').select('*').eq('id', id).maybeSingle()
    if (!invoice) return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 })
    if (invoice.status !== 'sent') {
      return NextResponse.json({ error: 'Solo se reenvían liquidaciones enviadas' }, { status: 400 })
    }
    const { data: client } = await supabase
      .from('billing_clients')
      .select('*')
      .eq('id', invoice.client_id)
      .single()

    await resendInvoiceEmail(createAdminClient(), invoice as BillingInvoice, client as BillingClient)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
