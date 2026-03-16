"use client";
import { useEffect, useCallback } from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown, Target, ShieldAlert, RefreshCw, ArrowUpRight, ArrowDownRight, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useTradePulseStore, getTotalPnL, getTotalInvested } from "@/lib/store";
import { formatINR, formatINRCompact, formatPercent, marketStatusLabel, shouldFireAlert, sendBrowserNotification, sendWhatsAppAlert, genId, todayStr } from "@/lib/utils";
import { clsx } from "clsx";
import toast from "react-hot-toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function PnLTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="bg-[#111920] border border-[#243040] rounded-lg px-3 py-2 text-xs">
      <div className="text-[#94a3b8] mb-1">{label}</div>
      <div className={clsx("font-semibold", v >= 0 ? "text-[#00d97e]" : "text-[#ff4560]")}>
        {v >= 0 ? "+" : ""}{formatINR(v)}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { positions, alertRules, firedAlerts, pnlHistory, indices, settings, setIndices, firealert, updatePrices } = useTradePulseStore();

  const totalPnL      = getTotalPnL(positions);
  const totalInvested = getTotalInvested(positions);
  const totalPnLPct   = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const { open: marketOpen, label: marketLabel } = marketStatusLabel();

  const { data: marketData, isLoading, mutate } = useSWR("/api/market", fetcher, { refreshInterval: 30000 });

  useEffect(() => {
    if (marketData?.indices) setIndices(marketData.indices);
  }, [marketData, setIndices]);

  useEffect(() => {
    if (!marketData?.indices || !positions.length) return;
    const syms = Array.from(new Set(positions.map((p) => p.symbol)));
    fetch("/api/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbols: syms }) })
      .then((r) => r.json())
      .then((d) => { if (d.prices) updatePrices(d.prices); })
      .catch(() => {});
  }, [marketData, positions.length, updatePrices]);

  const checkAlerts = useCallback(() => {
    const firedIds = new Set(firedAlerts.map((a) => a.ruleId));
    alertRules
      .filter((r) => r.enabled && !firedIds.has(r.id))
      .forEach((rule) => {
        const pos = rule.symbol ? positions.find((p) => p.symbol === rule.symbol) : undefined;
        if (shouldFireAlert(rule, totalPnL, pos?.pnl ?? 0)) {
          const msg = `TradePulse Alert: ${rule.name}`;
          firealert({ id: genId(), ruleId: rule.id, firedAt: new Date().toISOString(), message: msg, pnlAtFire: totalPnL });
          sendBrowserNotification(rule.name, msg);
          if (settings.whatsappNumber && settings.whatsappApiKey)
            sendWhatsAppAlert(msg, settings.whatsappNumber, settings.whatsappApiKey);
          toast.success(`🔔 ${rule.name}`, { duration: 5000 });
        }
      });
  }, [alertRules, firedAlerts, totalPnL, positions, firealert, settings]);

  useEffect(() => {
    checkAlerts();
    const t = setInterval(checkAlerts, 30000);
    return () => clearInterval(t);
  }, [checkAlerts]);

  const profitPct  = Math.min(100, totalPnL > 0 ? (totalPnL / settings.dailyProfitTarget) * 100 : 0);
  const lossPct    = Math.min(100, totalPnL < 0 ? (Math.abs(totalPnL) / settings.dailyStopLoss) * 100 : 0);
  const capitalPct = Math.min(100, totalInvested > 0 ? (totalInvested / settings.capitalToDeploy) * 100 : 0);

  const chartData = [...pnlHistory]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map((d) => ({ date: d.date.slice(5), pnl: d.pnl }));
  if (!chartData.length || chartData[chartData.length - 1]?.date !== todayStr().slice(5))
    chartData.push({ date: todayStr().slice(5), pnl: totalPnL });

  return (
    <div className="p-4 space-y-4 pb-6">

      {/* Date + market status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border",
            marketOpen ? "bg-[#00d97e]/10 text-[#00d97e] border-[#00d97e]/30" : "bg-[#111920] text-[#4a5568] border-[#1a2535]"
          )}>
            <span className={clsx("w-1.5 h-1.5 rounded-full", marketOpen ? "bg-[#00d97e] pulse-dot" : "bg-[#4a5568]")} />
            {marketLabel}
          </div>
          <button onClick={() => mutate()} className="w-8 h-8 rounded-lg bg-[#111920] border border-[#1a2535] flex items-center justify-center text-[#4a5568] active:scale-95 transition-transform">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Indices — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-0.5">
        {isLoading && !indices.length
          ? [1, 2, 3].map((i) => <div key={i} className="bg-[#0c1117] border border-[#1a2535] rounded-xl min-w-[130px] h-16 flex-shrink-0 animate-pulse" />)
          : (indices.length
              ? indices
              : [
                  { symbol: "^NSEI",    name: "NIFTY 50",    price: 22419, change: 134,  changePercent: 0.60 },
                  { symbol: "^BSESN",   name: "SENSEX",      price: 73961, change: 421,  changePercent: 0.57 },
                  { symbol: "^NSEBANK", name: "BANK NIFTY",  price: 48234, change: -89,  changePercent: -0.18 },
                ]
            ).map((idx) => (
              <div key={idx.symbol} className="bg-[#0c1117] border border-[#1a2535] rounded-xl p-3 min-w-[130px] flex-shrink-0">
                <div className="text-[10px] text-[#94a3b8] uppercase tracking-wide mb-1.5">{idx.name}</div>
                <div className="font-semibold text-[15px] text-white" style={{ fontFamily: "monospace" }}>
                  {idx.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className={clsx("flex items-center gap-0.5 text-[11px] mt-1", idx.change >= 0 ? "text-[#00d97e]" : "text-[#ff4560]")} style={{ fontFamily: "monospace" }}>
                  {idx.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {formatPercent(idx.changePercent)}
                </div>
              </div>
            ))}
      </div>

      {/* P&L card */}
      <div className={clsx("bg-[#0c1117] border rounded-2xl p-4", totalPnL >= 0 ? "border-[#00d97e]/20" : "border-[#ff4560]/20")}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-[#94a3b8] uppercase tracking-wide mb-1">Today's P&L</p>
            <p className={clsx("font-bold text-3xl", totalPnL >= 0 ? "text-[#00d97e]" : "text-[#ff4560]")} style={{ fontFamily: "monospace" }}>
              {totalPnL >= 0 ? "+" : ""}{formatINR(totalPnL)}
            </p>
            <p className={clsx("text-sm font-semibold mt-0.5", totalPnL >= 0 ? "text-[#00d97e]/70" : "text-[#ff4560]/70")} style={{ fontFamily: "monospace" }}>
              {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}% on {formatINRCompact(totalInvested)}
            </p>
          </div>
          <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", totalPnL >= 0 ? "bg-[#00d97e]/10" : "bg-[#ff4560]/10")}>
            {totalPnL >= 0 ? <TrendingUp className="w-5 h-5 text-[#00d97e]" /> : <TrendingDown className="w-5 h-5 text-[#ff4560]" />}
          </div>
        </div>
        {positions.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1a2535]">
            <div className="text-center"><div className="text-xs text-[#94a3b8]">Positions</div><div className="font-bold text-white">{positions.length}</div></div>
            <div className="text-center"><div className="text-xs text-[#94a3b8]">Winners</div><div className="font-bold text-[#00d97e]">{positions.filter((p) => p.pnl > 0).length}</div></div>
            <div className="text-center"><div className="text-xs text-[#94a3b8]">Losers</div><div className="font-bold text-[#ff4560]">{positions.filter((p) => p.pnl < 0).length}</div></div>
          </div>
        )}
      </div>

      {/* Targets */}
      <div className="bg-[#0c1117] border border-[#1a2535] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-[#6366f1]" />
          <span className="text-xs text-[#94a3b8] uppercase tracking-wide font-semibold">Daily Targets</span>
        </div>
        <div className="space-y-4">
          {[
            { label: "Profit Target", val: totalPnL > 0 ? formatINR(totalPnL) : "₹0", target: formatINR(settings.dailyProfitTarget), pct: profitPct, color: "#00d97e" },
            { label: "Stop Loss",     val: totalPnL < 0 ? formatINR(Math.abs(totalPnL)) : "₹0", target: formatINR(settings.dailyStopLoss), pct: lossPct, color: "#ff4560" },
            { label: "Capital",       val: formatINRCompact(totalInvested), target: formatINRCompact(settings.capitalToDeploy), pct: capitalPct, color: "#6366f1" },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#94a3b8]">{row.label}</span>
                <span style={{ color: row.color, fontFamily: "monospace" }}>{row.val} / {row.target}</span>
              </div>
              <div className="h-1.5 bg-[#111920] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${row.pct}%`, background: row.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-[#0c1117] border border-[#1a2535] rounded-2xl p-4">
          <div className="text-xs text-[#94a3b8] uppercase tracking-wide font-semibold mb-3">30-Day P&L</div>
          <div style={{ height: 110 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d97e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#00d97e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#4a5568" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<PnLTooltip />} />
                <ReferenceLine y={0} stroke="#243040" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="pnl" stroke="#00d97e" strokeWidth={1.5} fill="url(#pnlGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent alerts */}
      {firedAlerts.length > 0 && (
        <div className="bg-[#0c1117] border border-[#1a2535] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#f59e0b]" />
            <span className="text-xs text-[#94a3b8] uppercase tracking-wide font-semibold">Recent Alerts</span>
          </div>
          <div className="space-y-2">
            {firedAlerts.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00d97e] flex-shrink-0" />
                <span className="text-[#94a3b8] truncate flex-1">{a.message}</span>
                <span className="text-[#4a5568] flex-shrink-0">
                  {new Date(a.firedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {positions.length === 0 && (
        <div className="bg-[#0c1117] border border-[#1a2535] border-dashed rounded-2xl p-8 text-center">
          <ShieldAlert className="w-8 h-8 text-[#4a5568] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#94a3b8]">No positions yet</p>
          <p className="text-xs text-[#4a5568] mt-1">Go to Portfolio to add positions or import your Groww CSV</p>
        </div>
      )}
    </div>
  );
}
