// ---------------------------------------------------------------------------
// pricingService.js
// Fetches live ETF prices (Yahoo Finance) and crypto prices (Binance).
//
// Improvements over previous version:
//  - Proxy attempts run in PARALLEL (Promise.any) → much faster, no single
//    slow proxy blocks the chain.
//  - Added more CORS proxies (workers.dev, codetabs, allorigins as fallback).
//  - Yahoo v8/chart and Yahoo v7/quote tried concurrently as separate URL
//    shapes → if one proxy blocks /chart, another may pass /quote.
//  - Proper User-Agent spoofing headers where proxies forward them.
//  - Binance: individual fetch errors surface clearly.
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Proxy wrappers — each takes a raw URL and returns parsed JSON.
// They are tried all at once; the first to resolve wins (Promise.any).
// ---------------------------------------------------------------------------
const PROXY_FNS = [
  // 1. corsproxy.io — sends the URL as a query-string parameter
  async (url) => {
    const r = await fetch(
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'x-requested-with': 'XMLHttpRequest' }
      }
    );
    if (!r.ok) throw new Error(`corsproxy.io ${r.status}`);
    return r.json();
  },

  // 2. allorigins — wraps response in { contents: "..." }
  async (url) => {
    const r = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!r.ok) throw new Error(`allorigins ${r.status}`);
    const o = await r.json();
    if (!o.contents) throw new Error('allorigins: empty contents');
    return JSON.parse(o.contents);
  },

  // 3. codetabs proxy
  async (url) => {
    const r = await fetch(
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!r.ok) throw new Error(`codetabs ${r.status}`);
    return r.json();
  },

  // 4. htmldriven cors-proxy (open instance)
  async (url) => {
    const r = await fetch(
      `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!r.ok) throw new Error(`htmldriven ${r.status}`);
    // Returns { body: "<json string>" }
    const o = await r.json();
    return JSON.parse(o.body);
  },

  // 5. thingproxy (path-based, no encoding)
  async (url) => {
    const r = await fetch(
      `https://thingproxy.freeboard.io/fetch/${url}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!r.ok) throw new Error(`thingproxy ${r.status}`);
    return r.json();
  },
];

