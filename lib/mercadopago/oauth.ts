import { createHash, randomBytes } from 'crypto'

export function getMercadoPagoConfig() {
  const clientId = process.env.MP_CLIENT_ID
  const clientSecret = process.env.MP_CLIENT_SECRET
  const redirectUri = process.env.MP_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Faltan variables MP_CLIENT_ID, MP_CLIENT_SECRET o MP_REDIRECT_URI',
    )
  }

  return { clientId, clientSecret, redirectUri }
}

export function generatePkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function generateOAuthState() {
  return randomBytes(24).toString('hex')
}

export function buildAuthorizationUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge?: string
}) {
  const url = new URL('https://auth.mercadopago.com/authorization')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('platform_id', 'mp')
  url.searchParams.set('state', params.state)
  url.searchParams.set('redirect_uri', params.redirectUri)
  if (params.codeChallenge) {
    url.searchParams.set('code_challenge', params.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
  }
  return url.toString()
}

export type MercadoPagoTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  user_id: number
  refresh_token?: string
}

export async function exchangeAuthorizationCode(params: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
  codeVerifier?: string
}): Promise<MercadoPagoTokenResponse> {
  const body: Record<string, string> = {
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
  }
  if (params.codeVerifier) {
    body.code_verifier = params.codeVerifier
  }

  const res = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OAuth token exchange failed: ${res.status} ${text}`)
  }

  return res.json()
}

export async function refreshAccessToken(params: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<MercadoPagoTokenResponse> {
  const res = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OAuth refresh failed: ${res.status} ${body}`)
  }

  return res.json()
}

export type MercadoPagoUser = {
  id: number
  nickname?: string
  email?: string
  first_name?: string
  last_name?: string
}

export async function fetchMercadoPagoUser(accessToken: string): Promise<MercadoPagoUser> {
  const res = await fetch('https://api.mercadopago.com/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`users/me failed: ${res.status} ${body}`)
  }

  return res.json()
}

export type MercadoPagoPayment = {
  id: number
  status: string
  status_detail?: string
  transaction_amount: number
  currency_id: string
  date_created?: string
  date_approved?: string
  description?: string | null
  external_reference?: string | null
  collector_id?: number
  payer?: { id?: number }
  operation_type?: string
}

export async function searchMercadoPagoPayments(
  accessToken: string,
  options?: { beginDate?: string; endDate?: string; limit?: number },
): Promise<MercadoPagoPayment[]> {
  const url = new URL('https://api.mercadopago.com/v1/payments/search')
  url.searchParams.set('sort', 'date_created')
  url.searchParams.set('criteria', 'desc')
  url.searchParams.set('range', 'date_created')
  url.searchParams.set('begin_date', options?.beginDate ?? 'NOW-90DAYS')
  url.searchParams.set('end_date', options?.endDate ?? 'NOW')
  url.searchParams.set('limit', String(options?.limit ?? 50))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`payments/search failed: ${res.status} ${body}`)
  }

  const data = await res.json()
  return (data.results ?? []) as MercadoPagoPayment[]
}

/** Intenta leer saldo de la cuenta MP. Puede no estar disponible según scopes. */
export async function fetchMercadoPagoBalance(
  accessToken: string,
  mpUserId: string,
): Promise<number | null> {
  const res = await fetch(
    `https://api.mercadopago.com/users/${mpUserId}/mercadopago_account/balance`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  )

  if (!res.ok) {
    return null
  }

  const data = await res.json()
  // Respuestas típicas: available_balance, total_amount, available_balance.amount
  if (typeof data.available_balance === 'number') return data.available_balance
  if (typeof data.total_amount === 'number') return data.total_amount
  if (data.available_balance?.amount != null) return Number(data.available_balance.amount)
  if (data.currency_balances?.[0]?.available_balance != null) {
    return Number(data.currency_balances[0].available_balance)
  }
  return null
}
