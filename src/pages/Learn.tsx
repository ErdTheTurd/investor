const lessons = [
  {
    title: 'Cue → Action → Reward',
    body: 'Open Dunn Investing when you check your phone in the morning. Deposit or ask the AI one question. Feel the streak tick up and the balance move — that closes the loop.',
  },
  {
    title: 'Allowance is the safety rail',
    body: 'Auto-Invest is powerful because it is bounded. A daily dollar ceiling lets a real model act without giving it the whole account.',
  },
  {
    title: 'Factors beat vibes',
    body: 'Momentum, volatility, relative strength, volume pressure, drawdown, and regime fit are fed into the LLM each turn so answers are grounded in data — not a canned script.',
  },
  {
    title: 'Diversify like Finhabits',
    body: 'Sleeves across US equity, international, bonds, REITs, and commodities reduce single-name blowups. Use AI for timing and sizing inside that map.',
  },
]

export function Learn() {
  return (
    <div className="page">
      <h1 className="page-title">Learn</h1>
      <p className="page-sub">Five-minute money journeys — psychology and portfolio literacy in one place.</p>
      <div className="feature-row panel balance-block">
        {lessons.map((l) => (
          <article key={l.title}>
            <h3>{l.title}</h3>
            <p>{l.body}</p>
          </article>
        ))}
      </div>
      <p className="footer-note">
        Educational content only. Dunn Investing is a paper-trading demonstration that uses free AI providers (Puter.js /
        Pollinations) and public market data.
      </p>
    </div>
  )
}
