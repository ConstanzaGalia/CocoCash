import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/billing/auth'
import { keepOwnDatabaseAlive, measureUsage } from '@/lib/billing/usage'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

/** Cron semanal: mide el disco de cada cliente, avisa si se pasan y mantiene viva la base propia. */
export async function GET(request: Request) {
  const auth = authorizeCron(request)
  if ('response' in auth) return auth.response

  try {
    const admin = createAdminClient()
    const keepAlive = await keepOwnDatabaseAlive(admin)
    const usage = await measureUsage(admin, auth.userId, auth.dry)
    return NextResponse.json({ ok: true, dry: auth.dry, keepAlive, ...usage })
  } catch (error) {
    console.error('[billing/usage]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
