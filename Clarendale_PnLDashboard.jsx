import React from 'react'
import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const DATA_CSV_URL = "YOUR_DATA_SHEET_CSV_URL";
const CONFIG_CSV_URL = "YOUR_CONFIG_SHEET_CSV_URL";

const N = {
  bg: "#191919", bgS: "#2F3437", bgC: "#252525",
  text: "rgba(255,255,255,0.9)", textS: "rgba(255,255,255,0.5)", textT: "rgba(255,255,255,0.3)",
  border: "rgba(255,255,255,0.06)",
  green: "#34D399", red: "#FF7369",
  revBlue: "#4A7AB5", profitGreen: "#6BAF6B",
  trendBlue: "rgba(74,122,181,0.35)", trendGreen: "rgba(107,175,107,0.35)",
  roasRed: "#D06050",
};

function parseCSVRow(line) {
  const result = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') q = !q;
    else if (line[i] === ',' && !q) { result.push(cur.trim()); cur = ""; }
    else cur += line[i];
  }
  result.push(cur.trim()); return result;
}

function cleanNum(s) {
  if (!s) return null;
  const c = s.replace(/[€$,%\s]/g, "").replace(/\((.+)\)/, "-$1");
  const v = parseFloat(c); return isNaN(v) ? null : v;
}

function parseDataCSV(text) {
  const rows = text.split("\n").map(parseCSVRow);
  const days = [];
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(c => c.toLowerCase());
    if (r.some(c => c.includes("revenue")) && r.some(c => c.includes("profit"))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return [];
  const headers = rows[headerIdx].map(c => c.toLowerCase().trim());
  const ci = {};
  headers.forEach((h, i) => {
    if (h.includes("date") || h.includes("day") || h === "#") ci.day = i;
    if (h.includes("revenue") && !h.includes("total")) ci.revenue = i;
    if (h === "profit" || (h.includes("profit") && !h.includes("%"))) ci.profit = i;
    if (h.includes("profit") && h.includes("%")) ci.profitPct = i;
    if (h.includes("roas")) ci.roas = i;
    if (h.includes("cog")) ci.cog = i;
    if (h.includes("adspend") || h.includes("ad spend")) ci.adspend = i;
    if (h.includes("refund")) ci.refunds = i;
    if (h.includes("dispute")) ci.disputes = i;
    if (h.includes("week")) ci.week = i;
    if (h.includes("month")) ci.month = i;
    if (h.includes("year")) ci.year = i;
    if (h.includes("note")) ci.notes = i;
    if (h.includes("tip")) ci.tips = i;
    if ((h.includes("cog") && h.includes("%")) || h === "cog %") ci.cogPct = i;
  });
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || r.length < 3) continue;
    const rev = cleanNum(r[ci.revenue]); if (rev === null) continue;
    if ((r[ci.day] || "").toLowerCase().includes("total")) continue;
    days.push({
      day: cleanNum(r[ci.day]) || days.length + 1,
      revenue: rev,
      profit: cleanNum(r[ci.profit]),
      profitPct: cleanNum(r[ci.profitPct]),
      roas: cleanNum(r[ci.roas]),
      cog: cleanNum(r[ci.cog]),
      adspend: cleanNum(r[ci.adspend]),
      refunds: cleanNum(r[ci.refunds]),
      disputes: cleanNum(r[ci.disputes]),
      week: (r[ci.week] || "").trim(),
      month: (r[ci.month] || "").trim(),
      year: (r[ci.year] || "").trim(),
      notes: (r[ci.notes] || "").trim(),
      tips: cleanNum(r[ci.tips]),
      cogPct: cleanNum(r[ci.cogPct]),
    });
  }
  return days;
}

