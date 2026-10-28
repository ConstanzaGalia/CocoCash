-- Componente en dólares de la liquidación: monto en ARS + USD convertidos a la cotización del día.
-- Se puede correr aunque 010_billing.sql ya esté ejecutado (es idempotente).

ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS usd_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (usd_amount >= 0);

-- NULL = usar el USD del plan; 0 = este cliente no paga componente en USD
ALTER TABLE public.billing_clients
  ADD COLUMN IF NOT EXISTS usd_amount_override DECIMAL(15, 2) CHECK (usd_amount_override IS NULL OR usd_amount_override >= 0);

-- Qué se convirtió y a qué cotización (queda como respaldo de cómo se calculó el total)
ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS usd_amount DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(15, 4),
  ADD COLUMN IF NOT EXISTS fx_source TEXT;
