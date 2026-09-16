export type Currency = 'ARS' | 'USD'
export type AccountKind = 'available' | 'savings'

export interface Account {
  id: string
  user_id: string
  name: string
  currency: Currency
  balance: number
  kind: AccountKind
  source?: 'manual' | 'mercadopago'
  external_id?: string | null
  created_at: string
  updated_at: string
}

export interface IncomeSource {
  id: string
  user_id: string
  name: string
  currency: Currency
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MonthlyIncome {
  id: string
  user_id: string
  income_source_id: string
  month_key: string
  amount: number
  currency: Currency
  account_id: string | null
  transaction_id: string | null
  created_at: string
  updated_at: string
}

export interface Transfer {
  id: string
  user_id: string
  from_account_id: string
  to_account_id: string
  amount: number
  currency: Currency
  to_amount: number
  to_currency: Currency
  date: string
  notes: string | null
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  name: string
  amount: number
  currency: Currency
  billing_date: number
  category: string
  is_paid: boolean
  created_at: string
  updated_at: string
}

export interface CreditCard {
  id: string
  user_id: string
  name: string
  last_four_digits: string
  credit_limit: number
  current_balance: number
  closing_date: number
  due_date: number
  currency: Currency
  created_at: string
  updated_at: string
}

/** Tarjeta mínima para presupuesto (cuotas + débitos). */
export interface Card {
  id: string
  user_id: string
  name: string
  due_day: number
  created_at: string
  updated_at: string
}

export type CardItemKind = 'installment' | 'debit'

export interface CardItem {
  id: string
  user_id: string
  card_id: string
  kind: CardItemKind
  name: string
  /** Total de la compra (cuotas) o monto mensual (débito). */
  amount: number
  currency: Currency
  start_month_key: string
  installments: number | null
  /** Último mes que cobra inclusive; null = sin fin (solo débitos). */
  end_month_key: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CardStatementPayment {
  id: string
  user_id: string
  card_id: string
  month_key: string
  currency: Currency
  amount_paid: number
  paid_at: string
  notes: string | null
  account_id: string | null
  transaction_id: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string | null
  credit_card_id: string | null
  type: 'income' | 'expense'
  amount: number
  currency: Currency
  category: string
  description: string | null
  date: string
  is_paid: boolean
  source?: 'manual' | 'mercadopago'
  external_id?: string | null
  created_at: string
  updated_at: string
}

export interface MercadoPagoStatus {
  connected: boolean
  mpUserId?: string
  nickname?: string | null
  email?: string | null
  accountId?: string | null
  lastSyncedAt?: string | null
  connectedAt?: string
}

export interface FixedExpense {
  id: string
  user_id: string
  name: string
  amount: number
  currency: Currency
  due_day: number
  category: string
  /** @deprecated Usar fixed_expense_payments. Se mantiene por compatibilidad. */
  is_paid_this_month: boolean
  /** @deprecated Usar fixed_expense_payments. Se mantiene por compatibilidad. */
  last_paid_date: string | null
  notes: string | null
  /** false = archivado: no sale en el checklist, conserva pagos históricos. */
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Un pago concreto de un gasto fijo en un mes (YYYY-MM). */
export interface FixedExpensePayment {
  id: string
  user_id: string
  fixed_expense_id: string
  month_key: string
  amount_paid: number
  currency: Currency
  paid_at: string
  notes: string | null
  account_id: string | null
  transaction_id: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export type View =
  | 'dashboard'
  | 'transactions'
  | 'fixed-expenses'
  | 'income'
  | 'savings'
  | 'comparatives'

export const CATEGORIES = {
  expense: [
    'Comida',
    'Delivery',
    'Salidas',
    'Nutricionista',
    'Regalos',
    'Transporte',
    'Entretenimiento',
    'Salud',
    'Ropa',
    'Hogar',
    'Otros',
  ],
  income: ['Salario', 'Profesión', 'Extra', 'Freelance', 'Inversiones', 'Ventas', 'Otros'],
  fixedExpense: [
    'Alquiler',
    'Expensas',
    'Servicios',
    'Tarjeta',
    'Gimnasio',
    'Deporte',
    'Contador',
    'Colegio profesional',
    'Salud',
    'Impuestos',
    'Internet',
    'Telefono',
    'Cuotas',
    'Otros',
  ],
}

export const INCOME_SOURCE_SUGGESTIONS = ['Sueldo', 'Profesión', 'Extra']
