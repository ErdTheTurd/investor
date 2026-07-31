import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { formatMoney } from '../lib/storage'
import type { AiDecision } from '../types'

export function Agent() {
  const {
    state,
    factors,
    aiBusy,
    updateAgent,
    sendAiMessage,
    runAiInvest,
    executeDecision,
  } = useApp()
  const [input, setInput] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [state.aiMessages, aiBusy])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || aiBusy) return
    setInput('')
    void sendAiMessage(text)
  }

  const remaining = Math.max(0, state.agent.dailyAllowance - state.agent.spentToday)

  return (
    <div className="page">
      <h1 className="page-title">Dunn AI</h1>
      <p className="page-sub">
        A real LLM reading {factors.length || '…'} live factor rows — not a toy rule engine. Set an allowance and it can
        invest itself.
      </p>

      <div className="dash-grid">
        <section className="panel chat">
          <div className="chat-log" ref={logRef}>
            {state.aiMessages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                {m.content}
                {m.trade && m.trade.action !== 'hold' && (
                  <div className="trade-card">
                    <strong>
                      Proposed {m.trade.action.toUpperCase()} {m.trade.symbol}
                    </strong>
                    <div className="muted">{formatMoney(m.trade.amount)} · {m.trade.rationale}</div>
                    {!m.trade.executed && (
                      <button
                        className="btn btn-primary"
                        type="button"
                        style={{ marginTop: '0.65rem' }}
                        onClick={() => {
                          const decision: AiDecision = {
                            action: m.trade!.action,
                            symbol: m.trade!.symbol,
                            amount: m.trade!.amount,
                            confidence: 0.7,
                            rationale: m.trade!.rationale,
                            factorsUsed: [],
                          }
                          executeDecision(decision, m.id)
                        }}
                      >
                        Approve trade
                      </button>
                    )}
                    {m.trade.executed && <div className="gain" style={{ marginTop: '0.4rem' }}>Executed</div>}
                  </div>
                )}
              </div>
            ))}
            {aiBusy && <div className="bubble assistant muted">Dunn AI is thinking across the factor matrix…</div>}
          </div>
          <form className="chat-input" onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about allocation, risk, or what to buy next"
              disabled={aiBusy}
            />
            <button className="btn btn-primary" type="submit" disabled={aiBusy || !input.trim()}>
              Send
            </button>
          </form>
        </section>

        <section className="panel balance-block stack">
          <div className="toggle">
            <div>
              <strong>Auto-Invest</strong>
              <div className="muted">AI places trades under your daily allowance</div>
            </div>
            <button
              type="button"
              className={`switch ${state.agent.enabled ? 'on' : ''}`}
              aria-pressed={state.agent.enabled}
              onClick={() => updateAgent({ enabled: !state.agent.enabled })}
            >
              <i />
            </button>
          </div>

          <div className="field">
            <label htmlFor="allowance">Daily AI allowance (USD)</label>
            <input
              id="allowance"
              type="number"
              min={0}
              value={state.agent.dailyAllowance}
              onChange={(e) => updateAgent({ dailyAllowance: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="field">
            <label htmlFor="auto">Auto-approve under (USD)</label>
            <input
              id="auto"
              type="number"
              min={0}
              value={state.agent.autoApproveUnder}
              onChange={(e) => updateAgent({ autoApproveUnder: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="field">
            <label htmlFor="bias">AI risk bias</label>
            <select
              id="bias"
              value={state.agent.riskBias}
              onChange={(e) => updateAgent({ riskBias: e.target.value as typeof state.agent.riskBias })}
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="growth">Growth</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>

          <div className="chip">
            <span className="pulse-dot" />
            Remaining today {formatMoney(remaining)}
          </div>

          <button
            className="btn btn-champagne"
            type="button"
            disabled={!state.agent.enabled || aiBusy || remaining <= 0}
            onClick={() => void runAiInvest()}
          >
            Run Auto-Invest now
          </button>

          <p className="muted" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
            Powered by Puter.js (real models, no developer API key — you authenticate as the user) with a keyless
            Pollinations fallback. Factor inputs are computed from live market bars before every call.
          </p>

          <div>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Factors in the prompt</h3>
            <div className="factor-grid">
              {[
                'momentum 1m/3m',
                'realized vol',
                'trend strength',
                'relative strength',
                'volume pressure',
                'drawdown',
                'value proxy',
                'liquidity',
                'sentiment proxy',
                'regime fit',
              ].map((f) => (
                <div className="factor-pill" key={f}>
                  <strong>{f}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
