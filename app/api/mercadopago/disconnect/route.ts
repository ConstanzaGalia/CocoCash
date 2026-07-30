import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnectionForUser } from '@/lib/mercadopago/connection'

export async function POST() {
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

    const admin = createAdminClient()

    const { error } = await admin
      .from('mercadopago_connections')
      .delete()
      .eq('user_id', user.id)

    if (error) throw error

    // La cuenta queda, pero deja de estar "vinculada". El usuario puede borrarla a mano.
    return NextResponse.json({ ok: true, connected: false })
  } catch (error) {
    console.error('[mp/disconnect]', error)
    return NextResponse.json({ error: 'Error al desconectar' }, { status: 500 })
  }
}
