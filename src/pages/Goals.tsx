import { useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { formatMoney } from '../lib/storage'
import type { GoalType } from '../types'

export function Goals() {
  const { state, addGoal, equity } = useApp()
  const [name, setName] = useState('Emergency fund')
  const [type, setType] = useState<GoalType>('emergency')
  const [targetAmount, setTargetAmount] = useState(5000)
  const [targetDate, setTargetDate] = useState('2030-01-01')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    addGoal({ name, type, targetAmount, targetDate })
  }

  return (
    <div className="page">
      <h1 className="page-title">Goals</h1>
      <p className="page-sub">Name the future you’re funding — each goal is an investment that pulls you back tomorrow.</p>

      <div className="dash-grid">
        <section className="panel balance-block">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Active goals</h2>
          <div className="list">
            {state.goals.length === 0 && <p className="muted">No goals yet. Add one to lock in the habit loop.</p>}
            {state.goals.map((g) => {
              const progress = Math.min(100, (equity / Math.max(g.targetAmount, 1)) * 100)
              return (
                <div key={g.id} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--stroke)' }}>
                  <div className="list-row" style={{ border: 0, padding: 0 }}>
                    <div>
                      <strong>{g.name}</strong>
                      <div className="muted">
                        {g.type} · by {g.targetDate}
                      </div>
                    </div>
                    <div>{formatMoney(g.targetAmount)}</div>
                  </div>
                  <div
                    style={{
                      marginTop: '0.65rem',
                      height: 8,
                      borderRadius: 999,
                      background: 'rgba(232,242,239,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--emerald), var(--champagne))',
                        transition: 'width 0.6s var(--ease)',
                      }}
                    />
                  </div>
                  <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
                    {progress.toFixed(0)}% of target vs total equity
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel balance-block">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Add a goal</h2>
          <form className="stack" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="gname">Name</label>
              <input id="gname" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="gtype">Type</label>
              <select id="gtype" value={type} onChange={(e) => setType(e.target.value as GoalType)}>
                <option value="emergency">Emergency</option>
                <option value="home">Home</option>
                <option value="retirement">Retirement</option>
                <option value="education">Education</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="gtarget">Target amount</label>
              <input
                id="gtarget"
                type="number"
                min={100}
                value={targetAmount}
                onChange={(e) => setTargetAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label htmlFor="gdate">Target date</label>
              <input id="gdate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">
              Save goal
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
