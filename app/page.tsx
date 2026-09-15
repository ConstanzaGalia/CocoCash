import Link from 'next/link'
import {
  ArrowRight,
  Check,
  PieChart,
  PiggyBank,
  Shield,
  Smartphone,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

const stats = [
  { label: 'Ingresos', value: '$850.000', hint: 'ARS este mes' },
  { label: 'Fijos', value: '$420.000', hint: 'alquiler, servicios' },
  { label: 'Variables', value: '$180.000', hint: 'día a día' },
  { label: 'Ahorros', value: 'USD 120', hint: 'bolsillo aparte' },
]

const pillars = [
  {
    icon: TrendingUp,
    title: 'Fuentes de ingreso',
    description: 'Registrá cobros por sueldo, freelance u otros. Sabés cuánto entró este mes.',
    snippet: ['Sueldo · ARS', 'Freelance · USD', 'Extra · ARS'],
  },
  {
    icon: Wallet,
    title: 'Fijos y vencimientos',
    description: 'Alquiler, servicios y tarjetas con día de pago. Marcá lo pagado y seguí el avance.',
    snippet: ['Alquiler · día 5', 'Luz · día 12', 'Tarjeta · día 20'],
  },
  {
    icon: PiggyBank,
    title: 'Bolsillos ARS y USD',
    description: 'Disponible y ahorros separados por moneda. Traspasá entre bolsillos con tipo de cambio.',
    snippet: ['Disponible ARS', 'Ahorro USD', 'Transferencias FX'],
  },
  {
    icon: PieChart,
    title: 'Comparativas',
    description: 'Mirás fijos vs variables en el tiempo y el desglose por categoría o gasto fijo.',
    snippet: ['Últimos 3 / 6 meses', 'Año completo', 'Por gasto fijo'],
  },
]

const faqs = [
  {
    q: '¿Mis datos están seguros?',
    a: 'Sí. La autenticación y la base de datos corren en Supabase con filas aisladas por usuario (RLS). Solo vos ves tu información.',
  },
  {
    q: '¿Puedo instalarla en el teléfono?',
    a: 'Sí. CocoCash es una PWA: desde el navegador podés agregarla a la pantalla de inicio en Android e iOS.',
  },
  {
    q: '¿Sirve para pesos y dólares?',
    a: 'Sí. Trabajás en ARS y USD a la vez, con bolsillos separados y transferencias entre monedas.',
  },
  {
    q: '¿Se conecta a mi banco?',
    a: 'No. No vincula home banking ni lee movimientos automáticamente. Vos cargás lo que importa para tu presupuesto.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Logo size={44} showText textClassName="text-lg" />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#caracteristicas" className="hover:text-foreground">
              Características
            </a>
            <a href="#preguntas" className="hover:text-foreground">
              Preguntas
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/auth/login" className="hidden sm:block">
              <Button variant="ghost">Iniciar sesión</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button className="bg-primary hover:bg-primary/90">Empezar gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 pb-16 pt-16 md:pb-24 md:pt-24">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in oklab, var(--primary) 18%, transparent), transparent)',
          }}
        />
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Smartphone className="h-3.5 w-3.5 text-primary" />
            Bimonetario + instalable
          </span>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Tu mes, claro.
            <span className="block text-primary">Sin sorpresas a fin de mes.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            CocoCash es un presupuesto mensual simple: ingresos, fijos, variables y ahorros en
            pesos y dólares. Hecho para Argentina.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button size="lg" className="bg-primary px-8 hover:bg-primary/90">
                Empezar gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="px-8">
                Ya tengo cuenta
              </Button>
            </Link>
          </div>
          <ul className="mt-8 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground sm:flex-row sm:gap-6">
            {[
              'Registro con email',
              'Tus datos, solo tuyos',
              'Instalable como app',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 text-xl font-bold text-foreground md:text-2xl">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="caracteristicas" className="border-t border-border/60 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Cuatro pilares del mes</h2>
            <p className="mt-3 text-muted-foreground">
              Todo lo que necesitás para saber qué te queda, sin planillas ni apps genéricas.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {pillars.map((pillar) => {
              const Icon = pillar.icon
              return (
                <div
                  key={pillar.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{pillar.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{pillar.description}</p>
                  <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-4">
                    {pillar.snippet.map((line) => (
                      <li key={line} className="text-sm text-foreground/80">
                        · {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 bg-muted/40 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">
            Home banking vs CocoCash
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-muted-foreground">Home banking</h3>
              <ul className="space-y-3 text-sm">
                {[
                  'Movimientos sueltos, sin presupuesto',
                  'No separa fijos de variables',
                  'Difícil ver ARS y USD juntos',
                  'No te dice “qué me queda”',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-primary">CocoCash</h3>
              <ul className="space-y-3 text-sm">
                {[
                  'Flujo del mes: cobros, fijos, variables',
                  'Ahorros en bolsillos aparte',
                  'ARS y USD nativos',
                  'Comparativas de varios meses',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="preguntas" className="border-t border-border/60 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 flex items-center justify-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-2xl border border-border bg-card px-5 py-4 shadow-sm open:shadow-md"
              >
                <summary className="cursor-pointer list-none font-medium outline-none marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {faq.q}
                    <span className="text-muted-foreground transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 px-6 py-20">
        <div className="mx-auto max-w-3xl rounded-3xl bg-primary px-8 py-12 text-center text-primary-foreground shadow-lg">
          <h2 className="text-3xl font-bold tracking-tight">Empezá a ordenar tu mes</h2>
          <p className="mx-auto mt-3 max-w-md text-primary-foreground/85">
            Creá tu cuenta gratis y cargá el primer cobro en minutos.
          </p>
          <Link href="/auth/sign-up" className="mt-8 inline-block">
            <Button
              size="lg"
              variant="secondary"
              className="bg-card text-foreground hover:bg-card/90"
            >
              Crear cuenta gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <Logo size={32} showText textClassName="text-sm" />
          <p>© 2026 CocoCash. Tu mes, bajo control.</p>
        </div>
      </footer>
    </div>
  )
}
