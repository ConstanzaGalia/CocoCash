'use client'

import { createClient } from '@/lib/supabase/client'
import { createTransaction, deleteTransaction } from '@/hooks/use-finance-data'
import type {
  BillingClient,
  BillingInvoice,
  BillingPlan,
  BillingUsageSnapshot,
} from '@/lib/types'
import type { PaymentInfo } from '@/lib/billing/whatsapp'
import useSWR, { mutate } from 'swr'

const supabase = createClient()

async function requireUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No user')
  return user.id
}

async function fetchPlans(): Promise<BillingPlan[]> {
  const { data, error } = await supabase.from('billing_plans').select('*').order('monthly_amount', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchClients(): Promise<BillingClient[]> {
  const { data, error } = await supabase.from('billing_clients').select('*').order('name', { ascending: true })
  if (error) throw error
  return data || []
}

async function fetchInvoices(): Promise<BillingInvoice[]> {
  const { data, error } = await supabase
    .from('billing_invoices')
    .select('*')
    .order('month_key', { ascending: false })
    .order('due_date', { ascending: false })
  if (error) throw error
  return data || []
}

/** Última medición de cada cliente (se traen las más recientes y se queda la primera por cliente). */
async function fetchLatestUsage(): Promise<Record<string, BillingUsageSnapshot>> {
  const { data, error } = await supabase
    .from('billing_usage_snapshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(300)
  if (error) throw error
  const latest: Record<string, BillingUsageSnapshot> = {}
  for (const snapshot of (data || []) as BillingUsageSnapshot[]) {
    if (!latest[snapshot.client_id]) latest[snapshot.client_id] = snapshot
  }
  return latest
}

/** Cobranzas es solo para la dueña (BILLING_OWNER_USER_ID); se consulta al servidor. */
export function useBillingAccess() {
  const { data } = useSWR(
    'billing_access',
    async () => {
      const res = await fetch('/api/billing/access')
      if (!res.ok) return { allowed: false, payment: null }
      const body = await res.json()
      return { allowed: Boolean(body.allowed), payment: (body.payment ?? null) as PaymentInfo | null }
    },
    { shouldRetryOnError: false },
  )
  return { allowed: data?.allowed === true, payment: data?.payment ?? null, isLoading: data === undefined }
}

export function useBillingPlans() {
  const { data, error, isLoading } = useSWR('billing_plans', fetchPlans, { shouldRetryOnError: false })
  return { plans: data || [], error, isLoading }
}

export function useBillingClients() {
  const { data, error, isLoading } = useSWR('billing_clients', fetchClients, { shouldRetryOnError: false })
  return { clients: data || [], error, isLoading }
}

export function useBillingInvoices() {
  const { data, error, isLoading } = useSWR('billing_invoices', fetchInvoices, { shouldRetryOnError: false })
  return { invoices: data || [], error, isLoading }
}

export function useBillingUsage() {
  const { data, error, isLoading } = useSWR('billing_usage', fetchLatestUsage, { shouldRetryOnError: false })
  return { usageByClient: data || {}, error, isLoading }
}

type PlanInput = Pick<BillingPlan, 'name' | 'monthly_amount' | 'usd_amount' | 'currency' | 'disk_limit_mb' | 'egress_limit_gb'>

export async function createBillingPlan(input: PlanInput) {
  const userId = await requireUserId()
  const { error } = await supabase.from('billing_plans').insert({ ...input, user_id: userId })
  if (error) throw error
  mutate('billing_plans')
}

export async function updateBillingPlan(id: string, input: Partial<PlanInput & { is_active: boolean }>) {
  const { error } = await supabase
    .from('billing_plans')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  mutate('billing_plans')
}

export type BillingClientInput = Omit<BillingClient, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export async function createBillingClient(input: BillingClientInput) {
  const userId = await requireUserId()
  const { error } = await supabase.from('billing_clients').insert({ ...input, user_id: userId })
  if (error) throw error
  mutate('billing_clients')
}

export async function updateBillingClient(id: string, input: Partial<BillingClientInput>) {
  const { error } = await supabase
    .from('billing_clients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  mutate('billing_clients')
}

export async function voidBillingInvoice(id: string) {
  const { data, error } = await supabase
    .from('billing_invoices')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['draft', 'sent'])
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('La liquidación ya no se puede anular')
  mutate('billing_invoices')
}

/** Suma un cargo puntual a una liquidación abierta y recalcula el total. */
export async function addInvoiceExtraCharge(invoice: BillingInvoice, concept: string, amount: number) {
  if (!concept.trim()) throw new Error('Ingresá el concepto')
  if (!amount || amount === 0) throw new Error('Ingresá un monto distinto de 0')
  const lineItems = [...(invoice.line_items ?? []), { concept: concept.trim(), amount }]
  const total = lineItems.reduce((sum, item) => sum + Number(item.amount), 0)
  const { data, error } = await supabase
    .from('billing_invoices')
    .update({ line_items: lineItems, amount: total, updated_at: new Date().toISOString() })
    .eq('id', invoice.id)
    .in('status', ['draft', 'sent'])
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('La liquidación ya no se puede modificar')
  mutate('billing_invoices')
}

/**
 * Pago manual (transferencia): crea el ingreso con el mismo mecanismo que el resto de la app
 * (createTransaction suma al saldo de la cuenta) y lo vincula a la liquidación.
 */
export async function markInvoicePaid(input: {
  invoice: BillingInvoice
  clientName: string
  accountId: string
  date: string
}) {
  const { invoice } = input
  const tx = await createTransaction({
    type: 'income',
    amount: Number(invoice.amount),
    currency: invoice.currency,
    category: 'Freelance',
    description: `Cobranza ${input.clientName} · ${invoice.month_key}`,
    date: input.date,
    is_paid: true,
    account_id: input.accountId,
    credit_card_id: null,
    source: 'manual',
  })

  const { data, error } = await supabase
    .from('billing_invoices')
    .update({
      status: 'paid',
      payment_method: 'transfer',
      account_id: input.accountId,
      transaction_id: tx.id,
      paid_at: `${input.date}T12:00:00Z`,
      paid_amount: Number(invoice.amount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoice.id)
    .eq('status', 'sent')
    .select('id')

  if (error || !data?.length) {
    // Deshace el ingreso (y su ajuste de saldo) para no dejar descuadres
    await deleteTransaction(tx.id).catch(() => null)
    throw error ?? new Error('La liquidación ya no estaba pendiente (¿se concilió sola?)')
  }
  mutate('billing_invoices')
}

export async function resendBillingInvoice(id: string) {
  const res = await fetch(`/api/billing/invoices/${id}/resend`, { method: 'POST' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'No se pudo reenviar el mail')
  mutate('billing_invoices')
}
