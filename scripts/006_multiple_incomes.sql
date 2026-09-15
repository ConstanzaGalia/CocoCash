-- Varios cobros por fuente en el mismo mes
ALTER TABLE public.monthly_incomes
  DROP CONSTRAINT IF EXISTS monthly_incomes_income_source_id_month_key_key;

CREATE INDEX IF NOT EXISTS idx_monthly_incomes_source_month
  ON public.monthly_incomes(income_source_id, month_key);
