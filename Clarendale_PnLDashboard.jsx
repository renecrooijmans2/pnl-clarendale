import React from "react";
import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

/* ── URLS ── */
var DATA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQNZN17mecydMZD952EExHyLieTgzgoVJUxqbrS8zmFBJToyWXLGAo0mCLpl972KZSYSoDi24X7XuwF/pub?gid=2124472305&single=true&output=csv";
var CONFIG_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQNZN17mecydMZD952EExHyLieTgzgoVJUxqbrS8zmFBJToyWXLGAo0mCLpl972KZSYSoDi24X7XuwF/pub?gid=843547320&single=true&output=csv";

var N = {
  bg: "#191919", bgS: "#2F3437", bgC: "#252525",
  text: "rgba(255,255,255,0.9)", textS: "rgba(255,255,255,0.5)", textT: "rgba(255,255,255,0.3)",
  border: "rgba(255,255,255,0.06)",
  green: "#34D399", red: "#FF7369",
  revBlue: "#4A7AB5", profitGreen: "#6BAF6B",
  trendBlue: "rgba(74,122,181,0.35)", trendGreen: "rgba(107,175,107,0.35)",
  roasRed: "#D06050",
};
var FONT = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif";

/* ── CSV PARSERS ── */
function parseCSVRow(line) {
  var result = [], cur = "", q = false;
  for (var i = 0; i < line.length; i++) {
    if (line[i] === '"') q = !q;
    else if (line[i] === ',' && !q) { result.push(cur.trim()); cur = ""; }
    else cur += line[i];
  }
  result.push(cur.trim()); return result;
}

function cleanNum(s) {
  if (!s) return null;
  var c = s.replace(/[€$,%\s]/g, "").replace(/\((.+)\)/, "-$1");
  var v = parseFloat(c); return isNaN(v) ? null : v;
}

function parseDataCSV(text) {
  var rows = text.split("\n").map(parseCSVRow);
  var days = [];
  var headerIdx = -1;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i].map(function(c) { return c.toLowerCase(); });
    if (r.some(function(c) { return c.includes("revenue"); }) && r.some(function(c) { return c.includes("day"); })) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return [];
  var headers = rows[headerIdx].map(function(c) { return c.toLowerCase().trim(); });
  var ci = {};
  headers.forEach(function(h, i) {
    if (h.includes("day") || h === "#") ci.day = i;
    if (h.includes("revenue") && !h.includes("total")) ci.revenue = i;
    if (h === "profit" || (h.includes("profit") && !h.includes("%"))) ci.profit = i;
    if (h.includes("profit") && h.includes("%")) ci.profitPct = i;
    if (h.includes("roas")) ci.roas = i;
    if (h === "cog" || (h.includes("cog") && !h.includes("%"))) ci.cog = i;
    if (h.includes("cog") && h.includes("%")) ci.cogPct = i;
    if (h.includes("adspend") || h.includes("ad spend")) ci.adspend = i;
    if (h.includes("refund")) ci.refunds = i;
    if (h.includes("dispute")) ci.disputes = i;
    if (h.includes("week")) ci.week = i;
    if (h.includes("month")) ci.month = i;
    if (h.includes("year")) ci.year = i;
    if (h.includes("tip")) ci.tips = i;
  });

  for (var j = headerIdx + 1; j < rows.length; j++) {
    var row = rows[j]; if (!row || row.length < 3) continue;
    var rev = cleanNum(row[ci.revenue]); if (rev === null) continue;
    if ((row[ci.day] || "").toLowerCase().includes("total")) continue;
    days.push({
      day: cleanNum(row[ci.day]) || days.length + 1,
      revenue: rev,
      profit: cleanNum(row[ci.profit]),
      profitPct: cleanNum(row[ci.profitPct]),
      roas: cleanNum(row[ci.roas]),
      cog: cleanNum(row[ci.cog]),
      cogPct: cleanNum(row[ci.cogPct]),
      adspend: cleanNum(row[ci.adspend]),
      refunds: cleanNum(row[ci.refunds]),
      disputes: cleanNum(row[ci.disputes]),
      week: (row[ci.week] || "").trim(),
      month: (row[ci.month] || "").trim(),
      year: (row[ci.year] || "").trim(),
      tips: cleanNum(row[ci.tips]),
    });
  }
  return days;
}