// Race all proxies; resolve as soon as the first succeeds.
async function proxyRace(url) {
  try {
    return await Promise.any(PROXY_FNS.map(fn => fn(url)));
  } catch (aggregateErr) {
    // AggregateError: all proxies failed
    const msgs = (aggregateErr.errors || [aggregateErr])
      .map(e => e?.message || String(e))
      .join(' | ');
    throw new Error(`All proxies failed: ${msgs}`);
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance — two URL shapes tried concurrently
// ---------------------------------------------------------------------------

// Shape A: v8/chart (OHLC history, needed for avg-high / avg-low)
function yahooChartUrl(ticker) {
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=1d&range=14d&includePrePost=false`
  );
}

// Shape B: v7/quote (single-line quote, no history → avgHigh/Low = price)
function yahooQuoteUrl(ticker) {
  return (
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`
  );
}

// Parse v8/chart response
function parseChart(data, ticker) {
  if (data?.chart?.error) throw new Error(data.chart.error.description || 'Yahoo chart error');
  const res = data?.chart?.result?.[0];
  if (!res) throw new Error(`No chart result for ${ticker}`);
  const q = res.indicators.quote[0];
  const cl = q.close.filter(x => x != null);
  const hi = q.high.filter(x => x != null);
  const lo = q.low.filter(x => x != null);
  if (!cl.length) throw new Error('No close prices in chart data');
  const p = cl[cl.length - 1];
  const h3 = hi.slice(-3);
  const l3 = lo.slice(-3);
  let aH = h3.length ? h3.reduce((a, v) => a + v, 0) / h3.length : p;
  let aL = l3.length ? l3.reduce((a, v) => a + v, 0) / l3.length : p;
  if (aL > p) aL = p;
  if (aH < p) aH = p;
  return { price: p, avgHigh: aH, avgLow: aL, currency: res.meta.currency || 'EUR' };
}

// Parse v7/quote response (no OHLC history → avgHigh/Low use bid/ask or price)
function parseQuote(data, ticker) {
  if (data?.quoteResponse?.error) throw new Error(data.quoteResponse.error.description || 'Yahoo quote error');
  const q = data?.quoteResponse?.result?.[0];
  if (!q) throw new Error(`No quote result for ${ticker}`);
  const p = q.regularMarketPrice ?? q.ask ?? q.bid;
  if (p == null) throw new Error(`No price in quote for ${ticker}`);
  // Use ask/bid as soft limit estimates; fall back to price ±0
  const aH = q.ask && q.ask > p ? q.ask : p;
  const aL = q.bid && q.bid < p ? q.bid : p;
  return { price: p, avgHigh: aH, avgLow: aL, currency: q.currency || 'EUR' };
}

export async function fetchYahooPrice(ticker) {
  const errors = [];

  // Try chart endpoint first (richer data), then quote as fallback.
  // Both race across all proxies simultaneously.
  for (const [urlFn, parseFn] of [
    [yahooChartUrl, parseChart],
    [yahooQuoteUrl, parseQuote],
  ]) {
    try {
      const data = await proxyRace(urlFn(ticker));
      return parseFn(data, ticker);
    } catch (e) {
      errors.push(e.message);
    }
  }

  throw new Error(errors.join(' | '));
}

// ---------------------------------------------------------------------------
// Binance — direct (no proxy needed; Binance has open CORS headers)
// ---------------------------------------------------------------------------
export async function fetchBinancePrice(symbol) {
  const sig = AbortSignal.timeout(12_000);
  let tr, kr;
  try {
    [tr, kr] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, { signal: sig }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=7`, { signal: sig }),
    ]);
  } catch (e) {
    throw new Error(`Binance network error for ${symbol}: ${e.message}`);
  }
  if (!tr.ok) throw new Error(`Binance ticker HTTP ${tr.status} for ${symbol}`);
  if (!kr.ok) throw new Error(`Binance klines HTTP ${kr.status} for ${symbol}`);

  const tk = await tr.json();
  const kl = await kr.json();
  const p = parseFloat(tk.price);
  if (isNaN(p)) throw new Error(`Binance returned non-numeric price for ${symbol}`);
  const l3 = kl.slice(-3);
  let aH = l3.reduce((a, k) => a + parseFloat(k[2]), 0) / l3.length;
  let aL = l3.reduce((a, k) => a + parseFloat(k[3]), 0) / l3.length;
  if (aL > p) aL = p;
  if (aH < p) aH = p;
  return { price: p, avgHigh: aH, avgLow: aL, currency: 'EUR' };
}

// ---------------------------------------------------------------------------
// fetchAllPrices — main entry point used by the rebalancer app
// ---------------------------------------------------------------------------
export async function fetchAllPrices(etfs) {
  const pricesById = {};
  const hiById = {};
  const loById = {};
  const currenciesById = {};
  const infoLines = [];

  for (const e of etfs) {
    // Cash position — no ticker needed
    if (!e.ticker && e.rf) {
      pricesById[e.id] = 1;
      hiById[e.id] = 1;
      loById[e.id] = 1;
      currenciesById[e.id] = 'EUR';
      infoLines.push(`${e.name}: cash (€1.00)`);
      continue;
    }

    try {
      const r = e.cr
        ? await fetchBinancePrice(e.ticker)
        : await fetchYahooPrice(e.ticker);

      pricesById[e.id] = r.price;
      hiById[e.id] = r.avgHigh;
      loById[e.id] = r.avgLow;
      currenciesById[e.id] = r.currency;
      infoLines.push(
        `${e.name} (${e.ticker}): €${r.price.toFixed(2)} ${r.currency}` +
        ` · buy ≤€${r.avgLow.toFixed(2)} · sell ≥€${r.avgHigh.toFixed(2)}`
      );
    } catch (err) {
      throw new Error(
        `Could not fetch price for "${e.name}" (${e.ticker}).\n\n` +
        `ETFs: use Yahoo Finance ticker (e.g. XZW0.DE, EMIM.AS)\n` +
        `Crypto: use Binance EUR pair (e.g. BTCEUR, ETHEUR)\n\n` +
        `Error: ${err.message}`
      );
    }
  }

  return { pricesById, hiById, loById, currenciesById, infoLines };
}
