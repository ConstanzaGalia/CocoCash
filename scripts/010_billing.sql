-- Cobranzas a clientes de Coco Soft: planes, clientes, liquidaciones mensuales,
-- recordatorios y mediciones de uso. Ejecutar a mano en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  disk_limit_mb INTEGER,      -- NULL = sin tope
  egress_limit_gb INTEGER,    -- NULL = sin tope
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  monthly_amount_override DECIMAL(15, 2),  -- si es NULL se usa el del plan
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  supabase_org_id TEXT,                    -- organización donde está el proyecto
  supabase_project_ref TEXT,               -- NULL si el cliente no tiene base
  billing_day INTEGER NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  due_days INTEGER NOT NULL DEFAULT 10 CHECK (due_days >= 0),
  paid_until_month_key TEXT CHECK (paid_until_month_key IS NULL OR paid_until_month_key ~ '^\d{4}-\d{2}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.billing_clients(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  -- "vencida" no se guarda: es status = 'sent' y due_date < hoy
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  send_error TEXT,            -- último error al enviar el mail (NULL si salió bien)
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(15, 2),
  payment_method TEXT CHECK (payment_method IN ('transfer', 'mercadopago', 'prepaid', 'other')),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  line_items JSONB NOT NULL DEFAULT '[]',   -- [{concept, amount}]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, month_key)
);

CREATE TABLE IF NOT EXISTS public.billing_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.billing_clients(id) ON DELETE CASCADE,
  -- issued | pre_due | due | overdue_5 | overdue_12 | renewal_notice:YYYY-MM
  kind TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (invoice_id IS NOT NULL OR client_id IS NOT NULL)
);

-- Un recordatorio por liquidación (o por cliente, en los avisos de renovación) y tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_reminders_unique
  ON public.billing_reminders (COALESCE(invoice_id, client_id), kind);

CREATE TABLE IF NOT EXISTS public.billing_usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.billing_clients(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disk_mb DECIMAL(12, 2),
  egress_gb DECIMAL(12, 2),
  over_disk BOOLEAN NOT NULL DEFAULT FALSE,
  over_egress BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT
);

-- RLS: cada tabla solo es visible para su dueña
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'billing_plans',
    'billing_clients',
    'billing_invoices',
    'billing_reminders',
    'billing_usage_snapshots'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_own', t);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t || '_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.uid() = user_id)', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (auth.uid() = user_id)', t || '_delete_own', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_billing_clients_user_id ON public.billing_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status_due
  ON public.billing_invoices(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_billing_usage_client_captured
  ON public.billing_usage_snapshots(client_id, captured_at DESC);
