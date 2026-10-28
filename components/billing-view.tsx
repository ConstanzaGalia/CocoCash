'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  addInvoiceExtraCharge,
  createBillingClient,
  createBillingPlan,
  markInvoicePaid,
  updateBillingClient,
  updateBillingPlan,
  useBillingAccess,
  useBillingClients,
  useBillingInvoices,
  useBillingPlans,
  useBillingUsage,
  voidBillingInvoice,
  type BillingClientInput,
} from '@/hooks/use-billing-data'
import { useAccounts } from '@/hooks/use-finance-data'
import { argentinaToday } from '@/lib/billing/shared'
import { buildWhatsappUrl } from '@/lib/billing/whatsapp'
import type {
  BillingClient,
  BillingInvoice,
  BillingPlan,
  BillingUsageSnapshot,
  Currency,
} from '@/lib/types'
import { formatCurrency, formatMonthLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Archive, Ban, CheckCircle2, Loader2, MessageCircle, Pencil, Plus, RotateCcw } from 'lucide-react'

type DisplayStatus = 'draft' | 'sent' | 'overdue' | 'paid' | 'void'

const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: 'Borrador',
  sent: 'Pendiente',
  overdue: 'Vencida',
  paid: 'Pagada',
  void: 'Anulada',
}

const STATUS_CLASS: Record<DisplayStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  overdue: 'bg-red-500/15 text-red-600 dark:text-red-400',
  paid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  void: 'bg-muted text-muted-foreground line-through',
}

