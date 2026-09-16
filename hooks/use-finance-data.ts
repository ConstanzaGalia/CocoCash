'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  Account,
  AccountKind,
  Currency,
  CreditCard,
  FixedExpense,
  FixedExpensePayment,
  IncomeSource,
  MonthlyIncome,
  Subscription,
  Transaction,
  Transfer,
} from '@/lib/types'
import { computeWalletTotals } from '@/lib/budget-flow'
import { dateToMonthKey, toMonthKey } from '@/lib/utils'
import useSWR, { mutate } from 'swr'

const supabase = createClient()

async function requireUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No user')
  return user.id
}

function signedAmount(type: Transaction['type'], amount: number) {
  return type === 'income' ? amount : -amount
}

async function applyBalanceDelta(accountId: string | null | undefined, delta: number) {
  if (!accountId || !delta) return

  const { data: account, error } = await supabase
    .from('accounts')
    .select('id, balance')
    .eq('id', accountId)
    .single()
  if (error || !account) return

  const { error: updateError } = await supabase
    .from('accounts')
    .update({
      balance: Number(account.balance) + delta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
  if (updateError) throw updateError
  mutate('accounts')
}

function shouldAffectBalance(tx: Pick<Transaction, 'is_paid' | 'source'>) {
  return tx.is_paid !== false && tx.source !== 'mercadopago'
}

export function computeWalletLedger(
  accounts: Account[],
  transactions: Transaction[],
  transfers: Transfer[],
  payments: FixedExpensePayment[] = [],
  monthlyIncomes: MonthlyIncome[] = [],
) {
  const totals = computeWalletTotals(accounts, transactions, transfers, payments, monthlyIncomes)
  return {
    ...totals,
    slot: (kind: AccountKind, currency: Currency) => {
      if (kind === 'savings') return currency === 'USD' ? totals.savingsUsd : totals.savingsArs
      return currency === 'USD' ? totals.availableUsd : totals.availableArs
    },
  }
}

async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((account) => ({
    ...account,
    kind: (account.kind as AccountKind) || 'available',
  }))
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

async function fetchIncomeSources(): Promise<IncomeSource[]> {
  const { data, error } = await supabase
    .from('income_sources')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchMonthlyIncomes(): Promise<MonthlyIncome[]> {
  const { data, error } = await supabase
    .from('monthly_incomes')
    .select('*')
    .order('month_key', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchTransfers(): Promise<Transfer[]> {
  const { data, error } = await supabase.from('transfers').select('*').order('date', { ascending: false })
  if (error) throw error
  return (data || []).map((transfer) => ({
    ...transfer,
    to_amount: Number(transfer.to_amount ?? transfer.amount),
    to_currency: (transfer.to_currency as Currency) || transfer.currency,
  }))
}

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

export function useIncomeSources() {
  const { data, error, isLoading } = useSWR('income_sources', fetchIncomeSources, {
    shouldRetryOnError: false,
  })
  return { incomeSources: data || [], error, isLoading }
}

export function useMonthlyIncomes() {
  const { data, error, isLoading } = useSWR('monthly_incomes', fetchMonthlyIncomes, {
    shouldRetryOnError: false,
  })
  return { monthlyIncomes: data || [], error, isLoading }
}

export function useTransfers() {
  const { data, error, isLoading } = useSWR('transfers', fetchTransfers, {
    shouldRetryOnError: false,
  })
  return { transfers: data || [], error, isLoading }
}

export async function createAccount(
  account: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'kind' | 'source' | 'external_id'> & {
    kind?: AccountKind
    source?: Account['source']
    external_id?: string | null
  },
) {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      ...account,
      kind: account.kind ?? 'available',
      user_id: userId,
    })
    .select()
    .single()
  if (error) throw error
  mutate('accounts')
  return data as Account
}

export async function updateAccount(id: string, account: Partial<Account>) {
  const { data, error } = await supabase
    .from('accounts')
    .update({ ...account, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  mutate('accounts')
  return data as Account
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
  mutate('accounts')
}

export async function createSubscription(
  subscription: Omit<Subscription, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
) {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ ...subscription, user_id: userId })
    .select()
    .single()
  if (error) throw error
  mutate('subscriptions')
  return data
}

export async function updateSubscription(id: string, subscription: Partial<Subscription>) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ ...subscription, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  mutate('subscriptions')
  return data
}

export async function deleteSubscription(id: string) {
  const { error } = await supabase.from('subscriptions').delete().eq('id', id)
  if (error) throw error
  mutate('subscriptions')
}

export async function createCreditCard(card: Omit<CreditCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const userId = await requireUserId()
  const { data, error } = await supabase.from('credit_cards').insert({ ...card, user_id: userId }).select().single()
  if (error) throw error
  mutate('credit_cards')
  return data
}

export async function updateCreditCard(id: string, card: Partial<CreditCard>) {
  const { data, error } = await supabase
    .from('credit_cards')
    .update({ ...card, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  mutate('credit_cards')
  return data
}

export async function deleteCreditCard(id: string) {
  const { error } = await supabase.from('credit_cards').delete().eq('id', id)
  if (error) throw error
  mutate('credit_cards')
}

export async function createTransaction(
  transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
) {
  const userId = await requireUserId()
  const payload = { ...transaction, source: transaction.source ?? 'manual', user_id: userId }
  const { data, error } = await supabase.from('transactions').insert(payload).select().single()
  if (error) throw error

  if (shouldAffectBalance(payload)) {
    await applyBalanceDelta(payload.account_id, signedAmount(payload.type, Number(payload.amount)))
  }

  mutate('transactions')
  return data as Transaction
}

export async function updateTransaction(id: string, transaction: Partial<Transaction>) {
  const { data: previous, error: fetchError } = await supabase.from('transactions').select('*').eq('id', id).single()
  if (fetchError) throw fetchError

  const { data, error } = await supabase
    .from('transactions')
    .update({ ...transaction, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  const next = data as Transaction
  if (shouldAffectBalance(previous)) {
    await applyBalanceDelta(previous.account_id, -signedAmount(previous.type, Number(previous.amount)))
  }
  if (shouldAffectBalance(next)) {
    await applyBalanceDelta(next.account_id, signedAmount(next.type, Number(next.amount)))
  }

  mutate('transactions')
  return next
}

export async function deleteTransaction(id: string) {
  const { data: previous, error: fetchError } = await supabase.from('transactions').select('*').eq('id', id).single()
  if (fetchError) throw fetchError

  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error

  if (previous && shouldAffectBalance(previous)) {
    await applyBalanceDelta(previous.account_id, -signedAmount(previous.type, Number(previous.amount)))
  }

  const { data: cobro } = await supabase
    .from('monthly_incomes')
    .select('id')
    .eq('transaction_id', id)
    .maybeSingle()
  if (cobro?.id) {
    await supabase.from('monthly_incomes').delete().eq('id', cobro.id)
    mutate('monthly_incomes')
  }

  mutate('transactions')
}

export async function createFixedExpense(
  expense: Omit<FixedExpense, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
) {
  const userId = await requireUserId()
  const { data, error } = await supabase.from('fixed_expenses').insert({ ...expense, user_id: userId }).select().single()
  if (error) throw error
  mutate('fixed_expenses')
  return data
}

export async function updateFixedExpense(id: string, expense: Partial<FixedExpense>) {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .update({ ...expense, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
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

export async function recordFixedExpensePayment(input: {
  fixed_expense_id: string
  month_key: string
  amount_paid: number
  currency: Currency
  paid_at?: string
  notes?: string | null
  account_id?: string | null
  expense_name?: string
  category?: string
}) {
  const userId = await requireUserId()
  const paidAt = input.paid_at ?? new Date().toISOString().split('T')[0]

  const { data: existing } = await supabase
    .from('fixed_expense_payments')
    .select('*')
    .eq('fixed_expense_id', input.fixed_expense_id)
    .eq('month_key', input.month_key)
    .maybeSingle()

  let transactionId = existing?.transaction_id as string | null | undefined

  if (transactionId) {
    await updateTransaction(transactionId, {
      amount: input.amount_paid,
      currency: input.currency,
      account_id: input.account_id ?? existing?.account_id ?? null,
      date: paidAt,
      description: input.expense_name ?? undefined,
      category: input.category ?? undefined,
    })
  } else {
    const tx = await createTransaction({
      type: 'expense',
      amount: input.amount_paid,
      currency: input.currency,
      category: input.category || 'Servicios',
      description: input.expense_name || 'Gasto fijo',
      date: paidAt,
      is_paid: true,
      account_id: input.account_id ?? null,
      credit_card_id: null,
      source: 'manual',
    })
    transactionId = tx.id
  }

  const { data, error } = await supabase
    .from('fixed_expense_payments')
    .upsert(
      {
        user_id: userId,
        fixed_expense_id: input.fixed_expense_id,
        month_key: input.month_key,
        amount_paid: input.amount_paid,
        currency: input.currency,
        paid_at: paidAt,
        notes: input.notes ?? null,
        account_id: input.account_id ?? null,
        transaction_id: transactionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fixed_expense_id,month_key' },
    )
    .select()
    .single()

  if (error) throw error

  if (input.month_key === toMonthKey()) {
    await updateFixedExpense(input.fixed_expense_id, {
      is_paid_this_month: true,
      last_paid_date: paidAt,
    })
  }

  mutate('fixed_expense_payments')
  return data
}

export async function updateFixedExpensePayment(
  id: string,
  updates: Partial<Pick<FixedExpensePayment, 'amount_paid' | 'currency' | 'paid_at' | 'notes' | 'account_id'>>,
) {
  const { data: previous, error: fetchError } = await supabase
    .from('fixed_expense_payments')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const { data, error } = await supabase
    .from('fixed_expense_payments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  if (previous?.transaction_id) {
    await updateTransaction(previous.transaction_id, {
      amount: updates.amount_paid ?? previous.amount_paid,
      currency: updates.currency ?? previous.currency,
      date: updates.paid_at ?? previous.paid_at,
      account_id: updates.account_id ?? previous.account_id,
    })
  }

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

  if (payment?.transaction_id) {
    await deleteTransaction(payment.transaction_id)
  }

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

export async function toggleSubscriptionPaid(id: string, isPaid: boolean) {
  return updateSubscription(id, { is_paid: isPaid })
}

export async function toggleTransactionPaid(id: string, isPaid: boolean) {
  return updateTransaction(id, { is_paid: isPaid })
}

export async function createIncomeSource(input: { name: string; currency?: Currency; sort_order?: number }) {
  const userId = await requireUserId()
  const { data: last } = await supabase
    .from('income_sources')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('income_sources')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      currency: input.currency ?? 'ARS',
      sort_order: input.sort_order ?? (last?.sort_order ?? 0) + 1,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  mutate('income_sources')
  return data as IncomeSource
}

export async function updateIncomeSource(id: string, updates: Partial<Pick<IncomeSource, 'name' | 'currency' | 'is_active' | 'sort_order'>>) {
  const { data, error } = await supabase
    .from('income_sources')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  mutate('income_sources')
  return data as IncomeSource
}

export async function deleteIncomeSource(id: string) {
  const { error } = await supabase.from('income_sources').delete().eq('id', id)
  if (error) throw error
  mutate('income_sources')
  mutate('monthly_incomes')
}

export async function addMonthlyIncome(input: {
  income_source_id: string
  source_name: string
  month_key: string
  amount: number
  currency: Currency
  account_id: string | null
  notes?: string | null
}) {
  const userId = await requireUserId()
  const amount = Number(input.amount)
  if (amount <= 0) throw new Error('El monto tiene que ser mayor a 0')

  const paidAt =
    input.month_key === toMonthKey() ? new Date().toISOString().split('T')[0] : `${input.month_key}-01`

  const tx = await createTransaction({
    type: 'income',
    amount,
    currency: input.currency,
    category: input.source_name,
    description: input.notes?.trim() || input.source_name,
    date: paidAt,
    is_paid: true,
    account_id: input.account_id,
    credit_card_id: null,
    source: 'manual',
  })

  const { data, error } = await supabase
    .from('monthly_incomes')
    .insert({
      user_id: userId,
      income_source_id: input.income_source_id,
      month_key: input.month_key,
      amount,
      currency: input.currency,
      account_id: input.account_id,
      transaction_id: tx.id,
    })
    .select()
    .single()

  if (error) {
    await deleteTransaction(tx.id).catch(() => null)
    if (error.code === '23505') {
      throw new Error('Para cargar más de un cobro por fuente, ejecutá en Supabase scripts/006_multiple_incomes.sql')
    }
    throw error
  }

  mutate('monthly_incomes')
  return data as MonthlyIncome
}

export async function deleteMonthlyIncome(id: string) {
  const { data: existing, error: fetchError } = await supabase
    .from('monthly_incomes')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  if (existing?.transaction_id) {
    await deleteTransaction(existing.transaction_id)
    return
  }

  const { error } = await supabase.from('monthly_incomes').delete().eq('id', id)
  if (error) throw error
  mutate('monthly_incomes')
}

/** Edita un cobro: fuente, monto, fecha y nota; sincroniza cuenta y monthly_incomes. */
export async function updateIncomeCobro(
  transactionId: string,
  input: {
    income_source_id: string
    amount: number
    date: string
    description?: string | null
  },
) {
  const amount = Number(input.amount)
  if (amount <= 0) throw new Error('El monto tiene que ser mayor a 0')

  const { data: source, error: sourceError } = await supabase
    .from('income_sources')
    .select('*')
    .eq('id', input.income_source_id)
    .single()
  if (sourceError) throw sourceError

  const wallet = await getWallet('available', source.currency as Currency)
  const monthKey = dateToMonthKey(input.date)
  const notes = input.description?.trim() || null

  await updateTransaction(transactionId, {
    type: 'income',
    amount,
    currency: source.currency as Currency,
    category: source.name,
    description: notes || source.name,
    date: input.date,
    account_id: wallet.id,
    is_paid: true,
  })

  const { data: cobro, error: cobroFetchError } = await supabase
    .from('monthly_incomes')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle()
  if (cobroFetchError) throw cobroFetchError

  if (cobro?.id) {
    const { error } = await supabase
      .from('monthly_incomes')
      .update({
        income_source_id: input.income_source_id,
        month_key: monthKey,
        amount,
        currency: source.currency,
        account_id: wallet.id,
      })
      .eq('id', cobro.id)
    if (error) throw error
  } else {
    const userId = await requireUserId()
    const { error } = await supabase.from('monthly_incomes').insert({
      user_id: userId,
      income_source_id: input.income_source_id,
      month_key: monthKey,
      amount,
      currency: source.currency,
      account_id: wallet.id,
      transaction_id: transactionId,
    })
    if (error) throw error
  }

  mutate('monthly_incomes')
}

export function walletName(kind: AccountKind, currency: Currency) {
  if (kind === 'savings') return currency === 'USD' ? 'Ahorros USD' : 'Ahorros ARS'
  return currency === 'USD' ? 'Disponible USD' : 'Disponible ARS'
}

export const WALLET_SLOTS: { kind: AccountKind; currency: Currency }[] = [
  { kind: 'available', currency: 'ARS' },
  { kind: 'available', currency: 'USD' },
  { kind: 'savings', currency: 'ARS' },
  { kind: 'savings', currency: 'USD' },
]

export async function getWallet(kind: AccountKind, currency: Currency) {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('currency', currency)
    .order('created_at', { ascending: true })
  if (error) throw error

  const list = ((data || []) as Account[])
    .map((account) => ({
      ...account,
      kind: (account.kind as AccountKind) || 'available',
    }))
    .filter((account) => account.kind === kind)

  if (list.length === 0) {
    return createAccount({
      name: walletName(kind, currency),
      currency,
      balance: 0,
      kind,
    })
  }

  const canonical = [...list].sort((a, b) => Number(b.balance) - Number(a.balance))[0]
  const extras = list.filter((account) => account.id !== canonical.id)
  if (extras.length === 0 && canonical.name === walletName(kind, currency)) {
    return canonical
  }

  for (const extra of extras) {
    const extraBalance = Number(extra.balance)
    if (extraBalance) {
      await applyBalanceDelta(canonical.id, extraBalance)
      await applyBalanceDelta(extra.id, -extraBalance)
    }
  }

  const name = walletName(kind, currency)
  if (canonical.name !== name) {
    return updateAccount(canonical.id, { name })
  }
  mutate('accounts')
  return { ...canonical, name } as Account
}

export async function ensureSystemWallets() {
  const wallets = await Promise.all(WALLET_SLOTS.map((slot) => getWallet(slot.kind, slot.currency)))
  return wallets
}

export async function setSavingsBalance(currency: Currency, balance: number) {
  const account = await getWallet('savings', currency)
  return updateAccount(account.id, { balance })
}

export async function createTransfer(input: {
  from_account_id: string
  to_account_id: string
  amount: number
  currency: Currency
  to_amount?: number
  to_currency?: Currency
  date?: string
  notes?: string | null
}) {
  if (input.from_account_id === input.to_account_id) {
    throw new Error('Elegí origen y destino distintos')
  }
  const fromAmount = input.amount
  const toAmount = input.to_amount ?? input.amount
  const toCurrency = input.to_currency ?? input.currency
  if (fromAmount <= 0 || toAmount <= 0) {
    throw new Error('Los montos tienen que ser mayores a 0')
  }

  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('transfers')
    .insert({
      user_id: userId,
      from_account_id: input.from_account_id,
      to_account_id: input.to_account_id,
      amount: fromAmount,
      currency: input.currency,
      to_amount: toAmount,
      to_currency: toCurrency,
      date: input.date ?? new Date().toISOString().split('T')[0],
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error

  await applyBalanceDelta(input.from_account_id, -fromAmount)
  await applyBalanceDelta(input.to_account_id, toAmount)
  mutate('transfers')
  return data as Transfer
}

export async function deleteTransfer(id: string) {
  const { data: transfer, error: fetchError } = await supabase.from('transfers').select('*').eq('id', id).single()
  if (fetchError) throw fetchError

  const { error } = await supabase.from('transfers').delete().eq('id', id)
  if (error) throw error

  if (transfer) {
    await applyBalanceDelta(transfer.from_account_id, Number(transfer.amount))
    await applyBalanceDelta(
      transfer.to_account_id,
      -(Number(transfer.to_amount ?? transfer.amount)),
    )
  }
  mutate('transfers')
}
