import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AiDecision, AiMessage, AppState, FactorSnapshot, Goal, Quote, RiskProfile } from '../types'
import { buildUniverseFactors } from '../lib/factors'
import { formatAsOf, getQuotes, marketIsSimulated } from '../lib/market'
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
  quotes: Record<string, Quote>
  factors: FactorSnapshot[]
  equity: number
  loadingMarket: boolean
  aiBusy: boolean
  /** True when any universe quote is synthetic fallback data. */
  marketSimulated: boolean
  /** Newest as-of across loaded quotes, if any. */
  marketAsOf: string | null
  marketAsOfLabel: string
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
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [factors, setFactors] = useState<FactorSnapshot[]>([])
  const [loadingMarket, setLoadingMarket] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [marketReady, setMarketReady] = useState(false)
  const [marketSimulated, setMarketSimulated] = useState(true)
  const [marketAsOf, setMarketAsOf] = useState<string | null>(null)
  const marketSimulatedRef = useRef(true)
  const pricesRef = useRef<Record<string, number>>({})

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    marketSimulatedRef.current = marketSimulated
  }, [marketSimulated])

  useEffect(() => {
    pricesRef.current = prices
  }, [prices])

  const refreshMarket = useCallback(async () => {
    setLoadingMarket(true)
    try {
      const list = await getQuotes()
      const map: Record<string, number> = {}
      const qmap: Record<string, Quote> = {}
      let newest: string | null = null
      for (const q of list) {
        map[q.symbol] = q.price
        qmap[q.symbol] = q
        if (q.asOf && (!newest || q.asOf > newest)) newest = q.asOf
      }
      const simulated = marketIsSimulated(list)
      setPrices(map)
      setQuotes(qmap)
      pricesRef.current = map
      marketSimulatedRef.current = simulated
      setMarketSimulated(simulated)
      setMarketAsOf(newest)
      const f = await buildUniverseFactors()
      setFactors(f)
      setState((s) => recordEquityPoint(s, totalEquity(s, map)))
      setMarketReady(true)
    } finally {
      setLoadingMarket(false)
    }
  }, [])

  // Defer market work until the first paint — landing stays instant.
  useEffect(() => {
    let cancelled = false
    let intervalId = 0
    let timeoutId = 0
    const start = () => {
      if (cancelled) return
      void refreshMarket()
      intervalId = window.setInterval(() => void refreshMarket(), 5 * 60_000)
    }
    timeoutId = window.setTimeout(start, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
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
    if (!marketReady) void refreshMarket()
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

  const updateAgent = (patch: Partial<AppState['agent']>) => {
    if (patch.enabled === true && marketSimulatedRef.current) return
    setState((s) => ({ ...s, agent: { ...s.agent, ...patch } }))
  }

  const addGoal = (goal: Omit<Goal, 'id' | 'allocated'>) =>
    setState((s) => ({
      ...s,
      goals: [...s.goals, { ...goal, id: uid('goal'), allocated: 0 }],
    }))

  const executeDecision = (decision: AiDecision, messageId?: string) => {
    if (marketSimulatedRef.current && decision.action !== 'hold') {
      if (messageId) {
        setState((s) => ({
          ...s,
          aiMessages: s.aiMessages.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: `${m.content}\n\nBlocked: market data is simulated — AI trades require real Yahoo quotes.`,
                }
              : m,
          ),
        }))
      }
      return
    }
    const price = pricesRef.current[decision.symbol]
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
      const { askDunnAi } = await import('../lib/ai')
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
      const simulatedNow = marketSimulatedRef.current
      const pricesNow = pricesRef.current
      setState((s) => {
        let next = { ...s, aiMessages: [...s.aiMessages, assistant] }
        if (
          decision &&
          decision.action !== 'hold' &&
          decision.amount > 0 &&
          decision.amount <= s.agent.autoApproveUnder &&
          s.agent.enabled &&
          !simulatedNow
        ) {
          const applied = applyDecision(next, decision, pricesNow[decision.symbol] || 0)
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
        } else if (decision && decision.action !== 'hold' && simulatedNow) {
          next = {
            ...next,
            aiMessages: next.aiMessages.map((m) =>
              m.id === assistant.id
                ? {
                    ...m,
                    content: `${m.content}\n\nNot executed: market data is simulated — AI trades are blocked until real quotes load.`,
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
    if (marketSimulatedRef.current) {
      const assistant: AiMessage = {
        id: uid('msg'),
        role: 'assistant',
        content:
          'Auto-Invest blocked: current market data is simulated. Real Yahoo quotes are required before AI can place trades.',
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, aiMessages: [...s.aiMessages, assistant] }))
      return
    }
    setAiBusy(true)
    try {
      const { runAutonomousInvest } = await import('../lib/ai')
      const remaining = Math.max(0, state.agent.dailyAllowance - state.agent.spentToday)
      const pricesAtStart = pricesRef.current
      const { reply, decision } = await runAutonomousInvest({
        state,
        factors,
        prices: pricesAtStart,
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
      const simulatedNow = marketSimulatedRef.current
      const pricesNow = pricesRef.current
      setState((s) => {
        let next = { ...s, aiMessages: [...s.aiMessages, assistant] }
        if (decision && decision.action !== 'hold' && !simulatedNow) {
          const applied = applyDecision(next, decision, pricesNow[decision.symbol] || 0)
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
        } else if (decision && decision.action !== 'hold' && simulatedNow) {
          next = {
            ...next,
            aiMessages: next.aiMessages.map((m) =>
              m.id === assistant.id
                ? {
                    ...m,
                    content: `${m.content}\n\nNot executed: market data turned simulated during the AI request — trade blocked.`,
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

  const marketAsOfLabel = formatAsOf(marketAsOf)

  const value: AppContextValue = {
    state,
    prices,
    quotes,
    factors,
    equity,
    loadingMarket,
    aiBusy,
    marketSimulated,
    marketAsOf,
    marketAsOfLabel,
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
