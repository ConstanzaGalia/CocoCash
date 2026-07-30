import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConnectionForUser } from '@/lib/mercadopago/connection'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const connection = await getConnectionForUser(user.id)

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      mpUserId: connection.mp_user_id,
      nickname: connection.mp_nickname,
      email: connection.mp_email,
      accountId: connection.account_id,
      lastSyncedAt: connection.last_synced_at,
      connectedAt: connection.created_at,
    })
  } catch (error) {
    console.error('[mp/status]', error)
    return NextResponse.json({ error: 'Error al consultar estado' }, { status: 500 })
  }
}
