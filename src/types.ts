export type RiskProfile = 'conservative' | 'balanced' | 'growth' | 'aggressive'

export type GoalType = 'emergency' | 'home' | 'retirement' | 'education' | 'custom'

export interface Goal {
  id: string
  type: GoalType
  name: string
  targetAmount: number
  targetDate: string
  allocated: number
}

export interface Holding {
  symbol: string
  name: string
  shares: number
  avgCost: number
  assetClass: AssetClass
}

export type AssetClass =
  | 'us_equity'
  | 'intl_equity'
  | 'bonds'
  | 'reits'
  | 'commodities'
  | 'cash'

export interface Transaction {
  id: string
  type: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'ai_buy' | 'ai_sell' | 'dividend'
  symbol?: string
  amount: number
  shares?: number
  price?: number
  note?: string
  createdAt: string
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  trade?: {
    action: 'buy' | 'sell' | 'hold'
    symbol: string
    amount: number
    rationale: string
    executed: boolean
  }
}

export interface AiAgentSettings {
  enabled: boolean
  dailyAllowance: number
  spentToday: number
  spentDate: string
  riskBias: RiskProfile
  autoApproveUnder: number
  lastRunAt?: string
}

export interface UserProfile {
  name: string
  risk: RiskProfile
  horizonYears: number
  monthlyDeposit: number
  onboardingComplete: boolean
  streakDays: number
  lastVisit: string
  createdAt: string
}

export interface AppState {
  profile: UserProfile
  cash: number
  holdings: Holding[]
  transactions: Transaction[]
  goals: Goal[]
  aiMessages: AiMessage[]
  agent: AiAgentSettings
  equityHistory: { date: string; value: number }[]
}

export interface Quote {
  symbol: string
  price: number
  changePercent: number
  previousClose: number
  high52: number
  low52: number
  volume?: number
}

export interface FactorSnapshot {
  symbol: string
  name: string
  price: number
  momentum1m: number
  momentum3m: number
  volatility: number
  trendStrength: number
  relativeStrength: number
  volumePressure: number
  drawdownFromHigh: number
  valuationProxy: number
  macroSensitivity: number
  liquidityScore: number
  sentimentProxy: number
  regimeFit: number
}

export interface AiDecision {
  action: 'buy' | 'sell' | 'hold'
  symbol: string
  amount: number
  confidence: number
  rationale: string
  factorsUsed: string[]
}

export const UNIVERSE = [
  { symbol: 'SPY', name: 'S&P 500', assetClass: 'us_equity' as AssetClass },
  { symbol: 'QQQ', name: 'Nasdaq 100', assetClass: 'us_equity' as AssetClass },
  { symbol: 'VTI', name: 'Total US Market', assetClass: 'us_equity' as AssetClass },
  { symbol: 'VXUS', name: 'International Stocks', assetClass: 'intl_equity' as AssetClass },
  { symbol: 'EFA', name: 'Developed Markets', assetClass: 'intl_equity' as AssetClass },
  { symbol: 'BND', name: 'US Bond Aggregate', assetClass: 'bonds' as AssetClass },
  { symbol: 'TLT', name: 'Long-Term Treasuries', assetClass: 'bonds' as AssetClass },
  { symbol: 'VNQ', name: 'Real Estate', assetClass: 'reits' as AssetClass },
  { symbol: 'GLD', name: 'Gold', assetClass: 'commodities' as AssetClass },
  { symbol: 'AAPL', name: 'Apple', assetClass: 'us_equity' as AssetClass },
  { symbol: 'MSFT', name: 'Microsoft', assetClass: 'us_equity' as AssetClass },
  { symbol: 'NVDA', name: 'NVIDIA', assetClass: 'us_equity' as AssetClass },
] as const

export const TARGET_ALLOCATIONS: Record<RiskProfile, Partial<Record<AssetClass, number>>> = {
  conservative: { us_equity: 0.25, intl_equity: 0.1, bonds: 0.5, reits: 0.05, commodities: 0.05, cash: 0.05 },
  balanced: { us_equity: 0.4, intl_equity: 0.15, bonds: 0.3, reits: 0.08, commodities: 0.05, cash: 0.02 },
  growth: { us_equity: 0.55, intl_equity: 0.2, bonds: 0.12, reits: 0.08, commodities: 0.05 },
  aggressive: { us_equity: 0.7, intl_equity: 0.18, bonds: 0.02, reits: 0.05, commodities: 0.05 },
}
