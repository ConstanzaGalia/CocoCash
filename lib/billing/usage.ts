import type { createAdminClient } from '@/lib/supabase/admin'
import { loadActiveClients, loadPlansById } from '@/lib/billing/invoices'
import { errorMessage } from '@/lib/billing/shared'

type Admin = ReturnType<typeof createAdminClient>

/** Tamaño de la base vía Management API (endpoint beta: POST /v1/projects/{ref}/database/query). */
async function fetchDatabaseSizeMb(projectRef: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('Falta SUPABASE_ACCESS_TOKEN')

  const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select pg_database_size(current_database()) as bytes' }),
  })
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const rows = (await res.json()) as { bytes?: number | string }[]
  const bytes = Number(rows?.[0]?.bytes)
  if (!Number.isFinite(bytes)) throw new Error('Respuesta inesperada de la Management API')
  return bytes / (1024 * 1024)
}

export async function measureUsage(admin: Admin, userId: string, dry: boolean) {
  const [clients, plans] = await Promise.all([loadActiveClients(admin, userId), loadPlansById(admin, userId)])
  const results: { client: string; diskMb?: number; limitMb?: number | null; over?: boolean; error?: string }[] = []
  const over: { name: string }[] = []

  for (const client of clients) {
    if (!client.supabase_project_ref) continue
    const plan = client.plan_id ? plans.get(client.plan_id) : null
    const limitMb = plan?.disk_limit_mb ?? null

    let diskMb: number | null = null
    let error: string | null = null
    try {
      diskMb = Math.round((await fetchDatabaseSizeMb(client.supabase_project_ref)) * 100) / 100
    } catch (e) {
      error = errorMessage(e)
    }

    const overDisk = diskMb != null && limitMb != null && diskMb > limitMb
    if (overDisk) over.push({ name: client.name })
    results.push({
      client: client.name,
      diskMb: diskMb ?? undefined,
      limitMb,
      over: overDisk,
      error: error ?? undefined,
    })

    if (!dry) {
      // Egreso queda sin medir hasta confirmar que la API lo entregue por proyecto
      await admin.from('billing_usage_snapshots').insert({
        user_id: userId,
        client_id: client.id,
        disk_mb: diskMb,
        egress_gb: null,
        over_disk: overDisk,
        over_egress: false,
        error,
      })
    }
  }

  return { results, over: over.map((o) => o.name) }
}

/** Consulta mínima a la base propia para que el proyecto gratuito no se pause por inactividad. */
export async function keepOwnDatabaseAlive(admin: Admin) {
  const { error } = await admin.from('accounts').select('id').limit(1)
  return error ? { ok: false, error: error.message } : { ok: true }
}