function generateDemoData() {
  const days = []; let dayNum = 1;
  for (let w = 1; w <= 5; w++) {
    const n = w === 5 ? 3 : 7;
    for (let d = 0; d < n; d++) {
      const rev = Math.round(2500 + Math.random() * 8000 + w * 500);
      const pp = Math.round(15 + Math.random() * 25);
      const profit = Math.round(rev * pp / 100);
      const roas = +(2.0 + Math.random() * 2).toFixed(1);
      days.push({
        day: dayNum++, revenue: rev, profit, profitPct: pp, roas,
        cog: Math.round(rev * 0.25), adspend: Math.round(rev / roas),
        refunds: Math.round(Math.random() * 200), disputes: Math.floor(Math.random() * 3),
        week: `Week ${w}`, month: "January", year: "2026", notes: "",
      });
    }
  }
  return days;
}

// Linear regression for true trendline
function linearTrend(data, key) {
  const pts = data.map((d, i) => [i, d[key] || 0]);
  const n = pts.length; if (n < 2) return data.map(() => null);
  const sx = pts.reduce((a, p) => a + p[0], 0);
  const sy = pts.reduce((a, p) => a + p[1], 0);
  const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const sx2 = pts.reduce((a, p) => a + p[0] * p[0], 0);
  const m = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const b = (sy - m * sx) / n;
  return pts.map(p => Math.round(m * p[0] + b));
}

const fmtEur = v => v == null ? "—" : `€${Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("nl-NL") : Math.round(v)}`;
const fmtPct = v => v == null ? "—" : `${Math.round(v)}%`;

