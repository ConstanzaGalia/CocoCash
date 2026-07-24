'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Dashboard } from '@/components/dashboard'
import { AccountsView } from '@/components/accounts-view'
import { SubscriptionsView } from '@/components/subscriptions-view'
import { CreditCardsView } from '@/components/credit-cards-view'
import { TransactionsView } from '@/components/transactions-view'
import { FixedExpensesView } from '@/components/fixed-expenses-view'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [userEmail, setUserEmail] = useState<string>()

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email)
      }
    }
    getUser()
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'accounts':
        return <AccountsView />
      case 'subscriptions':
        return <SubscriptionsView />
      case 'cards':
        return <CreditCardsView />
      case 'transactions':
        return <TransactionsView />
      case 'fixed-expenses':
        return <FixedExpensesView />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} userEmail={userEmail} />
      <main className={cn(
        'transition-all duration-300 pb-20 md:pb-0',
        'md:ml-64 p-6 md:p-8'
      )}>
        <div className="max-w-7xl mx-auto pt-12 md:pt-0">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
