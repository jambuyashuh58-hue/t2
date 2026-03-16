import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Position, AlertRule, FiredAlert, MarketIndex, DayPnL, SocialPost, UserSettings } from "./types";

const DEFAULT_SETTINGS: UserSettings = {
  dailyProfitTarget: 3000,
  dailyStopLoss:     1500,
  capitalToDeploy:   500000,
  whatsappNumber:    "",
  whatsappApiKey:    "",
};

interface TradePulseStore {
  positions:     Position[];
  addPosition:   (pos: Position) => void;
  removePosition:(id: string) => void;
  updatePrices:  (prices: Record<string, number>) => void;

  alertRules:      AlertRule[];
  firedAlerts:     FiredAlert[];
  addAlertRule:    (rule: AlertRule) => void;
  removeAlertRule: (id: string) => void;
  toggleAlertRule: (id: string) => void;
  firealert:       (fired: FiredAlert) => void;

  indices:    MarketIndex[];
  setIndices: (idx: MarketIndex[]) => void;

  pnlHistory:  DayPnL[];
  addDayPnL:   (day: DayPnL) => void;

  socialPosts:   SocialPost[];
  addSocialPost: (post: SocialPost) => void;

  settings:       UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
}

// ─── Computed helpers ────────────────────────────────────────────────────────
export const getTotalPnL      = (positions: Position[]) => positions.reduce((s, p) => s + p.pnl, 0);
export const getTotalInvested = (positions: Position[]) => positions.reduce((s, p) => s + p.avgBuy * p.qty, 0);

// ─── Store ───────────────────────────────────────────────────────────────────
export const useTradePulseStore = create<TradePulseStore>()(
  persist(
    (set) => ({
      positions: [],
      addPosition:    (pos) => set((s) => ({ positions: [...s.positions, pos] })),
      removePosition: (id)  => set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),
      updatePrices: (prices) =>
        set((s) => ({
          positions: s.positions.map((p) => {
            const ltp = prices[p.symbol];
            if (!ltp) return p;
            const pnl        = (ltp - p.avgBuy) * p.qty;
            const pnlPercent = ((ltp - p.avgBuy) / p.avgBuy) * 100;
            return { ...p, ltp, pnl, pnlPercent };
          }),
        })),

      alertRules: [],
      firedAlerts: [],
      addAlertRule:    (rule) => set((s) => ({ alertRules: [...s.alertRules, rule] })),
      removeAlertRule: (id)  => set((s) => ({ alertRules: s.alertRules.filter((r) => r.id !== id) })),
      toggleAlertRule: (id)  =>
        set((s) => ({ alertRules: s.alertRules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r) })),
      firealert: (fired) =>
        set((s) => ({ firedAlerts: [fired, ...s.firedAlerts].slice(0, 50) })),

      indices: [],
      setIndices: (indices) => set({ indices }),

      pnlHistory: [],
      addDayPnL: (day) =>
        set((s) => ({ pnlHistory: [day, ...s.pnlHistory.filter((d) => d.date !== day.date)].slice(0, 90) })),

      socialPosts: [],
      addSocialPost: (post) => set((s) => ({ socialPosts: [post, ...s.socialPosts].slice(0, 100) })),

      settings: DEFAULT_SETTINGS,
      updateSettings: (updates) => set((s) => ({ settings: { ...s.settings, ...updates } })),
    }),
    {
      name: "tradepulse-storage",
      partialize: (state) => ({
        positions:   state.positions,
        alertRules:  state.alertRules,
        firedAlerts: state.firedAlerts,
        pnlHistory:  state.pnlHistory,
        socialPosts: state.socialPosts,
        settings:    state.settings,
      }) as TradePulseStore,
    }
  )
);
