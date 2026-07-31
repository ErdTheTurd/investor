import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import type { RiskProfile } from '../types'

const risks: { id: RiskProfile; title: string; blurb: string }[] = [
  { id: 'conservative', title: 'Steady', blurb: 'Preserve capital, favor bonds.' },
  { id: 'balanced', title: 'Balanced', blurb: 'Mix of growth and ballast.' },
  { id: 'growth', title: 'Growth', blurb: 'Lean into equities for long horizons.' },
  { id: 'aggressive', title: 'Aggressive', blurb: 'Max growth, higher swings.' },
]

export function Onboarding() {
  const { completeOnboarding } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [risk, setRisk] = useState<RiskProfile>('balanced')
  const [horizonYears, setHorizonYears] = useState(10)
  const [monthlyDeposit, setMonthlyDeposit] = useState(100)
  const [initialDeposit, setInitialDeposit] = useState(500)

  const finish = () => {
    completeOnboarding({
      name: name.trim() || 'Investor',
      risk,
      horizonYears,
      monthlyDeposit,
      initialDeposit,
    })
    navigate('/app')
  }

  return (
    <div className="onboard container">
      <div className="panel onboard-card">
        <div className="brand" style={{ marginBottom: '0.75rem' }}>
          Dunn <span>Investing</span>
          <em>?</em>
        </div>
        <h1>{step === 0 ? 'Who are we building for?' : step === 1 ? 'How should AI take risk?' : 'Fund the habit'}</h1>
        <p className="muted">
          {step === 0
            ? 'A little investment from you now makes every return visit more personal.'
            : step === 1
              ? 'This becomes both your portfolio mix and Dunn AI’s risk bias.'
              : 'Start small. Variable rewards come from watching the balance move.'}
        </p>
        <div className="steps" aria-hidden>
          {[0, 1, 2].map((i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <div className="stack">
            <div className="field">
              <label htmlFor="name">First name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" autoFocus />
            </div>
            <div className="field">
              <label htmlFor="horizon">Investing horizon (years)</label>
              <input
                id="horizon"
                type="number"
                min={1}
                max={50}
                value={horizonYears}
                onChange={(e) => setHorizonYears(Number(e.target.value) || 1)}
              />
            </div>
            <button className="btn btn-primary" type="button" onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            {risks.map((r) => (
              <button
                key={r.id}
                type="button"
                className="btn btn-ghost"
                style={{
                  textAlign: 'left',
                  borderColor: risk === r.id ? 'rgba(31,169,122,0.7)' : undefined,
                  background: risk === r.id ? 'rgba(31,169,122,0.12)' : undefined,
                }}
                onClick={() => setRisk(r.id)}
              >
                <strong>{r.title}</strong>
                <div className="muted">{r.blurb}</div>
              </button>
            ))}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-ghost" type="button" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="btn btn-primary" type="button" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <div className="field">
              <label htmlFor="monthly">Monthly auto-deposit target</label>
              <input
                id="monthly"
                type="number"
                min={10}
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(Number(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label htmlFor="initial">Opening deposit (paper cash)</label>
              <input
                id="initial"
                type="number"
                min={0}
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(Number(e.target.value) || 0)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn btn-primary" type="button" onClick={finish}>
                Enter Dunn Investing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
