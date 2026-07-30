import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildAuthorizationUrl,
  generateOAuthState,
  generatePkce,
  getMercadoPagoConfig,
} from '@/lib/mercadopago/oauth'

export async function GET() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', origin))
    }

    const { clientId, redirectUri } = getMercadoPagoConfig()
    const state = generateOAuthState()
    const usePkce = process.env.MP_USE_PKCE === 'true'
    const pkce = usePkce ? generatePkce() : null

    const authUrl = buildAuthorizationUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: pkce?.challenge,
    })

    const response = NextResponse.redirect(authUrl)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 10,
    }

    response.cookies.set('mp_oauth_state', state, cookieOptions)
    response.cookies.set('mp_oauth_user', user.id, cookieOptions)
    if (pkce) {
      response.cookies.set('mp_oauth_verifier', pkce.verifier, cookieOptions)
    }

    return response
  } catch (error) {
    console.error('[mp/connect]', error)
    return NextResponse.redirect(`${origin}/dashboard?view=accounts&mp_error=config`)
  }
}
