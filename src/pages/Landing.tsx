import { Link } from 'react-router-dom'

export function Landing() {
  return (
    <div className="app-shell">
      <header className="nav">
        <div className="container nav-inner">
          <div className="brand">
            Dunn <span>Investing<em>?</em></span>
          </div>
          <div className="nav-actions">
            <Link className="btn btn-ghost" to="/onboarding">
              Log in
            </Link>
            <Link className="btn btn-primary" to="/onboarding">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-content">
          <h1>Paper trading with an AI co-pilot and a daily spending cap.</h1>
          <p className="lede">
            Build a diversified paper portfolio of stocks, bonds, REITs, and gold. Dunn AI can propose or
            place simulated trades up to the allowance you set.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to="/onboarding">
              Open a paper account
            </Link>
            <a className="btn btn-ghost" href="#how">
              How it works
            </a>
          </div>
        </div>
      </section>

      <section className="section container" id="how">
        <div className="section-head">
          <h2>How it works</h2>
          <p>
            Deposit paper cash, choose a risk mix, and optionally let Dunn AI trade within a daily dollar
            limit.
          </p>
        </div>
        <div className="feature-row">
          <article>
            <h3>Diversified portfolios</h3>
            <p>
              Target mixes across US stocks, international equities, bonds, REITs, and gold, based on the
              risk level you choose.
            </p>
          </article>
          <article>
            <h3>Dunn AI</h3>
            <p>
              A language model (Puter, then Pollinations, then an on-device model) reads market factors such
              as momentum, volatility, and drawdowns before it proposes a trade.
            </p>
          </article>
          <article>
            <h3>Auto-Invest with an allowance</h3>
            <p>
              Turn Auto-Invest on, set a daily dollar cap, and Dunn AI can place paper trades on its own, or
              ask you to approve larger ones.
            </p>
          </article>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <h2>A demo with limits you control</h2>
          <p>You set the rules. Dunn AI stays inside them. Nothing here is a live brokerage account.</p>
        </div>
        <Link className="btn btn-primary" to="/onboarding">
          Get started
        </Link>
        <p className="footer-note">
          Educational paper-trading demo. Not a registered broker-dealer or investment adviser. Past performance does not
          guarantee future results. Market data is sourced from free public feeds when available.
        </p>
      </section>
    </div>
  )
}
