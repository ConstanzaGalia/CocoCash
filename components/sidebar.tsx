'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  FileText,
  PiggyBank,
  PieChart,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  userEmail?: string
}

const navItems = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, mobileNav: true },
  { id: 'income', label: 'Ingresos', icon: TrendingUp, mobileNav: true },
  { id: 'savings', label: 'Ahorros', icon: PiggyBank, mobileNav: true },
  { id: 'fixed-expenses', label: 'Fijos', icon: FileText, mobileNav: true },
  { id: 'transactions', label: 'Movimientos', icon: Receipt, mobileNav: true },
  { id: 'comparatives', label: 'Comparativas', icon: PieChart, mobileNav: false },
]

export function Sidebar({ activeTab, onTabChange, userEmail }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-sidebar-border bg-background/95 pt-[var(--safe-top)] backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Logo size={40} />
        </div>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-dvh bg-sidebar border-r border-sidebar-border pt-[var(--safe-top)] transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          <div
            className={cn(
              'flex items-center border-b border-sidebar-border px-3',
              collapsed ? 'h-16 justify-center' : 'h-20 justify-between gap-2',
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </Button>
            <Logo size={collapsed ? 36 : 52} />
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id)
                    setMobileOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              )
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-3 border-t border-sidebar-border space-y-2">
            {!collapsed && userEmail && (
              <div className="px-3 py-2 text-xs text-muted-foreground truncate">
                {userEmail}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'w-full text-red-400 hover:text-red-300 hover:bg-red-500/10',
                collapsed ? 'justify-center' : 'justify-start'
              )}
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span className="ml-2">Cerrar sesion</span>}
            </Button>
          </div>

          {/* Collapse Toggle */}
          <div className="p-3 border-t border-sidebar-border hidden md:block">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  <span>Colapsar</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-stretch">
          {navItems.filter((item) => item.mobileNav).map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5 transition-colors',
                  isActive ? 'text-emerald-500' : 'text-sidebar-foreground',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate text-[10px] leading-tight">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
