import type {
  Account,
  CardStatementPayment,
  Currency,
  FixedExpensePayment,
  MonthlyIncome,
  Transaction,
  Transfer,
} from '@/lib/types'
import { dateToMonthKey } from '@/lib/utils'

export type MonthFlow = {
  income: number
  extra: number
  paidFixed: number
  variable: number
  saved: number
  leftover: number
}

export function computeFlowForMonth(
  monthKey: string,
  monthlyIncomes: MonthlyIncome[],
  payments: FixedExpensePayment[],
  transactions: Transaction[],
  transfers: Transfer[],
  savingsIds: Set<string>,
  cardPayments: CardStatementPayment[] = [],
): { ARS: MonthFlow; USD: MonthFlow } {
  const monthIncomes = monthlyIncomes.filter((income) => income.month_key === monthKey)
  const monthPayments = payments.filter((payment) => payment.month_key === monthKey)
  const monthCardPayments = cardPayments.filter((payment) => payment.month_key === monthKey)
  const linkedIncomeTxIds = new Set(
    monthIncomes.map((income) => income.transaction_id).filter(Boolean) as string[],
  )
  const linkedExpenseTxIds = new Set(
    [
      ...monthPayments.map((payment) => payment.transaction_id),
      ...monthCardPayments.map((payment) => payment.transaction_id),
    ].filter(Boolean) as string[],
  )
  const monthTransactions = transactions.filter((tx) => dateToMonthKey(tx.date) === monthKey)

  const forCurrency = (currency: Currency): MonthFlow => {
    const extra = monthTransactions
      .filter((tx) => tx.type === 'income' && !linkedIncomeTxIds.has(tx.id) && tx.currency === currency)
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
    const income = monthIncomes
      .filter((income) => income.currency === currency)
      .reduce((sum, income) => sum + Number(income.amount), 0)
    const paidFixed =
      monthPayments
        .filter((payment) => payment.currency === currency)
        .reduce((sum, payment) => sum + Number(payment.amount_paid), 0) +
      monthCardPayments
        .filter((payment) => payment.currency === currency)
        .reduce((sum, payment) => sum + Number(payment.amount_paid), 0)
    const variable = monthTransactions
      .filter(
        (tx) => tx.type === 'expense' && tx.currency === currency && !linkedExpenseTxIds.has(tx.id),
      )
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
    const saved = transfers
      .filter((transfer) => {
        const destCurrency = transfer.to_currency || transfer.currency
        return (
          destCurrency === currency &&
          savingsIds.has(transfer.to_account_id) &&
          dateToMonthKey(transfer.date) === monthKey
        )
      })
      .reduce((sum, transfer) => sum + Number(transfer.to_amount ?? transfer.amount), 0)

    return {
      extra,
      income,
      paidFixed,
      variable,
      saved,
      leftover: income - paidFixed - variable - saved,
    }
  }

  return { ARS: forCurrency('ARS'), USD: forCurrency('USD') }
}

function savingsAccountIds(accounts: Account[]) {
  return new Set(accounts.filter((account) => account.kind === 'savings').map((account) => account.id))
}

function cashFromCobros(
  currency: Currency,
  monthlyIncomes: MonthlyIncome[],
  payments: FixedExpensePayment[],
  transactions: Transaction[],
  cardPayments: CardStatementPayment[] = [],
) {
  const cobroMonths = [...new Set(monthlyIncomes.map((income) => income.month_key))]
  return cobroMonths.reduce((sum, monthKey) => {
    const flow = computeFlowForMonth(
      monthKey,
      monthlyIncomes,
      payments,
      transactions,
      [],
      new Set(),
      cardPayments,
    )
    return sum + flow[currency].income - flow[currency].paidFixed - flow[currency].variable
  }, 0)
}

function cashFromTransactions(
  currency: Currency,
  transactions: Transaction[],
  payments: FixedExpensePayment[],
  cardPayments: CardStatementPayment[] = [],
) {
  const paymentTxIds = new Set(
    [
      ...payments.map((payment) => payment.transaction_id),
      ...cardPayments.map((payment) => payment.transaction_id),
    ].filter(Boolean) as string[],
  )
  const income = transactions
    .filter((tx) => tx.type === 'income' && tx.currency === currency)
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const expenses = transactions
    .filter((tx) => tx.type === 'expense' && tx.currency === currency && !paymentTxIds.has(tx.id))
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const paidFixed =
    payments
      .filter((payment) => payment.currency === currency)
      .reduce((sum, payment) => sum + Number(payment.amount_paid), 0) +
    cardPayments
      .filter((payment) => payment.currency === currency)
      .reduce((sum, payment) => sum + Number(payment.amount_paid), 0)
  return income - paidFixed - expenses
}

function availableFromTransfers(currency: Currency, transfers: Transfer[], savingsIds: Set<string>) {
  let delta = 0
  for (const transfer of transfers) {
    const fromSavings = savingsIds.has(transfer.from_account_id)
    const toSavings = savingsIds.has(transfer.to_account_id)
    const fromCurrency = transfer.currency
    const toCurrency = transfer.to_currency || transfer.currency
    const fromAmount = Number(transfer.amount)
    const toAmount = Number(transfer.to_amount ?? transfer.amount)
    if (!fromSavings && fromCurrency === currency) delta -= fromAmount
    if (!toSavings && toCurrency === currency) delta += toAmount
  }
  return delta
}

export function computeWalletTotals(
  accounts: Account[],
  transactions: Transaction[],
  transfers: Transfer[],
  payments: FixedExpensePayment[] = [],
  monthlyIncomes: MonthlyIncome[] = [],
  cardPayments: CardStatementPayment[] = [],
) {
  const savingsIds = savingsAccountIds(accounts)
  const hasCobros = monthlyIncomes.length > 0

  const spendable = (currency: Currency) => {
    const operating = hasCobros
      ? cashFromCobros(currency, monthlyIncomes, payments, transactions, cardPayments)
      : cashFromTransactions(currency, transactions, payments, cardPayments)
    return operating + availableFromTransfers(currency, transfers, savingsIds)
  }

  let savingsArs = 0
  let savingsUsd = 0
  for (const transfer of transfers) {
    const fromSavings = savingsIds.has(transfer.from_account_id)
    const toSavings = savingsIds.has(transfer.to_account_id)
    if (fromSavings) {
      if (transfer.currency === 'USD') savingsUsd -= Number(transfer.amount)
      else savingsArs -= Number(transfer.amount)
    }
    if (toSavings) {
      const currency = transfer.to_currency || transfer.currency
      const amount = Number(transfer.to_amount ?? transfer.amount)
      if (currency === 'USD') savingsUsd += amount
      else savingsArs += amount
    }
  }

  return {
    availableArs: spendable('ARS'),
    availableUsd: spendable('USD'),
    savingsArs,
    savingsUsd,
  }
}
