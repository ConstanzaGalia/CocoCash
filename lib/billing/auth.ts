import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getOwnerUserId } from '@/lib/billing/shared'

function digest(value: string) {
  return createHash('sha256').update(value).digest()
}

/** Compara en tiempo constante (se hashea para igualar largos). */
function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b))
}

/**
 * Valida `Authorization: Bearer ${CRON_SECRET}` y lee `?dry=1`.
 * Devuelve la respuesta de error si no corresponde seguir.
 */
export function authorizeCron(
  request: Request,
): { dry: boolean; userId: string } | { response: NextResponse } {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret || !header.startsWith('Bearer ') || !safeEqual(header.slice(7), secret)) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  try {
    const dry = new URL(request.url).searchParams.get('dry') === '1'
    return { dry, userId: getOwnerUserId() }
  } catch (error) {
    console.error('[billing/auth]', error)
    return { response: NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 }) }
  }
}
