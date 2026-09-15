-- Traspasos con cambio de moneda (USD <-> ARS)
-- amount/currency = lo que SALE de la cuenta origen
-- to_amount/to_currency = lo que ENTRA en la cuenta destino

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS to_amount DECIMAL(15, 2);

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS to_currency TEXT;

UPDATE public.transfers
SET
  to_amount = amount,
  to_currency = currency
WHERE to_amount IS NULL OR to_currency IS NULL;

ALTER TABLE public.transfers
  ALTER COLUMN to_amount SET DEFAULT 0;

ALTER TABLE public.transfers
  ALTER COLUMN to_currency SET DEFAULT 'ARS';