/** "Vencida" se calcula: no se guarda. */
function displayStatus(invoice: BillingInvoice, today: string): DisplayStatus {
  if (invoice.status === 'sent' && invoice.due_date < today) return 'overdue'
  return invoice.status
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <Badge variant="outline" className={`border-transparent ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

function formatDate(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return 'Ocurrió un error'
}

function parseNumber(value: string) {
  return parseFloat(value.replace(',', '.'))
}

/** Monto mensual del cliente: parte en pesos y parte en USD (que se convierte al blue del día). */
function clientAmountLabel(client: BillingClient, plan?: BillingPlan) {
  const ars = Number(client.monthly_amount_override ?? plan?.monthly_amount ?? 0)
  const usd = Number(client.usd_amount_override ?? plan?.usd_amount ?? 0)
  const parts = [
    ars > 0 ? formatCurrency(ars, client.currency) : null,
    usd > 0 ? formatCurrency(usd, 'USD') : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' + ') : null
}

function usageBadge(client: BillingClient, plan: BillingPlan | undefined, snapshot?: BillingUsageSnapshot) {
  if (!client.supabase_project_ref) return { label: 'Sin base', className: 'bg-muted text-muted-foreground' }
  if (!snapshot) return { label: 'Sin medir', className: 'bg-muted text-muted-foreground' }
  if (snapshot.error || snapshot.disk_mb == null) {
    return { label: 'Error de medición', className: 'bg-muted text-muted-foreground', title: snapshot.error ?? undefined }
  }
  const limit = plan?.disk_limit_mb
  const title = `${Number(snapshot.disk_mb).toFixed(0)} MB${limit ? ` de ${limit} MB` : ''}`
  if (!limit) return { label: 'Sin tope', className: 'bg-muted text-muted-foreground', title }
  const ratio = Number(snapshot.disk_mb) / limit
  if (ratio > 1) return { label: 'Pasado', className: 'bg-red-500/15 text-red-600 dark:text-red-400', title }
  if (ratio >= 0.8) return { label: 'Cerca del tope', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', title }
  return { label: 'OK', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', title }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

const NO_PLAN = 'none'

function ClientDialog({
  open,
  onOpenChange,
  client,
  plans,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: BillingClient | null
  plans: BillingPlan[]
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    plan_id: NO_PLAN,
    override: '',
    usdOverride: '',
    currency: 'ARS' as Currency,
    org: '',
    ref: '',
    billing_day: '1',
    due_days: '10',
    paid_until: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      name: client?.name ?? '',
      email: client?.email ?? '',
      whatsapp: client?.whatsapp ?? '',
      plan_id: client?.plan_id ?? NO_PLAN,
      override: client?.monthly_amount_override != null ? String(client.monthly_amount_override) : '',
      usdOverride: client?.usd_amount_override != null ? String(client.usd_amount_override) : '',
      currency: client?.currency ?? 'ARS',
      org: client?.supabase_org_id ?? '',
      ref: client?.supabase_project_ref ?? '',
      billing_day: String(client?.billing_day ?? 1),
      due_days: String(client?.due_days ?? 10),
      paid_until: client?.paid_until_month_key ?? '',
      notes: client?.notes ?? '',
    })
  }, [open, client])

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    const billingDay = parseInt(form.billing_day, 10)
    const dueDays = parseInt(form.due_days, 10)
    const override = form.override.trim() ? parseNumber(form.override) : null
    const usdOverride = form.usdOverride.trim() ? parseNumber(form.usdOverride) : null
    if (!form.name.trim()) return toast.error('Ingresá el nombre del cliente')
    if (!(billingDay >= 1 && billingDay <= 28)) return toast.error('El día de cobro va de 1 a 28')
    if (!(dueDays >= 0)) return toast.error('Los días de vencimiento no pueden ser negativos')
    if (override != null && !(override > 0)) return toast.error('El monto propio tiene que ser mayor a 0')
    if (usdOverride != null && !(usdOverride >= 0)) return toast.error('El monto en USD no puede ser negativo')

    const payload: BillingClientInput = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      plan_id: form.plan_id === NO_PLAN ? null : form.plan_id,
      monthly_amount_override: override,
      usd_amount_override: usdOverride,
      currency: form.currency,
      supabase_org_id: form.org.trim() || null,
      supabase_project_ref: form.ref.trim() || null,
      billing_day: billingDay,
      due_days: dueDays,
      paid_until_month_key: form.paid_until || null,
      is_active: client?.is_active ?? true,
      notes: form.notes.trim() || null,
    }
    setSaving(true)
    try {
      if (client) await updateBillingClient(client.id, payload)
      else await createBillingClient(payload)
      onOpenChange(false)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>El monto sale del plan, salvo que cargues un monto propio.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre">
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="Ej: 11 2345 6789" />
          </Field>
          <Field label="Plan">
            <Select
              value={form.plan_id}
              onValueChange={(value) => {
                set('plan_id', value)
                const plan = plans.find((p) => p.id === value)
                if (plan) set('currency', plan.currency)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAN}>Sin plan</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Monto en pesos propio (opcional)">
            <Input inputMode="decimal" value={form.override} onChange={(e) => set('override', e.target.value)} />
          </Field>
          <Field label="Monto en USD propio (opcional, 0 = sin USD)">
            <Input inputMode="decimal" value={form.usdOverride} onChange={(e) => set('usdOverride', e.target.value)} />
          </Field>
          <Field label="Moneda">
            <Select value={form.currency} onValueChange={(v: Currency) => set('currency', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pagado hasta (opcional)">
            <Input type="month" value={form.paid_until} onChange={(e) => set('paid_until', e.target.value)} />
          </Field>
          <Field label="Día de cobro (1-28)">
            <Input inputMode="numeric" value={form.billing_day} onChange={(e) => set('billing_day', e.target.value)} />
          </Field>
          <Field label="Días hasta el vencimiento">
            <Input inputMode="numeric" value={form.due_days} onChange={(e) => set('due_days', e.target.value)} />
          </Field>
          <Field label="Organización de Supabase">
            <Input value={form.org} onChange={(e) => set('org', e.target.value)} placeholder="CocoSoft" />
          </Field>
          <Field label="Project ref (vacío si no tiene base)">
            <Input value={form.ref} onChange={(e) => set('ref', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notas">
              <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PlanDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: BillingPlan | null
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [usdAmount, setUsdAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [disk, setDisk] = useState('')
  const [egress, setEgress] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(plan?.name ?? '')
    setAmount(plan ? String(plan.monthly_amount) : '')
    setUsdAmount(plan && Number(plan.usd_amount) > 0 ? String(plan.usd_amount) : '')
    setCurrency(plan?.currency ?? 'ARS')
    setDisk(plan?.disk_limit_mb != null ? String(plan.disk_limit_mb) : '')
    setEgress(plan?.egress_limit_gb != null ? String(plan.egress_limit_gb) : '')
  }, [open, plan])

  const handleSave = async () => {
    const monthly = parseNumber(amount)
    if (!name.trim()) return toast.error('Ingresá el nombre del plan')
    const usd = usdAmount.trim() ? parseNumber(usdAmount) : 0
    if (!(monthly >= 0)) return toast.error('Ingresá el monto mensual en pesos (puede ser 0)')
    if (!(usd >= 0)) return toast.error('El monto en USD no puede ser negativo')
    if (monthly <= 0 && usd <= 0) return toast.error('El plan necesita un monto en pesos o en USD')
    const payload = {
      name: name.trim(),
      monthly_amount: monthly,
      usd_amount: usd,
      currency,
      disk_limit_mb: disk.trim() ? parseInt(disk, 10) : null,
      egress_limit_gb: egress.trim() ? parseInt(egress, 10) : null,
    }
    setSaving(true)
    try {
      if (plan) await updateBillingPlan(plan.id, payload)
      else await createBillingPlan(payload)
      onOpenChange(false)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar plan' : 'Nuevo plan'}</DialogTitle>
          <DialogDescription>
            El total de cada liquidación es el monto en pesos más los USD convertidos al dólar blue del día. Cambiar el plan no modifica liquidaciones ya generadas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Field label="Monto mensual en pesos">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Más USD (al dólar blue del día)">
            <Input inputMode="decimal" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} placeholder="Sin USD" />
          </Field>
          <Field label="Moneda">
            <Select value={currency} onValueChange={(v: Currency) => setCurrency(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tope de disco (MB)">
            <Input inputMode="numeric" value={disk} onChange={(e) => setDisk(e.target.value)} placeholder="Sin tope" />
          </Field>
          <Field label="Tope de egreso (GB)">
            <Input inputMode="numeric" value={egress} onChange={(e) => setEgress(e.target.value)} placeholder="Sin tope" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PayDialog({
  invoice,
  clientName,
  onClose,
}: {
  invoice: BillingInvoice | null
  clientName: string
  onClose: () => void
}) {
  const { accounts } = useAccounts()
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  const eligible = useMemo(
    () => accounts.filter((a) => a.currency === invoice?.currency && a.kind === 'available'),
    [accounts, invoice?.currency],
  )

  useEffect(() => {
    if (!invoice) return
    setDate(argentinaToday().date)
    setAccountId(eligible[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id])

  const handleSave = async () => {
    if (!invoice) return
    if (!accountId) return toast.error('Elegí la cuenta donde entró el pago')
    if (!date) return toast.error('Elegí la fecha del pago')
    setSaving(true)
    try {
      await markInvoicePaid({ invoice, clientName, accountId, date })
      toast.success('Liquidación marcada como pagada')
      onClose()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(invoice)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como pagada · {clientName}</DialogTitle>
          <DialogDescription>
            Se registra un ingreso de {invoice ? formatCurrency(Number(invoice.amount), invoice.currency) : ''} (categoría
            Freelance) y se suma al saldo de la cuenta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Cuenta">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={`No hay cuentas en ${invoice?.currency ?? ''}`} />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fecha del pago">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExtraChargeDialog({
  invoice,
  clientName,
  onClose,
}: {
  invoice: BillingInvoice | null
  clientName: string
  onClose: () => void
}) {
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!invoice) return
    setConcept('')
    setAmount('')
  }, [invoice])

  const handleSave = async () => {
    if (!invoice) return
    setSaving(true)
    try {
      await addInvoiceExtraCharge(invoice, concept, parseNumber(amount))
      toast.success('Cargo agregado')
      onClose()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(invoice)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cargo extra · {clientName}</DialogTitle>
          <DialogDescription>
            Se suma al detalle y al total de la liquidación. Si ya le avisaste, mandale de nuevo el recordatorio por WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Concepto">
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: horas extra de soporte" />
          </Field>
          <Field label="Monto">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BillingView() {
  const { clients, isLoading: loadingClients, error: clientsError } = useBillingClients()
  const { plans, isLoading: loadingPlans } = useBillingPlans()
  const { invoices, isLoading: loadingInvoices } = useBillingInvoices()
  const { usageByClient } = useBillingUsage()
  const { payment } = useBillingAccess()

  const today = argentinaToday()
  const plansById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])
  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

  const [clientDialog, setClientDialog] = useState<{ open: boolean; client: BillingClient | null }>({
    open: false,
    client: null,
  })
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan: BillingPlan | null }>({ open: false, plan: null })
  const [payInvoice, setPayInvoice] = useState<BillingInvoice | null>(null)
  const [extraInvoice, setExtraInvoice] = useState<BillingInvoice | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)

  const latestByClient = useMemo(() => {
    const map = new Map<string, BillingInvoice>()
    for (const invoice of invoices) {
      if (invoice.status === 'void') continue
      const current = map.get(invoice.client_id)
      if (!current || invoice.month_key > current.month_key) map.set(invoice.client_id, invoice)
    }
    return map
  }, [invoices])

  const summary = useMemo(() => {
    const totals = new Map<Currency, { due: number; paid: number; pending: number; overdue: number }>()
    const bucket = (currency: Currency) => {
      if (!totals.has(currency)) totals.set(currency, { due: 0, paid: 0, pending: 0, overdue: 0 })
      return totals.get(currency)!
    }
    for (const invoice of invoices) {
      if (invoice.status === 'void' || invoice.status === 'draft') continue
      const amount = Number(invoice.amount)
      const status = displayStatus(invoice, today.date)
      const b = bucket(invoice.currency)
      // Vencido cuenta todos los meses; el resto, solo el mes actual
      if (status === 'overdue') b.overdue += amount
      if (invoice.month_key !== today.monthKey) continue
      b.due += amount
      if (status === 'paid') b.paid += amount
      if (status === 'sent') b.pending += amount
    }
    return totals
  }, [invoices, today.date, today.monthKey])

  const usageAlerts = clients.filter((client) => {
    if (!client.is_active) return false
    const badge = usageBadge(client, client.plan_id ? plansById.get(client.plan_id) : undefined, usageByClient[client.id])
    return badge.label === 'Pasado' || badge.label === 'Cerca del tope'
  })

  const filteredInvoices = invoices.filter((invoice) => {
    if (monthFilter !== 'all' && invoice.month_key !== monthFilter) return false
    if (statusFilter !== 'all' && displayStatus(invoice, today.date) !== statusFilter) return false
    return true
  })
  const invoiceMonths = Array.from(new Set(invoices.map((i) => i.month_key))).sort().reverse()

  const run = async (id: string, action: () => Promise<void>, success: string) => {
    setBusyId(id)
    try {
      await action()
      toast.success(success)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusyId(null)
    }
  }

  if (loadingClients || loadingPlans || loadingInvoices) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const visibleClients = clients.filter((c) => showArchived || c.is_active)
  const summaryCards: { key: 'due' | 'paid' | 'pending' | 'overdue'; label: string; className: string }[] = [
    { key: 'due', label: 'A cobrar este mes', className: 'border-primary/20 bg-primary/5 text-primary' },
    { key: 'paid', label: 'Cobrado', className: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
    { key: 'pending', label: 'Pendiente', className: 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400' },
    { key: 'overdue', label: 'Vencido', className: 'border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400' },
  ]
  const currencies: Currency[] = summary.has('USD') ? ['ARS', 'USD'] : ['ARS']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Cobranzas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes de Coco Soft: liquidaciones mensuales, pagos y uso de sus bases.
        </p>
      </div>

      {clientsError && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-4 text-sm">
            Falta ejecutar en Supabase <code className="text-xs">scripts/010_billing.sql</code> para habilitar cobranzas.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.key} className={card.className}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {currencies.map((currency) => (
                <p key={currency} className="text-xl font-bold md:text-2xl">
                  {formatCurrency(summary.get(currency)?.[card.key] ?? 0, currency)}
                </p>
              ))}
              {card.key === 'overdue' && <p className="text-[11px] opacity-70">Todos los meses</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {usageAlerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-4 text-sm">
            <p className="font-medium">Alertas de uso</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {usageAlerts.map((client) => {
                const badge = usageBadge(
                  client,
                  client.plan_id ? plansById.get(client.plan_id) : undefined,
                  usageByClient[client.id],
                )
                return (
                  <li key={client.id}>
                    {client.name}: {badge.label.toLowerCase()} ({badge.title}). Evaluá subirlo de plan.
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Liquidaciones</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="plans">Planes</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {invoiceMonths.map((month) => (
                  <SelectItem key={month} value={month}>
                    <span className="capitalize">{formatMonthLabel(month)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {(Object.keys(STATUS_LABEL) as DisplayStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredInvoices.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="py-6 text-sm text-muted-foreground">
                No hay liquidaciones para este filtro. Se generan solas el día de cobro de cada cliente.
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 bg-card/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const status = displayStatus(invoice, today.date)
                    const open = invoice.status === 'sent' || invoice.status === 'draft'
                    const clientName = clientsById.get(invoice.client_id)?.name ?? 'Cliente'
                    const busy = busyId === invoice.id
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {clientName}
                        </TableCell>
                        <TableCell className="capitalize">{formatMonthLabel(invoice.month_key)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(invoice.amount), invoice.currency)}
                          {invoice.usd_amount != null && invoice.fx_rate != null && (
                            <p className="text-[11px] font-normal text-muted-foreground">
                              incl. USD {Number(invoice.usd_amount)} a ${Number(invoice.fx_rate)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(invoice.due_date)}</TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                          {invoice.payment_method && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{invoice.payment_method}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5">
                            {invoice.status === 'sent' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Marcar como pagada" disabled={busy} onClick={() => setPayInvoice(invoice)}>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              </Button>
                            )}
                            {invoice.status === 'sent' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Mandar recordatorio por WhatsApp"
                                disabled={busy}
                                onClick={() => {
                                  const client = clientsById.get(invoice.client_id)
                                  if (!client?.whatsapp) {
                                    toast.error('El cliente no tiene WhatsApp cargado')
                                    return
                                  }
                                  window.open(
                                    buildWhatsappUrl(invoice, client, payment ?? { aliasArs: null, aliasUsd: null, holder: null }),
                                    '_blank',
                                    'noopener,noreferrer',
                                  )
                                }}
                              >
                                <MessageCircle className="h-4 w-4 text-green-500" />
                              </Button>
                            )}
                            {open && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Agregar cargo extra" disabled={busy} onClick={() => setExtraInvoice(invoice)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            {open && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-300"
                                title="Anular"
                                disabled={busy}
                                onClick={() => {
                                  if (window.confirm(`¿Anular la liquidación de ${clientName}?`)) {
                                    run(invoice.id, () => voidBillingInvoice(invoice.id), 'Liquidación anulada')
                                  }
                                }}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clients" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Ocultar archivados' : 'Mostrar archivados'}
            </button>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setClientDialog({ open: true, client: null })}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          </div>
          <Card className="border-border/50 bg-card/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Última liquidación</TableHead>
                  <TableHead>Pagado hasta</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      Todavía no hay clientes.
                    </TableCell>
                  </TableRow>
                )}
                {visibleClients.map((client) => {
                  const plan = client.plan_id ? plansById.get(client.plan_id) : undefined
                  const amount = clientAmountLabel(client, plan)
                  const last = latestByClient.get(client.id)
                  const badge = usageBadge(client, plan, usageByClient[client.id])
                  return (
                    <TableRow key={client.id} className={client.is_active ? '' : 'opacity-60'}>
                      <TableCell className="font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell>{plan?.name ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {amount ?? '—'}
                      </TableCell>
                      <TableCell>
                        {last ? (
                          <span className="flex items-center gap-2">
                            <StatusBadge status={displayStatus(last, today.date)} />
                            <span className="text-xs capitalize text-muted-foreground">{formatMonthLabel(last.month_key)}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="capitalize">
                        {client.paid_until_month_key ? formatMonthLabel(client.paid_until_month_key) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" title={badge.title} className={`border-transparent ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => setClientDialog({ open: true, client })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={client.is_active ? 'Archivar' : 'Restaurar'}
                            onClick={() =>
                              run(
                                client.id,
                                () => updateBillingClient(client.id, { is_active: !client.is_active }),
                                client.is_active ? 'Cliente archivado' : 'Cliente restaurado',
                              )
                            }
                          >
                            {client.is_active ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-3">
          <div className="flex justify-end">
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setPlanDialog({ open: true, plan: null })}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo plan
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.length === 0 && (
              <Card className="border-border/50 bg-card/50 sm:col-span-2 lg:col-span-3">
                <CardContent className="py-6 text-sm text-muted-foreground">Todavía no hay planes.</CardContent>
              </Card>
            )}
            {plans.map((plan) => (
              <Card key={plan.id} className={`border-border/50 bg-card/50 ${plan.is_active ? '' : 'opacity-60'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {plan.name}
                    <span className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => setPlanDialog({ open: true, plan })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={plan.is_active ? 'Archivar' : 'Restaurar'}
                        onClick={() =>
                          run(plan.id, () => updateBillingPlan(plan.id, { is_active: !plan.is_active }), plan.is_active ? 'Plan archivado' : 'Plan restaurado')
                        }
                      >
                        {plan.is_active ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      </Button>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {[
                      Number(plan.monthly_amount) > 0 ? formatCurrency(Number(plan.monthly_amount), plan.currency) : null,
                      Number(plan.usd_amount) > 0 ? formatCurrency(Number(plan.usd_amount), 'USD') : null,
                    ]
                      .filter(Boolean)
                      .join(' + ') || '—'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Disco: {plan.disk_limit_mb != null ? `${plan.disk_limit_mb} MB` : 'sin tope'} · Egreso:{' '}
                    {plan.egress_limit_gb != null ? `${plan.egress_limit_gb} GB` : 'sin tope'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <ClientDialog
        open={clientDialog.open}
        onOpenChange={(open) => setClientDialog((s) => ({ ...s, open }))}
        client={clientDialog.client}
        plans={plans.filter((p) => p.is_active || p.id === clientDialog.client?.plan_id)}
      />
      <PlanDialog open={planDialog.open} onOpenChange={(open) => setPlanDialog((s) => ({ ...s, open }))} plan={planDialog.plan} />
      <PayDialog invoice={payInvoice} clientName={clientsById.get(payInvoice?.client_id ?? '')?.name ?? 'Cliente'} onClose={() => setPayInvoice(null)} />
      <ExtraChargeDialog invoice={extraInvoice} clientName={clientsById.get(extraInvoice?.client_id ?? '')?.name ?? 'Cliente'} onClose={() => setExtraInvoice(null)} />
    </div>
  )
}
