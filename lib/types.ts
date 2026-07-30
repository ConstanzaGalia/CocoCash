export interface Account {
  id: string
  user_id: string
  name: string
  currency: 'ARS' | 'USD'
  balance: number
  source?: 'manual' | 'mercadopago'
  external_id?: string | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  name: string
  amount: number
  currency: 'ARS' | 'USD'
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
  currency: 'ARS' | 'USD'
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
  currency: 'ARS' | 'USD'
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
  currency: 'ARS' | 'USD'
  due_day: number
  category: string
  /** @deprecated Usar fixed_expense_payments. Se mantiene por compatibilidad. */
  is_paid_this_month: boolean
  /** @deprecated Usar fixed_expense_payments. Se mantiene por compatibilidad. */
  last_paid_date: string | null
  notes: string | null
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
  currency: 'ARS' | 'USD'
  paid_at: string
  notes: string | null
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

export type View = 'dashboard' | 'accounts' | 'subscriptions' | 'credit-cards' | 'transactions' | 'fixed-expenses'

export const CATEGORIES = {
  expense: [
    'Alimentacion',
    'Transporte',
    'Entretenimiento',
    'Servicios',
    'Salud',
    'Educacion',
    'Ropa',
    'Hogar',
    'Impuestos',
    'Seguros',
    'Otros'
  ],
  income: [
    'Salario',
    'Freelance',
    'Inversiones',
    'Alquiler',
    'Ventas',
    'Otros'
  ],
  subscription: [
    'Streaming',
    'Software',
    'Gaming',
    'Musica',
    'Noticias',
    'Gimnasio',
    'Cloud',
    'Otros'
  ],
  fixedExpense: [
    'Alquiler',
    'Servicios',
    'Seguros',
    'Internet',
    'Telefono',
    'Impuestos',
    'Cuotas',
    'Otros'
  ]
}
