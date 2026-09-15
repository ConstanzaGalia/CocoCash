import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { XCircle } from 'lucide-react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Logo size={80} className="justify-center" />
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <CardTitle className="text-2xl">Error de autenticacion</CardTitle>
              <CardDescription>
                Hubo un problema al procesar tu solicitud
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                El enlace puede haber expirado o ya fue utilizado. Por favor intenta nuevamente.
              </p>
              <Link
                href="/auth/login"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Volver al login
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
