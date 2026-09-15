-- Flujo mensual: ingresos configurables, ahorros y transferencias
-- Los gastos y cobros actualizan el saldo de la cuenta asociada

-- Cuentas: disponible vs ahorros
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'available';

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_kind_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_kind_check
  CHECK (kind IN ('available', 'savings'));

-- Fuentes de ingreso configurables (nombre libre: trabajo, profesión, extra, etc.)
CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monto cobrado por fuente en un mes (YYYY-MM)
CREATE TABLE IF NOT EXISTS public.monthly_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  income_source_id UUID NOT NULL REFERENCES public.income_sources(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ARS',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (income_source_id, month_key)
);

-- Traspasos entre cuentas (no cuentan como gasto)
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vincular pago de gasto fijo a cuenta y transacción
ALTER TABLE public.fixed_expense_payments
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.fixed_expense_payments
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_sources_select_own" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources_insert_own" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources_update_own" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources_delete_own" ON public.income_sources;

CREATE POLICY "income_sources_select_own" ON public.income_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "income_sources_insert_own" ON public.income_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "income_sources_update_own" ON public.income_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "income_sources_delete_own" ON public.income_sources FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "monthly_incomes_select_own" ON public.monthly_incomes;
DROP POLICY IF EXISTS "monthly_incomes_insert_own" ON public.monthly_incomes;
DROP POLICY IF EXISTS "monthly_incomes_update_own" ON public.monthly_incomes;
DROP POLICY IF EXISTS "monthly_incomes_delete_own" ON public.monthly_incomes;

CREATE POLICY "monthly_incomes_select_own" ON public.monthly_incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "monthly_incomes_insert_own" ON public.monthly_incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "monthly_incomes_update_own" ON public.monthly_incomes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "monthly_incomes_delete_own" ON public.monthly_incomes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transfers_select_own" ON public.transfers;
DROP POLICY IF EXISTS "transfers_insert_own" ON public.transfers;
DROP POLICY IF EXISTS "transfers_update_own" ON public.transfers;
DROP POLICY IF EXISTS "transfers_delete_own" ON public.transfers;

CREATE POLICY "transfers_select_own" ON public.transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transfers_insert_own" ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transfers_update_own" ON public.transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transfers_delete_own" ON public.transfers FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_income_sources_user_id ON public.income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_incomes_user_id ON public.monthly_incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_incomes_month_key ON public.monthly_incomes(month_key);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_kind ON public.accounts(user_id, kind);
