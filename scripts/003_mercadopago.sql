-- Integración Mercado Pago: conexión OAuth por usuario
-- Los tokens NO son accesibles desde el cliente (solo service_role)

-- Extender accounts para saber el origen
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'mercadopago'));

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_source_external
  ON public.accounts (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- Extender transactions para deduplicar sync de MP
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'mercadopago'));

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_source_external
  ON public.transactions (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- Tabla de conexiones OAuth (tokens solo vía service_role)
CREATE TABLE IF NOT EXISTS public.mercadopago_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  mp_user_id TEXT NOT NULL,
  mp_nickname TEXT,
  mp_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mercadopago_connections ENABLE ROW LEVEL SECURITY;

-- Sin políticas para authenticated/anon: el acceso es solo con service_role
REVOKE ALL ON public.mercadopago_connections FROM anon, authenticated;
GRANT ALL ON public.mercadopago_connections TO service_role;

CREATE INDEX IF NOT EXISTS idx_mercadopago_connections_user_id
  ON public.mercadopago_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_mercadopago_connections_mp_user_id
  ON public.mercadopago_connections(mp_user_id);
