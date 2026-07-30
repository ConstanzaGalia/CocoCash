-- Historial de pagos mensuales de gastos fijos
-- Cada fila = un pago concreto de un mes (no se pisa al cambiar de mes)

CREATE TABLE IF NOT EXISTS public.fixed_expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fixed_expense_id UUID NOT NULL REFERENCES public.fixed_expenses(id) ON DELETE CASCADE,
  -- Mes del pago en formato YYYY-MM (ej: 2026-07)
  month_key TEXT NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  amount_paid DECIMAL(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fixed_expense_id, month_key)
);

ALTER TABLE public.fixed_expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_expense_payments_select_own"
  ON public.fixed_expense_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fixed_expense_payments_insert_own"
  ON public.fixed_expense_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fixed_expense_payments_update_own"
  ON public.fixed_expense_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fixed_expense_payments_delete_own"
  ON public.fixed_expense_payments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_user_id
  ON public.fixed_expense_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_expense_id
  ON public.fixed_expense_payments(fixed_expense_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_month_key
  ON public.fixed_expense_payments(month_key);

-- Migrar pagos ya marcados con is_paid_this_month / last_paid_date
INSERT INTO public.fixed_expense_payments (
  user_id,
  fixed_expense_id,
  month_key,
  amount_paid,
  currency,
  paid_at
)
SELECT
  fe.user_id,
  fe.id,
  to_char(COALESCE(fe.last_paid_date, CURRENT_DATE), 'YYYY-MM'),
  fe.amount,
  fe.currency,
  COALESCE(fe.last_paid_date, CURRENT_DATE)
FROM public.fixed_expenses fe
WHERE fe.is_paid_this_month = TRUE
ON CONFLICT (fixed_expense_id, month_key) DO NOTHING;
