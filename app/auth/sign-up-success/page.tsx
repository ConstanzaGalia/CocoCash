import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import Link from 'next/link'

export default function SignUpSuccessPage() {
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
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Registro exitoso</CardTitle>
              <CardDescription>
                Revisa tu email para confirmar tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Te enviamos un email de confirmacion. Una vez que confirmes tu cuenta, podras iniciar sesion.
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
