-- Tarjetas de crédito mínimas: nombre + vencimiento, cuotas y débitos con "hasta mes"

CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  due_day INTEGER NOT NULL DEFAULT 10 CHECK (due_day >= 1 AND due_day <= 31),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ítems de la tarjeta: compra en cuotas o débito/suscripción
CREATE TABLE IF NOT EXISTS public.card_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('installment', 'debit')),
  name TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  -- Mes de la primera cuota / primer cobro (YYYY-MM)
  start_month_key TEXT NOT NULL CHECK (start_month_key ~ '^\d{4}-\d{2}$'),
  -- Solo cuotas: cantidad de cuotas (monto mensual = amount / installments)
  installments INTEGER CHECK (installments IS NULL OR installments >= 1),
  -- Solo débitos: último mes que cobra inclusive (NULL = sin fin)
  end_month_key TEXT CHECK (end_month_key IS NULL OR end_month_key ~ '^\d{4}-\d{2}$'),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT card_items_installment_ok CHECK (
    (kind = 'installment' AND installments IS NOT NULL AND end_month_key IS NULL)
    OR (kind = 'debit' AND installments IS NULL)
  )
);

-- Pago del resumen de tarjeta por mes y moneda
CREATE TABLE IF NOT EXISTS public.card_statement_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  amount_paid DECIMAL(15, 2) NOT NULL DEFAULT 0,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (card_id, month_key, currency)
);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_statement_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cards_select_own" ON public.cards;
DROP POLICY IF EXISTS "cards_insert_own" ON public.cards;
DROP POLICY IF EXISTS "cards_update_own" ON public.cards;
DROP POLICY IF EXISTS "cards_delete_own" ON public.cards;
CREATE POLICY "cards_select_own" ON public.cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cards_insert_own" ON public.cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cards_update_own" ON public.cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cards_delete_own" ON public.cards FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "card_items_select_own" ON public.card_items;
DROP POLICY IF EXISTS "card_items_insert_own" ON public.card_items;
DROP POLICY IF EXISTS "card_items_update_own" ON public.card_items;
DROP POLICY IF EXISTS "card_items_delete_own" ON public.card_items;
CREATE POLICY "card_items_select_own" ON public.card_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "card_items_insert_own" ON public.card_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_items_update_own" ON public.card_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "card_items_delete_own" ON public.card_items FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "card_statement_payments_select_own" ON public.card_statement_payments;
DROP POLICY IF EXISTS "card_statement_payments_insert_own" ON public.card_statement_payments;
DROP POLICY IF EXISTS "card_statement_payments_update_own" ON public.card_statement_payments;
DROP POLICY IF EXISTS "card_statement_payments_delete_own" ON public.card_statement_payments;
CREATE POLICY "card_statement_payments_select_own" ON public.card_statement_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "card_statement_payments_insert_own" ON public.card_statement_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_statement_payments_update_own" ON public.card_statement_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "card_statement_payments_delete_own" ON public.card_statement_payments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cards_user_id ON public.cards(user_id);
CREATE INDEX IF NOT EXISTS idx_card_items_card_id ON public.card_items(card_id);
CREATE INDEX IF NOT EXISTS idx_card_items_user_id ON public.card_items(user_id);
CREATE INDEX IF NOT EXISTS idx_card_statement_payments_month ON public.card_statement_payments(user_id, month_key);
