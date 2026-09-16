-- Archivar tarjetas sin borrar cuotas, débitos ni historial de pagos
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_cards_active
  ON public.cards(user_id, is_active);
