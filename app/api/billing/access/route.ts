import { NextResponse } from 'next/server'
import { isBillingOwner } from '@/lib/billing/shared'
import { createClient } from '@/lib/supabase/server'

/** Le dice a la app si el usuario logueado es la dueña del módulo y, solo en ese caso, los datos de cobro. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isBillingOwner(user?.id)) return NextResponse.json({ allowed: false })

  return NextResponse.json({
    allowed: true,
    payment: {
      aliasArs: process.env.BILLING_PAYMENT_ALIAS || null,
      aliasUsd: process.env.BILLING_PAYMENT_ALIAS_USD || null,
      holder: process.env.BILLING_PAYMENT_HOLDER || null,
    },
  })
}
