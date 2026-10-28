export interface FxQuote {
  rate: number
  /** 'blue' = cotización del día; 'default' = respaldo fijo porque la API falló. */
  source: 'blue' | 'default'
}

const DEFAULT_RATE = 1560

/** Cotización de respaldo: BILLING_DEFAULT_USD_RATE si está definida, si no 1560. */
export function defaultRate() {
  const configured = Number(process.env.BILLING_DEFAULT_USD_RATE)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RATE
}

/** Dólar blue (venta) del día vía dolarapi.com; si no responde, usa la cotización de respaldo. */
export async function fetchBlueRate(): Promise<FxQuote> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares/blue', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`dolarapi ${res.status}`)
      const rate = Number((await res.json()).venta)
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Cotización inválida')
      return { rate, source: 'blue' }
    } catch (error) {
      console.error('[billing/fx]', error)
    }
  }
  return { rate: defaultRate(), source: 'default' }
}
