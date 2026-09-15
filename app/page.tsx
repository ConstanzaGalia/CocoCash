import { Button } from '@/components/ui/button'
import { Wallet, TrendingUp, CreditCard, Shield, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/logo'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size={56} />
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost">Iniciar sesion</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                Registrarse
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 md:py-32">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Gestiona tus finanzas
            <span className="text-emerald-500"> de forma inteligente</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Controlá tus cobros, gastos fijos y movimientos en un solo lugar.
            Nunca más te quedes sin saber qué te queda del mes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/sign-up">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8">
                Comenzar gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Ya tengo cuenta
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">
            Todo lo que necesitas para tus finanzas
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={Wallet}
              title="Multiples cuentas"
              description="Gestiona todas tus cuentas bancarias en pesos y dolares"
            />
            <FeatureCard
              icon={CreditCard}
              title="Tarjetas de credito"
              description="Controla limites, cierres y vencimientos de tus tarjetas"
            />
            <FeatureCard
              icon={TrendingUp}
              title="Gastos fijos"
              description="Recordatorios de pagos mensuales para no olvidar nada"
            />
            <FeatureCard
              icon={Shield}
              title="Seguro y privado"
              description="Tus datos estan protegidos y solo tu puedes acceder"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Comienza a controlar tu dinero hoy
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Crea tu cuenta gratis y empieza a gestionar tus finanzas de forma simple y efectiva.
          </p>
          <Link href="/auth/sign-up">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700">
              Crear cuenta gratis
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>2024 CocoCash. Gestiona tus finanzas de forma inteligente.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur">
      <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-emerald-500" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
