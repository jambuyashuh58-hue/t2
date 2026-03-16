// ─── Asset ───────────────────────────────────────────────────────────────────
export type AssetType = "equity" | "options" | "futures" | "commodity" | "currency" | "mf";
export type Broker    = "groww" | "zerodha" | "angelone" | "upstox" | "manual";

// ─── Position ────────────────────────────────────────────────────────────────
export interface Position {
  id:          string;
  symbol:      string;
  qty:         number;
  avgBuy:      number;
  ltp:         number;
  pnl:         number;
  pnlPercent:  number;
  assetType:   AssetType;
  broker:      Broker;
  addedAt:     string;
  // computed helpers (optional)
  investedAmount?: number;
  currentValue?:   number;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
export type AlertType =
  | "daily_profit_target"
  | "daily_stop_loss"
  | "position_profit"
  | "position_loss"
  | "index_level";

export interface AlertRule {
  id:        string;
  name:      string;
  type:      AlertType;
  threshold: number;
  symbol?:   string;
  enabled:   boolean;
  createdAt: string;
}

export interface FiredAlert {
  id:        string;
  ruleId:    string;
  firedAt:   string;
  message:   string;
  pnlAtFire: number;
}

// ─── Market ──────────────────────────────────────────────────────────────────
export interface MarketIndex {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
}

// ─── P&L History ─────────────────────────────────────────────────────────────
export interface DayPnL {
  date: string;  // YYYY-MM-DD
  pnl:  number;
}

// ─── Social ──────────────────────────────────────────────────────────────────
export interface SocialPost {
  id:          string;
  userId:      string;
  displayName: string;
  content:     string;
  pnl?:        number;
  pnlPercent?: number;
  symbol?:     string;
  postedAt:    string;
  likes:       number;
  comments:    number;
}

// ─── Settings ────────────────────────────────────────────────────────────────
export interface UserSettings {
  dailyProfitTarget: number;
  dailyStopLoss:     number;
  capitalToDeploy:   number;
  whatsappNumber?:   string;
  whatsappApiKey?:   string;
}
