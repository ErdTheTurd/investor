# Dunn Investing

Finhabits-style automated investing with a real AI co-pilot that can trade within a daily allowance.

## Features

- Goal-based paper brokerage (deposit, buy/sell, diversified ETF sleeves)
- **Dunn AI** — live LLM via [Puter.js](https://developer.puter.com/) (no developer API key; user-pays) with [Pollinations](https://pollinations.ai/) keyless fallback
- Multi-factor market matrix fed into every AI call (momentum, volatility, RS, volume, drawdown, liquidity, sentiment proxy, regime fit)
- **Auto-Invest** with a hard daily dollar allowance
- Habit-loop UX (streaks, one-tap deposits, variable AI insights)

## Develop

```bash
npm install
npm run dev
```

Market quotes are proxied through Vite to Yahoo Finance (`/api/yahoo`). If feeds throttle, the app falls back to deterministic synthetic bars so the UI keeps working.

## Build

```bash
npm run build
npm run preview
```

## Disclaimer

Educational paper-trading demo. Not a broker-dealer or investment adviser.
