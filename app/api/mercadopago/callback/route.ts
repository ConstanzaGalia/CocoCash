import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { persistTokens } from '@/lib/mercadopago/connection'
import {
  exchangeAuthorizationCode,
  fetchMercadoPagoUser,
  getMercadoPagoConfig,
} from '@/lib/mercadopago/oauth'

function appOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const origin = appOrigin(request)
  const accountsUrl = `${origin}/dashboard?view=accounts`

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const errorParam = request.nextUrl.searchParams.get('error')

    if (errorParam) {
      return NextResponse.redirect(`${accountsUrl}&mp_error=denied`)
    }

    const cookieState = request.cookies.get('mp_oauth_state')?.value
    const verifier = request.cookies.get('mp_oauth_verifier')?.value
    const cookieUserId = request.cookies.get('mp_oauth_user')?.value

    if (!code || !state || !cookieState || state !== cookieState || !cookieUserId) {
      return NextResponse.redirect(`${accountsUrl}&mp_error=state`)
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== cookieUserId) {
      return NextResponse.redirect(`${origin}/auth/login`)
    }

    const { clientId, clientSecret, redirectUri } = getMercadoPagoConfig()
    const tokens = await exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
      codeVerifier: verifier,
    })

    const mpUser = await fetchMercadoPagoUser(tokens.access_token)
    const admin = createAdminClient()

    // Crear o reutilizar cuenta "Mercado Pago" en CocoCash
    const existingConn = await admin
      .from('mercadopago_connections')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let accountId = existingConn.data?.account_id as string | null

    if (!accountId) {
      const { data: existingAccount } = await admin
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('source', 'mercadopago')
        .eq('external_id', String(mpUser.id))
        .maybeSingle()

      if (existingAccount) {
        accountId = existingAccount.id
      } else {
        const { data: newAccount, error: accountError } = await admin
          .from('accounts')
          .insert({
            user_id: user.id,
            name: mpUser.nickname
              ? `Mercado Pago (${mpUser.nickname})`
              : 'Mercado Pago',
            currency: 'ARS',
            balance: 0,
            source: 'mercadopago',
            external_id: String(mpUser.id),
          })
          .select('id')
          .single()

        if (accountError) throw accountError
        accountId = newAccount.id
      }
    }

    await persistTokens(user.id, tokens, {
      mp_user_id: String(mpUser.id),
      mp_nickname: mpUser.nickname ?? null,
      mp_email: mpUser.email ?? null,
      account_id: accountId,
    })

    const response = NextResponse.redirect(`${accountsUrl}&mp=connected`)
    response.cookies.delete('mp_oauth_state')
    response.cookies.delete('mp_oauth_verifier')
    response.cookies.delete('mp_oauth_user')
    return response
  } catch (error) {
    console.error('[mp/callback]', error)
    return NextResponse.redirect(`${accountsUrl}&mp_error=callback`)
  }
}
