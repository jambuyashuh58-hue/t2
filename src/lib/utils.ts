import { AlertRule, FiredAlert, Position } from "./types";

// ─── Formatters ──────────────────────────────────────────────────────────────
export function formatINR(n: number): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return (n < 0 ? "-" : "") + "₹" + str;
}

export function formatINRCompact(n: number): string {
  const abs = Math.abs(n);
  const prefix = n < 0 ? "-₹" : "₹";
  if (abs >= 1e7) return prefix + (abs / 1e7).toFixed(1) + "Cr";
  if (abs >= 1e5) return prefix + (abs / 1e5).toFixed(1) + "L";
  if (abs >= 1e3) return prefix + (abs / 1e3).toFixed(1) + "K";
  return prefix + abs.toFixed(0);
}

export function formatPercent(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export function pnlColor(n: number): string {
  return n >= 0 ? "text-[#00d97e]" : "text-[#ff4560]";
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Market status ───────────────────────────────────────────────────────────
export function marketStatusLabel(): { open: boolean; label: string } {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes(), d = ist.getDay();
  const mins = h * 60 + m;
  const open = d >= 1 && d <= 5 && mins >= 555 && mins < 930; // 9:15–15:30
  return { open, label: open ? "Market Open" : "Market Closed" };
}

// ─── Alert engine ────────────────────────────────────────────────────────────
export function shouldFireAlert(
  rule: AlertRule,
  totalPnL: number,
  positionPnL: number = 0
): boolean {
  switch (rule.type) {
    case "daily_profit_target": return totalPnL      >=  rule.threshold;
    case "daily_stop_loss":     return totalPnL      <= -rule.threshold;
    case "position_profit":     return positionPnL   >=  rule.threshold;
    case "position_loss":       return positionPnL   <= -rule.threshold;
    default:                    return false;
  }
}

// ─── Notifications ───────────────────────────────────────────────────────────
export function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission === "granted") new Notification(title, { body, icon: "/icon.png" });
}

export async function sendWhatsAppAlert(msg: string, number: string, apiKey: string) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(number)}&text=${encodeURIComponent(msg)}&apikey=${apiKey}`;
  try { await fetch(url); } catch { /* silent */ }
}

// ─── Groww CSV parser ────────────────────────────────────────────────────────
export function parseGrowwCSV(csv: string): Omit<Position, "id" | "broker" | "addedAt">[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const results: Omit<Position, "id" | "broker" | "addedAt">[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = cols[j] ?? ""; });
    const symbol = row["symbol"] || row["scrip"] || row["stock"];
    const qty    = parseFloat(row["quantity"] || row["qty"] || "0");
    const avg    = parseFloat(row["avg price"] || row["average price"] || row["avg"] || "0");
    const ltp    = parseFloat(row["ltp"] || row["current price"] || row["market price"] || "0");
    if (!symbol || isNaN(qty) || isNaN(avg) || qty <= 0) continue;
    const ltpFinal  = ltp || avg;
    const pnl       = (ltpFinal - avg) * qty;
    const pnlPct    = avg > 0 ? ((ltpFinal - avg) / avg) * 100 : 0;
    results.push({ symbol: symbol.toUpperCase(), qty, avgBuy: avg, ltp: ltpFinal, pnl, pnlPercent: pnlPct, assetType: "equity" });
  }
  return results;
}
