'use client'

import { createClient } from '@/lib/supabase/client'
import { Account, Subscription, CreditCard, Transaction, FixedExpense, FixedExpensePayment } from '@/lib/types'
import { toMonthKey } from '@/lib/utils'
import useSWR, { mutate } from 'swr'

const supabase = createClient()

// Fetchers
async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase.from('subscriptions').select('*').order('billing_date', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchCreditCards(): Promise<CreditCard[]> {
  const { data, error } = await supabase.from('credit_cards').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchFixedExpenses(): Promise<FixedExpense[]> {
  const { data, error } = await supabase.from('fixed_expenses').select('*').order('due_day', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchFixedExpensePayments(): Promise<FixedExpensePayment[]> {
  const { data, error } = await supabase
    .from('fixed_expense_payments')
    .select('*')
    .order('month_key', { ascending: false })
    .order('paid_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Hooks
export function useAccounts() {
  const { data, error, isLoading } = useSWR('accounts', fetchAccounts)
  return { accounts: data || [], error, isLoading }
}

export function useSubscriptions() {
  const { data, error, isLoading } = useSWR('subscriptions', fetchSubscriptions)
  return { subscriptions: data || [], error, isLoading }
}

export function useCreditCards() {
  const { data, error, isLoading } = useSWR('credit_cards', fetchCreditCards)
  return { creditCards: data || [], error, isLoading }
}

export function useTransactions() {
  const { data, error, isLoading } = useSWR('transactions', fetchTransactions)
  return { transactions: data || [], error, isLoading }
}

export function useFixedExpenses() {
  const { data, error, isLoading } = useSWR('fixed_expenses', fetchFixedExpenses)
  return { fixedExpenses: data || [], error, isLoading }
}

export function useFixedExpensePayments() {
  const { data, error, isLoading } = useSWR('fixed_expense_payments', fetchFixedExpensePayments)
  return { payments: data || [], error, isLoading }
}

// CRUD Operations - Accounts
export async function createAccount(account: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No user')
  
  const { data, error } = await supabase.from('accounts').insert({ ...account, user_id: user.id }).select().single()
  if (error) throw error
  mutate('accounts')
  return data
}

export async function updateAccount(id: string, account: Partial<Account>) {
  const { data, error } = await supabase.from('accounts').update({ ...account, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  mutate('accounts')
  return data
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
  mutate('accounts')
}

// CRUD Operations - Subscriptions
export async function createSubscription(subscription: Omit<Subscription, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No user')
  
  const { data, error } = await supabase.from('subscriptions').insert({ ...subscription, user_id: user.id }).select().single()
  if (error) throw error
  mutate('subscriptions')
  return data
}

export async function updateSubscription(id: string, subscription: Partial<Subscription>) {
  const { data, error } = await supabase.from('subscriptions').update({ ...subscription, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  mutate('subscriptions')
  return data
}

export async function deleteSubscription(id: string) {
  const { error } = await supabase.from('subscriptions').delete().eq('id', id)
  if (error) throw error
  mutate('subscriptions')
}

// CRUD Operations - Credit Cards
export async function createCreditCard(card: Omit<CreditCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No user')
  
  const { data, error } = await supabase.from('credit_cards').insert({ ...card, user_id: user.id }).select().single()
  if (error) throw error
  mutate('credit_cards')
  return data
}

export async function updateCreditCard(id: string, card: Partial<CreditCard>) {
  const { data, error } = await supabase.from('credit_cards').update({ ...card, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  mutate('credit_cards')
  return data
}

export async function deleteCreditCard(id: string) {
  const { error } = await supabase.from('credit_cards').delete().eq('id', id)
  if (error) throw error
  mutate('credit_cards')
}

// CRUD Operations - Transactions
export async function createTransaction(transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No user')
  
  const { data, error } = await supabase.from('transactions').insert({ ...transaction, user_id: user.id }).select().single()
  if (error) throw error
  mutate('transactions')
  return data
}

export async function updateTransaction(id: string, transaction: Partial<Transaction>) {
  const { data, error } = await supabase.from('transactions').update({ ...transaction, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  mutate('transactions')
  return data
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
  mutate('transactions')
}

// CRUD Operations - Fixed Expenses
export async function createFixedExpense(expense: Omit<FixedExpense, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No user')
  
  const { data, error } = await supabase.from('fixed_expenses').insert({ ...expense, user_id: user.id }).select().single()
  if (error) throw error
  mutate('fixed_expenses')
  return data
}

export async function updateFixedExpense(id: string, expense: Partial<FixedExpense>) {
  const { data, error } = await supabase.from('fixed_expenses').update({ ...expense, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  mutate('fixed_expenses')
  return data
}

export async function deleteFixedExpense(id: string) {
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
  if (error) throw error
  mutate('fixed_expenses')
  mutate('fixed_expense_payments')
}

// CRUD Operations - Fixed Expense Payments (historial mensual)
export async function recordFixedExpensePayment(input: {
  fixed_expense_id: string
  month_key: string
  amount_paid: number
  currency: 'ARS' | 'USD'
  paid_at?: string
  notes?: string | null
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No user')

  const { data, error } = await supabase
    .from('fixed_expense_payments')
    .upsert(
      {
        user_id: user.id,
        fixed_expense_id: input.fixed_expense_id,
        month_key: input.month_key,
        amount_paid: input.amount_paid,
        currency: input.currency,
        paid_at: input.paid_at ?? new Date().toISOString().split('T')[0],
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fixed_expense_id,month_key' },
    )
    .select()
    .single()

  if (error) throw error

  // Mantener campos legacy en sync (opcional, para dashboard viejo)
  if (input.month_key === toMonthKey()) {
    await updateFixedExpense(input.fixed_expense_id, {
      is_paid_this_month: true,
      last_paid_date: input.paid_at ?? new Date().toISOString().split('T')[0],
    })
  }

  mutate('fixed_expense_payments')
  return data
}

export async function updateFixedExpensePayment(
  id: string,
  updates: Partial<Pick<FixedExpensePayment, 'amount_paid' | 'currency' | 'paid_at' | 'notes'>>,
) {
  const { data, error } = await supabase
    .from('fixed_expense_payments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  mutate('fixed_expense_payments')
  return data
}

export async function deleteFixedExpensePayment(id: string) {
  const { data: payment, error: fetchError } = await supabase
    .from('fixed_expense_payments')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const { error } = await supabase.from('fixed_expense_payments').delete().eq('id', id)
  if (error) throw error

  if (payment && payment.month_key === toMonthKey()) {
    await updateFixedExpense(payment.fixed_expense_id, {
      is_paid_this_month: false,
      last_paid_date: null,
    })
  }

  mutate('fixed_expense_payments')
}

export async function deleteFixedExpensePaymentForMonth(fixedExpenseId: string, monthKey: string) {
  const { data: payment } = await supabase
    .from('fixed_expense_payments')
    .select('id')
    .eq('fixed_expense_id', fixedExpenseId)
    .eq('month_key', monthKey)
    .maybeSingle()

  if (payment) {
    await deleteFixedExpensePayment(payment.id)
  }
}

// Toggle paid status helpers
export async function toggleSubscriptionPaid(id: string, isPaid: boolean) {
  return updateSubscription(id, { is_paid: isPaid })
}

export async function toggleTransactionPaid(id: string, isPaid: boolean) {
  return updateTransaction(id, { is_paid: isPaid })
}
