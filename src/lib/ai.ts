import type { AiDecision, AppState, FactorSnapshot, Holding } from '../types'
import { UNIVERSE } from '../types'
import { factorsToPromptBlock, scoreForRisk } from './factors'
import { formatMoney } from './storage'

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (
          prompt: string | { role: string; content: string }[],
          options?: Record<string, unknown>,
        ) => Promise<unknown>
      }
    }
  }
}

function extractText(result: unknown): string {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (typeof r.message === 'string') return r.message
    if (r.message && typeof r.message === 'object') {
      const m = r.message as Record<string, unknown>
      if (typeof m.content === 'string') return m.content
    }
    if (typeof r.text === 'string') return r.text
    if (typeof r.content === 'string') return r.content
    if (Array.isArray(r.choices)) {
      const c0 = r.choices[0] as Record<string, unknown>
      const msg = c0?.message as Record<string, unknown> | undefined
      if (typeof msg?.content === 'string') return msg.content
    }
  }
  return String(result ?? '')
}

async function callPuter(messages: { role: string; content: string }[]): Promise<string> {
  if (!window.puter?.ai?.chat) throw new Error('Puter unavailable')
  const result = await window.puter.ai.chat(messages, {
    model: 'gpt-4.1-mini',
    temperature: 0.4,
  })
  return extractText(result)
}

async function callPollinations(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages,
      temperature: 0.4,
      seed: Date.now() % 100000,
    }),
  })
  if (!res.ok) throw new Error(`Pollinations ${res.status}`)
  const data = await res.json()
  return extractText(data)
}

/** Real LLM call: Puter (user-pays, no developer key) → Pollinations keyless fallback. */
export async function chatWithAi(messages: { role: string; content: string }[]): Promise<string> {
  try {
    return await callPuter(messages)
  } catch {
    return await callPollinations(messages)
  }
}

function portfolioSummary(state: AppState, prices: Record<string, number>): string {
  const holdingsValue = state.holdings.reduce((s, h) => s + h.shares * (prices[h.symbol] ?? h.avgCost), 0)
  const equity = state.cash + holdingsValue
  const lines = state.holdings.map((h) => {
    const px = prices[h.symbol] ?? h.avgCost
    return `- ${h.symbol}: ${h.shares.toFixed(4)} shares @ avg $${h.avgCost.toFixed(2)}, mark $${px.toFixed(2)} (${formatMoney(h.shares * px)})`
  })
  return `Cash: ${formatMoney(state.cash)}\nHoldings value: ${formatMoney(holdingsValue)}\nTotal equity: ${formatMoney(equity)}\nRisk profile: ${state.profile.risk}\nHorizon: ${state.profile.horizonYears}y\nAI daily allowance: $${state.agent.dailyAllowance} (spent today $${state.agent.spentToday.toFixed(2)})\nHoldings:\n${lines.length ? lines.join('\n') : '(none yet)'}`
}

const SYSTEM = `You are Dunn AI, the investing co-pilot for Dunn Investing.
You are a real large language model analyzing multi-factor market data (momentum, volatility, relative strength, volume pressure, drawdown, valuation proxies, liquidity, sentiment proxies, regime fit).
You give clear, actionable guidance for a paper-trading brokerage inside the app — not formal financial advice.
Be concise, concrete, and confident. Prefer diversified ETF exposure over single-name concentration unless the user asks otherwise.
When recommending a trade, end with a single JSON block on its own line:
\`\`\`json
{"action":"buy"|"sell"|"hold","symbol":"TICKER","amount":number,"confidence":0-1,"rationale":"...","factorsUsed":["..."]}
\`\`\`
Only use symbols from the provided universe. amount is USD for buys, and USD market value for sells. If hold, amount 0.`

export async function askDunnAi(opts: {
  userMessage: string
  state: AppState
  factors: FactorSnapshot[]
  prices: Record<string, number>
  history: { role: 'user' | 'assistant'; content: string }[]
}): Promise<{ reply: string; decision?: AiDecision }> {
  const factorBlock = factorsToPromptBlock(opts.factors)
  const messages = [
    { role: 'system', content: SYSTEM },
    {
      role: 'system',
      content: `PORTFOLIO\n${portfolioSummary(opts.state, opts.prices)}\n\nLIVE FACTOR MATRIX\n${factorBlock}\n\nUNIVERSE: ${UNIVERSE.map((u) => u.symbol).join(', ')}`,
    },
    ...opts.history.slice(-8),
    { role: 'user', content: opts.userMessage },
  ]
  const reply = await chatWithAi(messages)
  return { reply: stripJsonFence(reply), decision: parseDecision(reply) }
}

export async function runAutonomousInvest(opts: {
  state: AppState
  factors: FactorSnapshot[]
  prices: Record<string, number>
  remainingAllowance: number
}): Promise<{ reply: string; decision?: AiDecision }> {
  const ranked = [...opts.factors]
    .map((f) => ({ f, score: scoreForRisk(f, opts.state.agent.riskBias) }))
    .sort((a, b) => b.score - a.score)

  const prompt = `You are running Auto-Invest for Dunn Investing.
Remaining daily allowance: $${opts.remainingAllowance.toFixed(2)}.
Risk bias: ${opts.state.agent.riskBias}.
Choose ONE trade (buy or sell) or hold. Prefer the highest-scoring opportunities that fit the risk bias.
Top ranked by multi-factor score: ${ranked
    .slice(0, 5)
    .map((r) => `${r.f.symbol}=${r.score.toFixed(1)}`)
    .join(', ')}.
Keep the trade size at or under the remaining allowance. Diversify — avoid concentrating more than 35% of equity in one ticker.
Respond with a short human explanation, then the JSON decision block.`

  return askDunnAi({
    userMessage: prompt,
    state: opts.state,
    factors: opts.factors,
    prices: opts.prices,
    history: [],
  })
}

function stripJsonFence(text: string): string {
  return text.replace(/```json[\s\S]*?```/gi, '').trim()
}

export function parseDecision(text: string): AiDecision | undefined {
  const fence = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fence?.[1] ?? text.match(/\{[\s\S]*"action"[\s\S]*\}/)?.[0]
  if (!raw) return undefined
  try {
    const obj = JSON.parse(raw) as AiDecision
    if (!obj.action || !obj.symbol) return undefined
    if (!UNIVERSE.some((u) => u.symbol === obj.symbol)) return undefined
    if (!['buy', 'sell', 'hold'].includes(obj.action)) return undefined
    return {
      action: obj.action,
      symbol: obj.symbol,
      amount: Math.max(0, Number(obj.amount) || 0),
      confidence: Math.min(1, Math.max(0, Number(obj.confidence) || 0.5)),
      rationale: String(obj.rationale || ''),
      factorsUsed: Array.isArray(obj.factorsUsed) ? obj.factorsUsed.map(String) : [],
    }
  } catch {
    return undefined
  }
}

export function holdingValue(h: Holding, price: number) {
  return h.shares * price
}
