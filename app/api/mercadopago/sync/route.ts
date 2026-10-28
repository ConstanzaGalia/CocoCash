import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MercadoPagoSyncError, syncMercadoPagoForUser } from '@/lib/mercadopago/sync'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    return NextResponse.json(await syncMercadoPagoForUser(user.id))
  } catch (error) {
    if (error instanceof MercadoPagoSyncError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[mp/sync]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al sincronizar' },
      { status: 500 },
    )
  }
}
