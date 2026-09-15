'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Dashboard } from '@/components/dashboard'
import { TransactionsView } from '@/components/transactions-view'
import { FixedExpensesView } from '@/components/fixed-expenses-view'
import { IncomeSourcesView } from '@/components/income-sources-view'
import { SavingsView } from '@/components/savings-view'
import { QuickCashFab } from '@/components/quick-expense-fab'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [userEmail, setUserEmail] = useState<string>()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view')
    if (
      view === 'income' ||
      view === 'transactions' ||
      view === 'fixed-expenses' ||
      view === 'savings'
    ) {
      setActiveTab(view)
    }

    const getUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email)
      }
    }
    getUser()
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />
      case 'transactions':
        return <TransactionsView />
      case 'fixed-expenses':
        return <FixedExpensesView />
      case 'income':
        return <IncomeSourcesView />
      case 'savings':
        return <SavingsView />
      default:
        return <Dashboard onNavigate={setActiveTab} />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} userEmail={userEmail} />
      <main
        className={cn(
          'transition-all duration-300 px-4 pt-[4.5rem] pb-36 md:ml-64 md:px-8 md:pt-8 md:pb-8',
        )}
      >
        <div className="max-w-7xl mx-auto">{renderContent()}</div>
      </main>
      <QuickCashFab />
    </div>
  )
}