/* ── DEMO DATA ── */
function genDemo() {
  var days = [], dayNum = 1, seed = 42;
  function rng() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  for (var w = 1; w <= 5; w++) {
    var n = w === 5 ? 3 : 7;
    for (var d = 0; d < n; d++) {
      var rev = Math.round(4000 + rng() * 9000);
      var adspend = Math.round(1500 + rng() * 3000);
      var roas = +(rev / adspend).toFixed(1);
      var cogAmt = Math.round(rev * 0.245);
      var fees = Math.round(rev * 0.085);
      var refunds = Math.round(rng() * 200);
      var profit = rev - adspend - cogAmt - fees - refunds;
      var pp = rev ? Math.round(profit / rev * 100) : 0;
      days.push({
        day: dayNum++, revenue: rev, profit: profit, profitPct: pp, roas: roas,
        cog: cogAmt, adspend: adspend, refunds: refunds, disputes: Math.floor(rng() * 3),
        week: "Week " + w, month: "January", year: "2026", tips: 0, cogPct: 24.5,
      });
    }
  }
  return days;
}

/* ── HELPERS ── */
function linearTrend(data, key) {
  var pts = data.map(function(d, i) { return [i, d[key] || 0]; });
  var n = pts.length; if (n < 2) return data.map(function() { return null; });
  var sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (var i = 0; i < n; i++) { sx += pts[i][0]; sy += pts[i][1]; sxy += pts[i][0] * pts[i][1]; sx2 += pts[i][0] * pts[i][0]; }
  var m = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  var b = (sy - m * sx) / n;
  return pts.map(function(p) { return Math.round(m * p[0] + b); });
}

var fmtCur = function(v, sym) { if (v == null) return "\u2014"; var s = sym || "$"; return s + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : Math.round(v)); };
var fmtPct = function(v) { return v == null ? "\u2014" : Math.round(v) + "%"; };

function WoW(props) {
  var current = props.current, previous = props.previous, invert = props.invert;
  if (current == null || previous == null || previous === 0) return null;
  var ch = ((current - previous) / Math.abs(previous)) * 100;
  var good = invert ? ch <= 0 : ch >= 0;
  return React.createElement("span", { style: { fontSize: 10, fontWeight: 600, color: good ? N.green : N.red } }, (ch >= 0 ? "+" : "") + Math.round(ch) + "%");
}

