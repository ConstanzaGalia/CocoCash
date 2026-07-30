import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMercadoPagoConfig,
  refreshAccessToken,
  type MercadoPagoTokenResponse,
} from '@/lib/mercadopago/oauth'

export type MercadoPagoConnectionRow = {
  id: string
  user_id: string
  mp_user_id: string
  mp_nickname: string | null
  mp_email: string | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  scope: string | null
  account_id: string | null
  last_synced_at: string | null
}

export async function getConnectionForUser(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mercadopago_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as MercadoPagoConnectionRow | null
}

export async function getValidAccessToken(
  connection: MercadoPagoConnectionRow,
): Promise<{ accessToken: string; connection: MercadoPagoConnectionRow }> {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0
  const stillValid = expiresAt > Date.now() + 60_000

  if (stillValid || !connection.refresh_token) {
    return { accessToken: connection.access_token, connection }
  }

  const { clientId, clientSecret } = getMercadoPagoConfig()
  const tokens = await refreshAccessToken({
    clientId,
    clientSecret,
    refreshToken: connection.refresh_token,
  })

  const updated = await persistTokens(connection.user_id, tokens, {
    mp_user_id: String(tokens.user_id ?? connection.mp_user_id),
  })

  return { accessToken: updated.access_token, connection: updated }
}

export async function persistTokens(
  userId: string,
  tokens: MercadoPagoTokenResponse,
  extra?: {
    mp_user_id?: string
    mp_nickname?: string | null
    mp_email?: string | null
    account_id?: string | null
  },
) {
  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const payload = {
    user_id: userId,
    mp_user_id: String(tokens.user_id ?? extra?.mp_user_id ?? ''),
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expires_at: expiresAt,
    scope: tokens.scope ?? null,
    updated_at: new Date().toISOString(),
    ...(extra?.mp_nickname !== undefined ? { mp_nickname: extra.mp_nickname } : {}),
    ...(extra?.mp_email !== undefined ? { mp_email: extra.mp_email } : {}),
    ...(extra?.account_id !== undefined ? { account_id: extra.account_id } : {}),
  }

  const { data, error } = await admin
    .from('mercadopago_connections')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw error
  return data as MercadoPagoConnectionRow
}