const WoW = ({ current, previous, invert = false }) => {
  if (current == null || previous == null || previous === 0) return null;
  const ch = ((current - previous) / Math.abs(previous)) * 100;
  const good = invert ? ch <= 0 : ch >= 0;
  return <span style={{ fontSize: 10, fontWeight: 600, color: good ? N.green : N.red }}>{ch >= 0 ? "+" : ""}{Math.round(ch)}%</span>;
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: N.bgS, border: `1px solid ${N.border}`, borderRadius: 6, padding: "7px 11px", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ color: N.textT, marginBottom: 3, fontWeight: 600 }}>Day {label}</div>
      {payload.filter(p => p.value != null && !p.dataKey.includes("Trend")).map((p, i) => (
        <div key={i} style={{ color: p.color || N.text, display: "flex", justifyContent: "space-between", gap: 14, lineHeight: 1.6 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {p.name === "ROAS" ? p.value.toFixed(1) : fmtEur(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const EvershopLogo = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
    <rect x="5" y="5" width="90" height="90" rx="4" stroke="rgba(255,255,255,0.8)" strokeWidth="5" fill="none" />
    <path d="M 10 75 Q 20 70 30 60 Q 40 45 50 50 Q 60 55 70 35 Q 80 20 90 25" stroke="rgba(255,255,255,0.85)" strokeWidth="6" strokeLinecap="round" fill="none" />
  </svg>
);

export default function PnLDashboard() {
  const [rawData, setRawData] = useState([]);
  const [feePct, setFeePct] = useState(6);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("January");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!DATA_CSV_URL.startsWith("YOUR_")) {
        try {
          const res = await fetch(DATA_CSV_URL); const text = await res.text();
          const parsed = parseDataCSV(text);
          if (parsed.length) {
            setRawData(parsed);
            const months = [...new Set(parsed.map(d => d.month).filter(Boolean))];
            const years = [...new Set(parsed.map(d => d.year).filter(Boolean))];
            if (months.length) setSelectedMonth(months[months.length - 1]);
            if (years.length) setSelectedYear(years[years.length - 1]);
          } else setRawData(generateDemoData());
        } catch (e) { setRawData(generateDemoData()); }
      } else setRawData(generateDemoData());
      if (!CONFIG_CSV_URL.startsWith("YOUR_")) {
        try {
          const res = await fetch(CONFIG_CSV_URL); const text = await res.text();
          for (const r of text.split("\n").map(parseCSVRow)) {
            if ((r[0] || "").toLowerCase().includes("fee")) { const v = cleanNum(r[1]); if (v !== null) setFeePct(v); }
            if ((r[0] || "").toLowerCase().includes("store")) { const v = (r[1] || "").trim(); if (v) setStoreName(v); }
          }
        } catch (e) {}
      }
      setLoading(false);
    };
    load();
  }, []);

  const allMonths = useMemo(() => [...new Set(rawData.map(d => d.month).filter(Boolean))], [rawData]);
  const allYears = useMemo(() => [...new Set(rawData.map(d => d.year).filter(Boolean))], [rawData]);

  // Filter by month/year and recalculate profit based on fee + tips + COG%
  const monthData = useMemo(() => {
    let filtered = rawData;
    if (selectedMonth && rawData.some(d => d.month)) filtered = filtered.filter(d => d.month === selectedMonth);
    if (selectedYear && rawData.some(d => d.year)) filtered = filtered.filter(d => d.year === selectedYear);
    
    // Calculate tips: sum all tips entries, divide evenly across days
    const totalTips = filtered.reduce((a, d) => a + (d.tips || 0), 0);
    const dailyTips = filtered.length ? Math.round(totalTips / filtered.length) : 0;
    
    // Find COG% if set (entered on last day of month, applies to all days)
    const cogPctEntry = filtered.reduce((found, d) => d.cogPct != null && d.cogPct > 0 ? d.cogPct : found, null);
    // cogPct might be 0.245 (decimal) or 24.5 (percentage) - normalize
    const cogPctNorm = cogPctEntry != null ? (cogPctEntry > 1 ? cogPctEntry / 100 : cogPctEntry) : null;
    
    return filtered.map(d => {
      const revenue = (d.revenue || 0) + dailyTips;
      // If COG% is set, calculate COG from it; otherwise use the COG value from the sheet
      const cog = cogPctNorm != null ? Math.round(revenue * cogPctNorm) : (d.cog || 0);
      const fees = revenue ? Math.round(revenue * feePct / 100) : 0;
      const profit = revenue - cog - (d.adspend || 0) - fees - (d.refunds || 0);
      const profitPct = revenue ? Math.round(profit / revenue * 100) : 0;
      return { ...d, revenue, cog, fees, profit, profitPct, dailyTips };
    });
  }, [rawData, selectedMonth, selectedYear, feePct]);

  // Previous month data for MoM comparison
  const prevMonthData = useMemo(() => {
    if (!allMonths.length) return [];
    const idx = allMonths.indexOf(selectedMonth);
    if (idx <= 0) return [];
    const prevMonth = allMonths[idx - 1];
    return rawData.filter(d => d.month === prevMonth && d.year === selectedYear)
      .map(d => ({ ...d, fees: d.revenue ? Math.round(d.revenue * feePct / 100) : 0 }));
  }, [rawData, selectedMonth, selectedYear, allMonths, feePct]);

  // Weeks
  const weeks = useMemo(() => {
    const map = {};
    monthData.forEach(d => { const w = d.week || "Week 1"; if (!map[w]) map[w] = []; map[w].push(d); });
    return Object.entries(map).map(([name, days]) => {
      const sum = k => days.reduce((a, d) => a + (d[k] || 0), 0);
      const avgK = k => { const v = days.filter(d => d[k] != null); return v.length ? v.reduce((a, d) => a + d[k], 0) / v.length : null; };
      return { name, days, revenue: sum("revenue"), profit: sum("profit"),
        profitPct: sum("revenue") ? Math.round(sum("profit") / sum("revenue") * 100) : 0,
        roas: avgK("roas"), cog: sum("cog"), adspend: sum("adspend"), refunds: sum("refunds"), disputes: sum("disputes") };
    });
  }, [monthData]);

  const sumOf = (arr, k) => arr.reduce((a, d) => a + (d[k] || 0), 0);
  const avgOf = (arr, k) => { const v = arr.filter(d => d[k] != null); return v.length ? v.reduce((a, d) => a + d[k], 0) / v.length : null; };

  const totals = useMemo(() => {
    const rev = sumOf(monthData, "revenue");
    const refunds = sumOf(monthData, "refunds");
    return {
      revenue: rev, profit: sumOf(monthData, "profit"),
      profitPct: rev ? Math.round(sumOf(monthData, "profit") / rev * 100) : 0,
      roas: avgOf(monthData, "roas"),
      cog: sumOf(monthData, "cog"), cogPct: rev ? Math.round(sumOf(monthData, "cog") / rev * 100) : 0,
      adspend: sumOf(monthData, "adspend"), adspendPct: rev ? Math.round(sumOf(monthData, "adspend") / rev * 100) : 0,
      refunds, refundsPct: rev ? Math.round(refunds / rev * 100) : 0,
      fees: sumOf(monthData, "fees"),
      disputes: sumOf(monthData, "disputes"), disputesPct: 0,
    };
  }, [monthData]);

  const prevTotals = useMemo(() => {
    if (!prevMonthData.length) return null;
    const rev = sumOf(prevMonthData, "revenue");
    return {
      revenue: rev, profit: sumOf(prevMonthData, "profit"),
      roas: avgOf(prevMonthData, "roas"),
      cog: sumOf(prevMonthData, "cog"), adspend: sumOf(prevMonthData, "adspend"),
      refunds: sumOf(prevMonthData, "refunds"), fees: sumOf(prevMonthData, "fees"),
      disputes: sumOf(prevMonthData, "disputes"),
    };
  }, [prevMonthData]);

  // Chart data with true linear trendlines
  const chartData = useMemo(() => {
    const revTrend = linearTrend(monthData, "revenue");
    const profTrend = linearTrend(monthData, "profit");
    return monthData.map((d, i) => ({ ...d, revTrend: revTrend[i], profitTrend: profTrend[i] }));
  }, [monthData]);

  const ax = { fill: N.textT, fontSize: 9 };
  const gs = "rgba(255,255,255,0.04)";

  if (loading) return (
    <div style={{ minHeight: "100vh", background: N.bg, display: "flex", alignItems: "center", justifyContent: "center", color: N.textT }}>
      <EvershopLogo />
    </div>
  );

  return (
    <div style={{ height: "100vh", background: N.bg, color: N.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <EvershopLogo />
          <div>
            <div style={{ fontSize: 9, color: N.textT, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500 }}>Evershop Limited</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{storeName || "Store"} <span style={{ fontWeight: 400, color: N.textS }}>—</span> <span style={{ fontWeight: 400, color: N.textS }}>Revenue / Profit</span></h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(() => {
            const months = allMonths.length > 0 ? allMonths : ["January","February","March","April","May","June","July","August","September","October","November","December"];
            return (
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={{ background: N.bgC, border: `1px solid ${N.border}`, borderRadius: 4, color: N.text, fontSize: 11, padding: "4px 8px", fontFamily: "inherit" }}>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            );
          })()}
          {(() => {
            const years = allYears.length > 0 ? allYears : ["2025","2026","2027"];
            return (
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                style={{ background: N.bgC, border: `1px solid ${N.border}`, borderRadius: 4, color: N.text, fontSize: 11, padding: "4px 8px", fontFamily: "inherit" }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            );
          })()}
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: N.bgC, borderRadius: 4, padding: "4px 8px", border: `1px solid ${N.border}` }}>
            <span style={{ fontSize: 9, color: N.textT }}>FEE</span>
            <input type="number" value={feePct} onChange={e => setFeePct(+e.target.value || 0)} step="0.5" min="0" max="30"
              style={{ width: 42, background: "transparent", border: "none", color: N.text, fontSize: 12, fontWeight: 600, textAlign: "center", fontFamily: "inherit", fontVariantNumeric: "tabular-nums", outline: "none" }} />
            <span style={{ fontSize: 9, color: N.textT }}>%</span>
          </div>
        </div>
      </div>

      {/* Main: 2fr left + 1fr right */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, flex: 1, minHeight: 0 }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

          {/* Revenue / Profit chart — takes most space */}
          <div style={{ background: N.bgC, border: `1px solid ${N.border}`, borderRadius: 8, padding: "12px 12px 4px", flex: 3, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: N.textS, textTransform: "uppercase", letterSpacing: "0.04em" }}>Revenue / Profit{storeName ? ` — ${storeName}` : ""} — {selectedMonth}</span>
              <div style={{ display: "flex", gap: 12, fontSize: 9, color: N.textT }}>
                <span><span style={{ display: "inline-block", width: 14, height: 2, background: N.revBlue, marginRight: 4, verticalAlign: "middle" }}/>Revenue</span>
                <span><span style={{ display: "inline-block", width: 14, height: 2, background: N.profitGreen, marginRight: 4, verticalAlign: "middle" }}/>Profit</span>
                <span><span style={{ display: "inline-block", width: 14, height: 2, background: N.trendBlue, marginRight: 4, verticalAlign: "middle", borderTop: "1px dashed" }}/>Trend</span>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 50, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gs} />
                  <XAxis dataKey="day" tick={ax} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.04)" }} />
                  <YAxis yAxisId="left" tick={ax} tickLine={false} axisLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={ax} tickLine={false} axisLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line yAxisId="left" type="linear" dataKey="revTrend" stroke={N.trendBlue} strokeWidth={1.5} strokeDasharray="8 4" dot={false} connectNulls name="Revenue Trend" />
                  <Line yAxisId="right" type="linear" dataKey="profitTrend" stroke={N.trendGreen} strokeWidth={1.5} strokeDasharray="8 4" dot={false} connectNulls name="Profit Trend" />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke={N.revBlue} strokeWidth={2} dot={{ r: 2.5, fill: N.revBlue, stroke: N.revBlue }} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="profit" name="Profit" stroke={N.profitGreen} strokeWidth={2} dot={{ r: 2.5, fill: N.profitGreen, stroke: N.profitGreen }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom row: KPIs + ROAS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 2, minHeight: 0 }}>

            {/* KPI boxes - 2 columns × 4 rows */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr 1fr 1fr", gap: 6 }}>
              {[
                { label: "Total Sales", value: fmtEur(totals.revenue), sub: "100%", prev: prevTotals?.revenue, key: "revenue", topColor: "#4A7AB5" },
                { label: "Gross Profit", value: fmtEur(totals.profit), sub: `${totals.profitPct}%`, prev: prevTotals?.profit, key: "profit", colorVal: true, topColor: totals.profit >= 0 ? "#34D399" : "#FF7369" },
                { label: "Adspend", value: fmtEur(totals.adspend), sub: `${totals.adspendPct}%`, prev: prevTotals?.adspend, key: "adspend", topColor: "#D06050" },
                { label: "Avg. ROAS", value: totals.roas?.toFixed(1) ?? "—", prev: prevTotals?.roas, key: "roas", topColor: "#D06050" },
                { label: "COG", value: fmtEur(totals.cog), sub: `${totals.cogPct}%`, prev: prevTotals?.cog, key: "cog", invert: true, topColor: "rgba(255,255,255,0.15)" },
                { label: "Refunds", value: fmtEur(totals.refunds), sub: `${totals.refundsPct}%`, prev: prevTotals?.refunds, key: "refunds", invert: true, topColor: "rgba(255,255,255,0.15)" },
                { label: "Fees", value: fmtEur(totals.fees), sub: `${feePct}%`, prev: prevTotals?.fees, key: "fees", invert: true, topColor: "rgba(255,255,255,0.15)" },
                { label: "Disputes", value: totals.disputes, sub: `${totals.disputesPct}%`, prev: prevTotals?.disputes, key: "disputes", invert: true, topColor: "rgba(255,255,255,0.15)" },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: N.bgC, border: `1px solid ${N.border}`, borderRadius: 6, borderTop: `3px solid ${kpi.topColor}`, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 9, color: N.textT, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                    color: kpi.colorVal ? (totals.profit >= 0 ? N.green : N.red) : N.text }}>{kpi.value}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                    {kpi.sub && <span style={{ fontSize: 12, color: N.textS, fontWeight: 500 }}>{kpi.sub}</span>}
                    {kpi.prev != null && <WoW current={totals[kpi.key]} previous={kpi.prev} invert={kpi.invert} />}
                  </div>
                </div>
              ))}
            </div>

            {/* ROAS chart */}
            <div style={{ background: N.bgC, border: `1px solid ${N.border}`, borderRadius: 8, padding: "12px 12px 4px", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: N.textS, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>ROAS — {selectedMonth}</div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gs} />
                    <XAxis dataKey="day" tick={ax} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.04)" }} />
                    <YAxis tick={ax} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={totals.roas} stroke={N.textT} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="roas" name="ROAS" stroke={N.roasRed} strokeWidth={2} dot={{ r: 1.5, fill: N.roasRed }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Data table */}
        <div style={{ background: N.bgC, border: `1px solid ${N.border}`, borderRadius: 8, padding: "8px", overflowY: "auto", minHeight: 0 }}>
          <style>{`
            .pnl-table { width: 100%; border-collapse: collapse; font-size: 10px; font-variant-numeric: tabular-nums; }
            .pnl-table th { position: sticky; top: 0; background: ${N.bgS}; color: ${N.textS}; font-weight: 600; font-size: 8px; text-transform: uppercase; letter-spacing: 0.03em; padding: 5px 4px; text-align: right; z-index: 1; white-space: nowrap; }
            .pnl-table th:first-child { text-align: left; }
            .pnl-table td { padding: 3px 4px; text-align: right; color: ${N.text}; border-bottom: 1px solid ${N.border}; white-space: nowrap; font-size: 10px; }
            .pnl-table td:first-child { text-align: left; color: ${N.textT}; font-size: 9px; }
            .pnl-table tr.wt { background: rgba(255,255,255,0.03); }
            .pnl-table tr.wt td { font-weight: 700; padding: 5px 4px; border-bottom: 2px solid rgba(255,255,255,0.08); }
            .pnl-table tr.wh td { padding: 8px 4px 3px; font-weight: 600; color: ${N.textS}; font-size: 10px; border-bottom: none; }
            .pnl-table tr.wow td { font-size: 9px; padding: 1px 4px 6px; border-bottom: 2px solid rgba(255,255,255,0.08); }
          `}</style>
          <table className="pnl-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}></th>
                <th>Rev</th>
                <th>Profit</th>
                <th>P%</th>
                <th>ROAS</th>
                <th>COG</th>
                <th>Ads</th>
                <th>Ref</th>
                <th>#</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => {
                const prev = wi > 0 ? weeks[wi - 1] : null;
                return (
                  <React.Fragment key={week.name}>
                    <tr className="wh"><td colSpan={9}>{week.name}</td></tr>
                    {week.days.map((d, di) => (
                      <tr key={`${wi}-${di}`}>
                        <td>{d.day}</td>
                        <td>{fmtEur(d.revenue)}</td>
                        <td style={{ color: d.profit < 0 ? N.red : N.green }}>{fmtEur(d.profit)}</td>
                        <td>{d.profitPct != null ? `${Math.round(d.profitPct)}` : "—"}</td>
                        <td>{d.roas?.toFixed(1) ?? "—"}</td>
                        <td>{fmtEur(d.cog)}</td>
                        <td>{fmtEur(d.adspend)}</td>
                        <td>{fmtEur(d.refunds)}</td>
                        <td>{d.disputes ?? "—"}</td>
                      </tr>
                    ))}
                    <tr className="wt">
                      <td>Total</td>
                      <td>{fmtEur(week.revenue)}</td>
                      <td style={{ color: week.profit < 0 ? N.red : N.green }}>{fmtEur(week.profit)}</td>
                      <td>{week.profitPct}%</td>
                      <td>{week.roas?.toFixed(1) ?? "—"}</td>
                      <td></td><td></td><td></td><td></td>
                    </tr>
                    {prev && (
                      <tr className="wow">
                        <td></td>
                        <td><WoW current={week.revenue} previous={prev.revenue} /></td>
                        <td><WoW current={week.profit} previous={prev.profit} /></td>
                        <td><WoW current={week.profitPct} previous={prev.profitPct} /></td>
                        <td><WoW current={week.roas} previous={prev.roas} /></td>
                        <td></td><td></td><td></td><td></td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "4px 0", borderTop: `1px solid ${N.border}`, display: "flex", justifyContent: "space-between", fontSize: 8, color: N.textT, marginTop: 6 }}>
        <span>Google Sheets → P&L</span>
        <span>{monthData.length} days · {weeks.length} weeks · Fee: {feePct}%</span>
      </div>
    </div>
  );
}
