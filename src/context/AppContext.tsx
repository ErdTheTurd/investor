import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AiDecision, AiMessage, AppState, FactorSnapshot, Goal, RiskProfile } from '../types'
import { askDunnAi, runAutonomousInvest } from '../lib/ai'
import { buildUniverseFactors } from '../lib/factors'
import { getQuotes } from '../lib/market'
import {
  applyDecision,
  buy,
  deposit,
  recordEquityPoint,
  sell,
  totalEquity,
  touchStreak,
  withdraw,
} from '../lib/portfolio'
import { loadState, saveState, uid } from '../lib/storage'

interface AppContextValue {
  state: AppState
  prices: Record<string, number>
  factors: FactorSnapshot[]
  equity: number
  loadingMarket: boolean
  aiBusy: boolean
  refreshMarket: () => Promise<void>
  completeOnboarding: (data: {
    name: string
    risk: RiskProfile
    horizonYears: number
    monthlyDeposit: number
    initialDeposit: number
  }) => void
  makeDeposit: (amount: number) => void
  makeWithdraw: (amount: number) => void
  placeBuy: (symbol: string, amount: number) => void
  placeSell: (symbol: string, amount: number) => void
  updateAgent: (patch: Partial<AppState['agent']>) => void
  addGoal: (goal: Omit<Goal, 'id' | 'allocated'>) => void
  sendAiMessage: (content: string) => Promise<void>
  runAiInvest: () => Promise<void>
  executeDecision: (decision: AiDecision, messageId?: string) => void
  resetDemo: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => touchStreak(loadState()))
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [factors, setFactors] = useState<FactorSnapshot[]>([])
  const [loadingMarket, setLoadingMarket] = useState(true)
  const [aiBusy, setAiBusy] = useState(false)

  useEffect(() => {
    saveState(state)
  }, [state])

  const refreshMarket = useCallback(async () => {
    setLoadingMarket(true)
    try {
      const quotes = await getQuotes()
      const map: Record<string, number> = {}
      for (const q of quotes) map[q.symbol] = q.price
      setPrices(map)
      const f = await buildUniverseFactors()
      setFactors(f)
      setState((s) => recordEquityPoint(s, totalEquity(s, map)))
    } finally {
      setLoadingMarket(false)
    }
  }, [])

  useEffect(() => {
    void refreshMarket()
    const id = window.setInterval(() => void refreshMarket(), 5 * 60_000)
    return () => window.clearInterval(id)
  }, [refreshMarket])

  const equity = useMemo(() => totalEquity(state, prices), [state, prices])

  const completeOnboarding: AppContextValue['completeOnboarding'] = (data) => {
    setState((s) => {
      let next: AppState = {
        ...s,
        profile: {
          ...s.profile,
          name: data.name,
          risk: data.risk,
          horizonYears: data.horizonYears,
          monthlyDeposit: data.monthlyDeposit,
          onboardingComplete: true,
        },
        agent: { ...s.agent, riskBias: data.risk },
      }
      if (data.initialDeposit > 0) next = deposit(next, data.initialDeposit, 'Opening deposit')
      return next
    })
  }

  const makeDeposit = (amount: number) => setState((s) => deposit(s, amount))
  const makeWithdraw = (amount: number) => setState((s) => withdraw(s, amount))
  const placeBuy = (symbol: string, amount: number) => {
    const price = prices[symbol]
    if (!price) return
    setState((s) => buy(s, symbol, amount, price))
  }
  const placeSell = (symbol: string, amount: number) => {
    const price = prices[symbol]
    if (!price) return
    setState((s) => sell(s, symbol, amount, price))
  }

  const updateAgent = (patch: Partial<AppState['agent']>) =>
    setState((s) => ({ ...s, agent: { ...s.agent, ...patch } }))

  const addGoal = (goal: Omit<Goal, 'id' | 'allocated'>) =>
    setState((s) => ({
      ...s,
      goals: [...s.goals, { ...goal, id: uid('goal'), allocated: 0 }],
    }))

  const executeDecision = (decision: AiDecision, messageId?: string) => {
    const price = prices[decision.symbol]
    if (!price && decision.action !== 'hold') return
    setState((s) => {
      const result = applyDecision(s, decision, price || 0)
      if (!messageId) return result.state
      return {
        ...result.state,
        aiMessages: result.state.aiMessages.map((m) =>
          m.id === messageId && m.trade
            ? { ...m, trade: { ...m.trade, executed: result.executed }, content: `${m.content}\n\n${result.message}` }
            : m,
        ),
      }
    })
  }

  const sendAiMessage = async (content: string) => {
    const userMsg: AiMessage = {
      id: uid('msg'),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setState((s) => ({ ...s, aiMessages: [...s.aiMessages, userMsg] }))
    setAiBusy(true)
    try {
      const history = state.aiMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      const { reply, decision } = await askDunnAi({
        userMessage: content,
        state,
        factors,
        prices,
        history,
      })
      const assistant: AiMessage = {
        id: uid('msg'),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
        trade: decision
          ? {
              action: decision.action,
              symbol: decision.symbol,
              amount: decision.amount,
              rationale: decision.rationale,
              executed: false,
            }
          : undefined,
      }
      setState((s) => {
        let next = { ...s, aiMessages: [...s.aiMessages, assistant] }
        if (
          decision &&
          decision.action !== 'hold' &&
          decision.amount > 0 &&
          decision.amount <= s.agent.autoApproveUnder &&
          s.agent.enabled
        ) {
          const applied = applyDecision(next, decision, prices[decision.symbol] || 0)
          next = {
            ...applied.state,
            aiMessages: applied.state.aiMessages.map((m) =>
              m.id === assistant.id && m.trade
                ? {
                    ...m,
                    trade: { ...m.trade, executed: applied.executed },
                    content: `${m.content}\n\n${applied.message}`,
                  }
                : m,
            ),
          }
        }
        return next
      })
    } catch (err) {
      const assistant: AiMessage = {
        id: uid('msg'),
        role: 'assistant',
        content: `I hit a snag reaching the model (${err instanceof Error ? err.message : 'error'}). Try again in a moment — Puter or the keyless fallback should reconnect.`,
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, aiMessages: [...s.aiMessages, assistant] }))
    } finally {
      setAiBusy(false)
    }
  }

  const runAiInvest = async () => {
    if (!state.agent.enabled) return
    setAiBusy(true)
    try {
      const remaining = Math.max(0, state.agent.dailyAllowance - state.agent.spentToday)
      const { reply, decision } = await runAutonomousInvest({
        state,
        factors,
        prices,
        remainingAllowance: remaining,
      })
      const assistant: AiMessage = {
        id: uid('msg'),
        role: 'assistant',
        content: `Auto-Invest cycle\n\n${reply}`,
        createdAt: new Date().toISOString(),
        trade: decision
          ? {
              action: decision.action,
              symbol: decision.symbol,
              amount: decision.amount,
              rationale: decision.rationale,
              executed: false,
            }
          : undefined,
      }
      setState((s) => {
        let next = { ...s, aiMessages: [...s.aiMessages, assistant] }
        if (decision && decision.action !== 'hold') {
          const applied = applyDecision(next, decision, prices[decision.symbol] || 0)
          next = {
            ...applied.state,
            aiMessages: applied.state.aiMessages.map((m) =>
              m.id === assistant.id && m.trade
                ? {
                    ...m,
                    trade: { ...m.trade, executed: applied.executed },
                    content: `${m.content}\n\n${applied.message}`,
                  }
                : m,
            ),
          }
        }
        return next
      })
    } finally {
      setAiBusy(false)
    }
  }

  const resetDemo = () => {
    localStorage.removeItem('dunn-investing-v1')
    setState(touchStreak(loadState()))
  }

  const value: AppContextValue = {
    state,
    prices,
    factors,
    equity,
    loadingMarket,
    aiBusy,
    refreshMarket,
    completeOnboarding,
    makeDeposit,
    makeWithdraw,
    placeBuy,
    placeSell,
    updateAgent,
    addGoal,
    sendAiMessage,
    runAiInvest,
    executeDecision,
    resetDemo,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}
