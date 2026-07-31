import type { AppState, UserProfile, AiAgentSettings } from '../types'

const KEY = 'dunn-investing-v1'

export function defaultProfile(): UserProfile {
  const today = new Date().toISOString().slice(0, 10)
  return {
    name: '',
    risk: 'balanced',
    horizonYears: 10,
    monthlyDeposit: 100,
    onboardingComplete: false,
    streakDays: 1,
    lastVisit: today,
    createdAt: new Date().toISOString(),
  }
}

export function defaultAgent(): AiAgentSettings {
  return {
    enabled: false,
    dailyAllowance: 50,
    spentToday: 0,
    spentDate: new Date().toISOString().slice(0, 10),
    riskBias: 'balanced',
    autoApproveUnder: 25,
  }
}

export function defaultState(): AppState {
  const today = new Date().toISOString().slice(0, 10)
  return {
    profile: defaultProfile(),
    cash: 0,
    holdings: [],
    transactions: [],
    goals: [],
    aiMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "I'm Dunn AI — a real language model wired into live market factors. Ask me anything about your portfolio, or turn on Auto-Invest and set an allowance so I can place trades for you.",
        createdAt: new Date().toISOString(),
      },
    ],
    agent: defaultAgent(),
    equityHistory: [{ date: today, value: 0 }],
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as AppState
    return { ...defaultState(), ...parsed, profile: { ...defaultProfile(), ...parsed.profile }, agent: { ...defaultAgent(), ...parsed.agent } }
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatPct(n: number) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}
