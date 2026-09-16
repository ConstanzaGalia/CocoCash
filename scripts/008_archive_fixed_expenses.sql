-- Archivar gastos fijos sin borrar historial de pagos
ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active
  ON public.fixed_expenses(user_id, is_active);
