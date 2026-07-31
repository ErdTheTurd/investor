import type { AppState, Holding, Transaction, AiDecision } from '../types'
import { UNIVERSE } from '../types'
import { uid, todayKey } from './storage'

export function totalEquity(state: AppState, prices: Record<string, number>) {
  const holdings = state.holdings.reduce((s, h) => s + h.shares * (prices[h.symbol] ?? h.avgCost), 0)
  return state.cash + holdings
}

export function deposit(state: AppState, amount: number, note = 'Deposit'): AppState {
  if (amount <= 0) return state
  const tx: Transaction = {
    id: uid('tx'),
    type: 'deposit',
    amount,
    note,
    createdAt: new Date().toISOString(),
  }
  return {
    ...state,
    cash: state.cash + amount,
    transactions: [tx, ...state.transactions],
  }
}

export function withdraw(state: AppState, amount: number): AppState {
  const amt = Math.min(amount, state.cash)
  if (amt <= 0) return state
  const tx: Transaction = {
    id: uid('tx'),
    type: 'withdraw',
    amount: amt,
    createdAt: new Date().toISOString(),
  }
  return {
    ...state,
    cash: state.cash - amt,
    transactions: [tx, ...state.transactions],
  }
}

function upsertHolding(holdings: Holding[], symbol: string, shares: number, price: number): Holding[] {
  const meta = UNIVERSE.find((u) => u.symbol === symbol)
  const existing = holdings.find((h) => h.symbol === symbol)
  if (!existing) {
    if (shares <= 0) return holdings
    return [
      ...holdings,
      {
        symbol,
        name: meta?.name ?? symbol,
        shares,
        avgCost: price,
        assetClass: meta?.assetClass ?? 'us_equity',
      },
    ]
  }
  const nextShares = existing.shares + shares
  if (nextShares <= 1e-8) return holdings.filter((h) => h.symbol !== symbol)
  if (shares > 0) {
    const avgCost = (existing.avgCost * existing.shares + price * shares) / nextShares
    return holdings.map((h) => (h.symbol === symbol ? { ...h, shares: nextShares, avgCost } : h))
  }
  return holdings.map((h) => (h.symbol === symbol ? { ...h, shares: nextShares } : h))
}

export function buy(
  state: AppState,
  symbol: string,
  usdAmount: number,
  price: number,
  ai = false,
): AppState {
  const amount = Math.min(usdAmount, state.cash)
  if (amount <= 0 || price <= 0) return state
  const shares = amount / price
  const tx: Transaction = {
    id: uid('tx'),
    type: ai ? 'ai_buy' : 'buy',
    symbol,
    amount,
    shares,
    price,
    note: ai ? 'Dunn AI buy' : 'Buy',
    createdAt: new Date().toISOString(),
  }
  return {
    ...state,
    cash: state.cash - amount,
    holdings: upsertHolding(state.holdings, symbol, shares, price),
    transactions: [tx, ...state.transactions],
  }
}

export function sell(
  state: AppState,
  symbol: string,
  usdAmount: number,
  price: number,
  ai = false,
): AppState {
  const holding = state.holdings.find((h) => h.symbol === symbol)
  if (!holding || price <= 0) return state
  const maxUsd = holding.shares * price
  const amount = Math.min(usdAmount, maxUsd)
  if (amount <= 0) return state
  const shares = amount / price
  const tx: Transaction = {
    id: uid('tx'),
    type: ai ? 'ai_sell' : 'sell',
    symbol,
    amount,
    shares,
    price,
    note: ai ? 'Dunn AI sell' : 'Sell',
    createdAt: new Date().toISOString(),
  }
  return {
    ...state,
    cash: state.cash + amount,
    holdings: upsertHolding(state.holdings, symbol, -shares, price),
    transactions: [tx, ...state.transactions],
  }
}

export function applyDecision(
  state: AppState,
  decision: AiDecision,
  price: number,
): { state: AppState; executed: boolean; message: string } {
  if (decision.action === 'hold' || decision.amount <= 0) {
    return { state, executed: false, message: decision.rationale || 'Holding for now.' }
  }
  const today = todayKey()
  let agent = { ...state.agent }
  if (agent.spentDate !== today) {
    agent = { ...agent, spentDate: today, spentToday: 0 }
  }
  const remaining = Math.max(0, agent.dailyAllowance - agent.spentToday)
  const sized = Math.min(decision.amount, remaining)
  if (sized <= 0) {
    return { state, executed: false, message: 'Daily AI allowance exhausted.' }
  }

  if (decision.action === 'buy') {
    const next = buy({ ...state, agent }, decision.symbol, sized, price, true)
    if (next.cash === state.cash) {
      return { state, executed: false, message: 'Not enough cash to buy.' }
    }
    const spent = state.cash - next.cash
    return {
      state: {
        ...next,
        agent: { ...next.agent, spentToday: next.agent.spentToday + spent, lastRunAt: new Date().toISOString() },
      },
      executed: true,
      message: `Bought $${spent.toFixed(2)} of ${decision.symbol}.`,
    }
  }

  const next = sell({ ...state, agent }, decision.symbol, sized, price, true)
  if (next === state || next.cash === state.cash) {
    return { state, executed: false, message: `No ${decision.symbol} position to sell.` }
  }
  const proceeds = next.cash - state.cash
  return {
    state: {
      ...next,
      agent: { ...next.agent, spentToday: next.agent.spentToday + proceeds, lastRunAt: new Date().toISOString() },
    },
    executed: true,
    message: `Sold $${proceeds.toFixed(2)} of ${decision.symbol}.`,
  }
}

export function recordEquityPoint(state: AppState, equity: number): AppState {
  const date = todayKey()
  const history = [...state.equityHistory]
  const last = history[history.length - 1]
  if (last?.date === date) {
    history[history.length - 1] = { date, value: equity }
  } else {
    history.push({ date, value: equity })
  }
  return { ...state, equityHistory: history.slice(-120) }
}

export function touchStreak(state: AppState): AppState {
  const today = todayKey()
  const last = state.profile.lastVisit
  if (last === today) return state
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yKey = yesterday.toISOString().slice(0, 10)
  const streakDays = last === yKey ? state.profile.streakDays + 1 : 1
  return {
    ...state,
    profile: { ...state.profile, lastVisit: today, streakDays },
  }
}