function ChartTooltip(props) {
  if (!props.active || !props.payload || !props.payload.length) return null;
  return React.createElement("div", { style: { background: N.bgS, border: "1px solid " + N.border, borderRadius: 6, padding: "7px 11px", fontSize: 11, fontFamily: FONT } },
    React.createElement("div", { style: { color: N.textT, marginBottom: 3, fontWeight: 600 } }, "Day " + props.label),
    props.payload.filter(function(p) { return p.value != null && !p.dataKey.includes("Trend"); }).map(function(p, i) {
      return React.createElement("div", { key: i, style: { color: p.color || N.text, display: "flex", justifyContent: "space-between", gap: 14, lineHeight: 1.6 } },
        React.createElement("span", null, p.name),
        React.createElement("span", { style: { fontWeight: 600, fontVariantNumeric: "tabular-nums" } }, p.name === "ROAS" ? p.value.toFixed(1) : fmtCur(p.value))
      );
    })
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
      <rect x="5" y="5" width="90" height="90" rx="4" stroke="rgba(255,255,255,0.8)" strokeWidth="5" fill="none" />
      <path d="M 10 75 Q 20 70 30 60 Q 40 45 50 50 Q 60 55 70 35 Q 80 20 90 25" stroke="rgba(255,255,255,0.85)" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export default function PnLDashboard() {
  var stRaw = useState([]); var rawData = stRaw[0]; var setRawData = stRaw[1];
  var stFee = useState(8.5); var feePct = stFee[0]; var setFeePct = stFee[1];
  var stLoad = useState(true); var loading = stLoad[0]; var setLoading = stLoad[1];
  var stMonth = useState("January"); var selectedMonth = stMonth[0]; var setSelectedMonth = stMonth[1];
  var stYear = useState("2026"); var selectedYear = stYear[0]; var setSelectedYear = stYear[1];
  var stStore = useState(""); var storeName = stStore[0]; var setStoreName = stStore[1];
  var stCur = useState("$"); var currency = stCur[0]; var setCurrency = stCur[1];
  var stSrc = useState("loading"); var dataSrc = stSrc[0]; var setDataSrc = stSrc[1];

  useEffect(function() {
    async function load() {
      var parsed = [];
      if (!DATA_CSV_URL.startsWith("YOUR_")) {
        try {
          var res = await fetch(DATA_CSV_URL);
          var text = await res.text();
          parsed = parseDataCSV(text);
        } catch (e) { console.error("Data fetch failed", e); }
      }
      if (parsed.length > 0) {
        setRawData(parsed);
        setDataSrc("live");
        var months = []; var years = [];
        parsed.forEach(function(d) { if (d.month && months.indexOf(d.month) === -1) months.push(d.month); if (d.year && years.indexOf(d.year) === -1) years.push(d.year); });
        var currentMonth = new Date().toLocaleString("en-US", { month: "long" });
setSelectedMonth(currentMonth);
        setSelectedYear(String(new Date().getFullYear()));
      } else {
        setRawData(genDemo());
        setDataSrc("demo");
      }

      if (!CONFIG_CSV_URL.startsWith("YOUR_")) {
        try {
          var cfgRes = await fetch(CONFIG_CSV_URL);
          var cfgText = await cfgRes.text();
          cfgText.split("\n").map(parseCSVRow).forEach(function(r) {
            var k = (r[0] || "").toLowerCase();
            if (k.includes("fee")) { var v = cleanNum(r[1]); if (v !== null) setFeePct(v); }
            if (k.includes("store")) { var v2 = (r[1] || "").trim(); if (v2) setStoreName(v2); }
            if (k.includes("currency") || k.includes("curr")) { var v3 = (r[1] || "").trim(); if (v3) setCurrency(v3); }
          });
        } catch (e) {}
      }
      setLoading(false);
    }
    load();
  }, []);

  var allMonths = useMemo(function() { var m = []; rawData.forEach(function(d) { if (d.month && m.indexOf(d.month) === -1) m.push(d.month); }); return m; }, [rawData]);
  var allYears = useMemo(function() { var y = []; rawData.forEach(function(d) { if (d.year && y.indexOf(d.year) === -1) y.push(d.year); }); return y; }, [rawData]);

  // Filter + recalculate
  var monthData = useMemo(function() {
    var filtered = rawData;
    if (selectedMonth && rawData.some(function(d) { return d.month; })) filtered = filtered.filter(function(d) { return d.month === selectedMonth; });
    if (selectedYear && rawData.some(function(d) { return d.year; })) filtered = filtered.filter(function(d) { return d.year === selectedYear; });

    // COG%: find value from any day in this month (set on last day)
    var cogPctEntry = null;
    filtered.forEach(function(d) { if (d.cogPct != null && d.cogPct > 0) cogPctEntry = d.cogPct; });
    var cogPctNorm = cogPctEntry != null ? (cogPctEntry > 1 ? cogPctEntry / 100 : cogPctEntry) : null;

    // Tips: find total tips from any day (set on last day)
    var totalTips = 0;
    filtered.forEach(function(d) { if (d.tips && d.tips > 0) totalTips += d.tips; });
    var dailyTips = filtered.length ? Math.round(totalTips / filtered.length) : 0;

    return filtered.map(function(d) {
      var revenue = (d.revenue || 0) + dailyTips;
      var cog = cogPctNorm != null ? Math.round(revenue * cogPctNorm) : (d.cog || 0);
      var fees = revenue ? Math.round(revenue * feePct / 100) : 0;
      var profit = revenue - cog - (d.adspend || 0) - fees - (d.refunds || 0);
      var profitPct = revenue ? Math.round(profit / revenue * 100) : 0;
      return Object.assign({}, d, { revenue: revenue, cog: cog, fees: fees, profit: profit, profitPct: profitPct, dailyTips: dailyTips });
    });
  }, [rawData, selectedMonth, selectedYear, feePct]);

  // Previous month
  var prevMonthData = useMemo(function() {
    if (!allMonths.length) return [];
    var idx = allMonths.indexOf(selectedMonth);
    if (idx <= 0) return [];
    var prevMonth = allMonths[idx - 1];
    return rawData.filter(function(d) { return d.month === prevMonth && d.year === selectedYear; })
      .map(function(d) { return Object.assign({}, d, { fees: d.revenue ? Math.round(d.revenue * feePct / 100) : 0 }); });
  }, [rawData, selectedMonth, selectedYear, allMonths, feePct]);

  // Weeks
  var weeks = useMemo(function() {
    var map = {};
    monthData.forEach(function(d) { var w = d.week || "Week 1"; if (!map[w]) map[w] = []; map[w].push(d); });
    return Object.entries(map).map(function(entry) {
      var name = entry[0]; var days = entry[1];
      var sum = function(k) { return days.reduce(function(a, d) { return a + (d[k] || 0); }, 0); };
      var avgK = function(k) { var v = days.filter(function(d) { return d[k] != null; }); return v.length ? v.reduce(function(a, d) { return a + d[k]; }, 0) / v.length : null; };
      return { name: name, days: days, revenue: sum("revenue"), profit: sum("profit"),
        profitPct: sum("revenue") ? Math.round(sum("profit") / sum("revenue") * 100) : 0,
        roas: avgK("roas"), cog: sum("cog"), adspend: sum("adspend"), refunds: sum("refunds"), disputes: sum("disputes") };
    });
  }, [monthData]);

  var sumOf = function(arr, k) { return arr.reduce(function(a, d) { return a + (d[k] || 0); }, 0); };
  var avgOf = function(arr, k) { var v = arr.filter(function(d) { return d[k] != null; }); return v.length ? v.reduce(function(a, d) { return a + d[k]; }, 0) / v.length : null; };

  var totals = useMemo(function() {
    var rev = sumOf(monthData, "revenue");
    var refunds = sumOf(monthData, "refunds");
    return {
      revenue: rev, profit: sumOf(monthData, "profit"),
      profitPct: rev ? Math.round(sumOf(monthData, "profit") / rev * 100) : 0,
      roas: avgOf(monthData, "roas"),
      cog: sumOf(monthData, "cog"), cogPct: rev ? Math.round(sumOf(monthData, "cog") / rev * 100) : 0,
      adspend: sumOf(monthData, "adspend"), adspendPct: rev ? Math.round(sumOf(monthData, "adspend") / rev * 100) : 0,
      refunds: refunds, refundsPct: rev ? Math.round(refunds / rev * 100) : 0,
      fees: sumOf(monthData, "fees"),
      disputes: sumOf(monthData, "disputes"),
    };
  }, [monthData]);

  var prevTotals = useMemo(function() {
    if (!prevMonthData.length) return null;
    var rev = sumOf(prevMonthData, "revenue");
    return { revenue: rev, profit: sumOf(prevMonthData, "profit"), roas: avgOf(prevMonthData, "roas"),
      cog: sumOf(prevMonthData, "cog"), adspend: sumOf(prevMonthData, "adspend"),
      refunds: sumOf(prevMonthData, "refunds"), fees: sumOf(prevMonthData, "fees"), disputes: sumOf(prevMonthData, "disputes") };
  }, [prevMonthData]);

  var chartData = useMemo(function() {
    var revT = linearTrend(monthData, "revenue");
    var profT = linearTrend(monthData, "profit");
    return monthData.map(function(d, i) { return Object.assign({}, d, { revTrend: revT[i], profitTrend: profT[i] }); });
  }, [monthData]);

  var ax = { fill: N.textT, fontSize: 9 };
  var gs = "rgba(255,255,255,0.04)";
  var fc = function(v) { return fmtCur(v, currency); };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: N.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: FONT }}>
      <div style={{ width: 40, height: 40, border: "2px solid " + N.border, borderTopColor: N.revBlue, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{ color: N.textT, fontSize: 11, fontWeight: 500 }}>Loading data...</div>
    </div>
  );

  var months = allMonths.length > 0 ? allMonths : ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var years = allYears.length > 0 ? allYears : ["2025","2026","2027"];

  return (
    <div style={{ height: "100vh", background: N.bg, color: N.text, fontFamily: FONT, padding: "14px 18px", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo />
          <div>
            <div style={{ fontSize: 9, color: N.textT, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500 }}>Evershop Limited</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{storeName || "Store"} <span style={{ fontWeight: 400, color: N.textS }}>{"\u2014"} Revenue / Profit</span></h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 8, color: dataSrc === "live" ? N.green : "#FFA344", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {dataSrc === "live" ? "\u25CF live" : "\u25CF demo"}
          </span>
          <select value={selectedMonth} onChange={function(e) { setSelectedMonth(e.target.value); }}
            style={{ background: N.bgC, border: "1px solid " + N.border, borderRadius: 4, color: N.text, fontSize: 11, padding: "4px 8px", fontFamily: "inherit" }}>
            {months.map(function(m) { return <option key={m} value={m}>{m}</option>; })}
          </select>
          <select value={selectedYear} onChange={function(e) { setSelectedYear(e.target.value); }}
            style={{ background: N.bgC, border: "1px solid " + N.border, borderRadius: 4, color: N.text, fontSize: 11, padding: "4px 8px", fontFamily: "inherit" }}>
            {years.map(function(y) { return <option key={y} value={y}>{y}</option>; })}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: N.bgC, borderRadius: 4, padding: "4px 8px", border: "1px solid " + N.border }}>
            <span style={{ fontSize: 9, color: N.textT }}>FEE</span>
            <input type="number" value={feePct} onChange={function(e) { setFeePct(+e.target.value || 0); }} step="0.5" min="0" max="30"
              style={{ width: 42, background: "transparent", border: "none", color: N.text, fontSize: 12, fontWeight: 600, textAlign: "center", fontFamily: "inherit", fontVariantNumeric: "tabular-nums", outline: "none" }} />
            <span style={{ fontSize: 9, color: N.textT }}>%</span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, flex: 1, minHeight: 0 }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

          {/* Revenue/Profit chart */}
          <div style={{ background: N.bgC, border: "1px solid " + N.border, borderRadius: 8, padding: "12px 12px 4px", flex: 3, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: N.textS, textTransform: "uppercase", letterSpacing: "0.04em" }}>Revenue / Profit {storeName ? "\u2014 " + storeName : ""} {"\u2014"} {selectedMonth}</span>
              <div style={{ display: "flex", gap: 12, fontSize: 9, color: N.textT }}>
                <span><span style={{ display: "inline-block", width: 14, height: 2, background: N.revBlue, marginRight: 4, verticalAlign: "middle" }} />Revenue</span>
                <span><span style={{ display: "inline-block", width: 14, height: 2, background: N.profitGreen, marginRight: 4, verticalAlign: "middle" }} />Profit</span>
                <span><span style={{ display: "inline-block", width: 14, height: 2, background: N.trendBlue, marginRight: 4, verticalAlign: "middle" }} />Trend</span>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 50, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gs} />
                  <XAxis dataKey="day" tick={ax} tickLine={false} axisLine={{ stroke: gs }} />
                  <YAxis yAxisId="left" tick={ax} tickLine={false} axisLine={false} tickFormatter={function(v) { return currency + (v / 1000).toFixed(0) + "k"; }} />
                  <YAxis yAxisId="right" orientation="right" tick={ax} tickLine={false} axisLine={false} tickFormatter={function(v) { return currency + (v / 1000).toFixed(0) + "k"; }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line yAxisId="left" type="linear" dataKey="revTrend" stroke={N.trendBlue} strokeWidth={1.5} strokeDasharray="8 4" dot={false} connectNulls name="Revenue Trend" />
                  <Line yAxisId="right" type="linear" dataKey="profitTrend" stroke={N.trendGreen} strokeWidth={1.5} strokeDasharray="8 4" dot={false} connectNulls name="Profit Trend" />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke={N.revBlue} strokeWidth={2} dot={{ r: 2.5, fill: N.revBlue, stroke: N.revBlue }} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="profit" name="Profit" stroke={N.profitGreen} strokeWidth={2} dot={{ r: 2.5, fill: N.profitGreen, stroke: N.profitGreen }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPIs + ROAS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 2, minHeight: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr 1fr 1fr", gap: 6 }}>
              {[
                { label: "Total Sales", value: fc(totals.revenue), sub: "100%", prev: prevTotals ? prevTotals.revenue : null, key: "revenue", topColor: "#4A7AB5" },
                { label: "Gross Profit", value: fc(totals.profit), sub: totals.profitPct + "%", prev: prevTotals ? prevTotals.profit : null, key: "profit", colorVal: true, topColor: totals.profit >= 0 ? "#34D399" : "#FF7369" },
                { label: "Adspend", value: fc(totals.adspend), sub: totals.adspendPct + "%", prev: prevTotals ? prevTotals.adspend : null, key: "adspend", topColor: "#D06050" },
                { label: "Avg. ROAS", value: totals.roas ? totals.roas.toFixed(1) : "\u2014", prev: prevTotals ? prevTotals.roas : null, key: "roas", topColor: "#D06050" },
                { label: "COG", value: fc(totals.cog), sub: totals.cogPct + "%", prev: prevTotals ? prevTotals.cog : null, key: "cog", invert: true, topColor: "rgba(255,255,255,0.15)" },
                { label: "Refunds", value: fc(totals.refunds), sub: totals.refundsPct + "%", prev: prevTotals ? prevTotals.refunds : null, key: "refunds", invert: true, topColor: "rgba(255,255,255,0.15)" },
                { label: "Fees", value: fc(totals.fees), sub: feePct + "%", prev: prevTotals ? prevTotals.fees : null, key: "fees", invert: true, topColor: "rgba(255,255,255,0.15)" },
                { label: "Disputes", value: totals.disputes, sub: "", prev: prevTotals ? prevTotals.disputes : null, key: "disputes", invert: true, topColor: "rgba(255,255,255,0.15)" },
              ].map(function(kpi) {
                return (
                  <div key={kpi.label} style={{ background: N.bgC, border: "1px solid " + N.border, borderRadius: 6, borderTop: "3px solid " + kpi.topColor, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: 9, color: N.textT, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>{kpi.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: kpi.colorVal ? (totals.profit >= 0 ? N.green : N.red) : N.text }}>{kpi.value}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
                      {kpi.sub && <span style={{ fontSize: 12, color: N.textS, fontWeight: 500 }}>{kpi.sub}</span>}
                      {kpi.prev != null && <WoW current={totals[kpi.key]} previous={kpi.prev} invert={kpi.invert} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ROAS chart */}
            <div style={{ background: N.bgC, border: "1px solid " + N.border, borderRadius: 8, padding: "12px 12px 4px", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: N.textS, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>ROAS {"\u2014"} {selectedMonth}</div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gs} />
                    <XAxis dataKey="day" tick={ax} tickLine={false} axisLine={{ stroke: gs }} />
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

        {/* RIGHT: Table */}
        <div style={{ background: N.bgC, border: "1px solid " + N.border, borderRadius: 8, padding: "8px", overflowY: "auto", minHeight: 0 }}>
          <style>{"" +
            ".pnl-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }" +
            ".pnl-table th { position: sticky; top: 0; background: " + N.bgS + "; color: " + N.textS + "; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; padding: 5px 5px; text-align: right; z-index: 1; white-space: nowrap; }" +
            ".pnl-table th:first-child { text-align: left; }" +
            ".pnl-table td { padding: 4px 5px; text-align: right; color: " + N.text + "; border-bottom: 1px solid " + N.border + "; white-space: nowrap; font-size: 12px; }" +
            ".pnl-table td:first-child { text-align: left; color: " + N.textT + "; font-size: 11px; }" +
            ".pnl-table tr.wt { background: rgba(255,255,255,0.03); }" +
            ".pnl-table tr.wt td { font-weight: 700; padding: 6px 5px; border-bottom: 2px solid rgba(255,255,255,0.08); }" +
            ".pnl-table tr.wh td { padding: 10px 5px 4px; font-weight: 600; color: " + N.textS + "; font-size: 11px; border-bottom: none; }" +
            ".pnl-table tr.wow td { font-size: 10px; padding: 2px 5px 8px; border-bottom: 2px solid rgba(255,255,255,0.08); }"
          }</style>
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
              {weeks.map(function(week, wi) {
                var prev = wi > 0 ? weeks[wi - 1] : null;
                return (
                  <React.Fragment key={week.name}>
                    <tr className="wh"><td colSpan={9}>{week.name}</td></tr>
                    {week.days.map(function(d, di) {
                      return (
                        <tr key={wi + "-" + di}>
                          <td>{d.day}</td>
                          <td>{fc(d.revenue)}</td>
                          <td style={{ color: d.profit < 0 ? N.red : N.green }}>{fc(d.profit)}</td>
                          <td>{d.profitPct != null ? Math.round(d.profitPct) : "\u2014"}</td>
                          <td>{d.roas ? d.roas.toFixed(1) : "\u2014"}</td>
                          <td>{fc(d.cog)}</td>
                          <td>{fc(d.adspend)}</td>
                          <td>{fc(d.refunds)}</td>
                          <td>{d.disputes != null ? d.disputes : "\u2014"}</td>
                        </tr>
                      );
                    })}
                    <tr className="wt">
                      <td>Total</td>
                      <td>{fc(week.revenue)}</td>
                      <td style={{ color: week.profit < 0 ? N.red : N.green }}>{fc(week.profit)}</td>
                      <td>{week.profitPct}%</td>
                      <td>{week.roas ? week.roas.toFixed(1) : "\u2014"}</td>
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
      <div style={{ padding: "4px 0", borderTop: "1px solid " + N.border, display: "flex", justifyContent: "space-between", fontSize: 8, color: N.textT, marginTop: 6 }}>
        <span>Clarendale P&L {"\u2014"} {dataSrc}</span>
        <span>{monthData.length} days {"\u00B7"} {weeks.length} weeks {"\u00B7"} Fee: {feePct}%</span>
      </div>
    </div>
  );
}
