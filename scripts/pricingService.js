// ---------------------------------------------------------------------------
// pricingService.js
//
// Strategy — three independent data sources tried in order per ticker:
//
//  1. Yahoo Finance v8 chart via query2 subdomain (different rate-limit pool)
//     wrapped in allorigins (still works for query2, blocked less than query1).
//  2. Open-source yahoo-finance2-compatible REST mirror at
//     https://yfapi.net  (free tier, no key needed for basic quotes).
//  3. Yahoo Finance 30-day price history via corsproxy.io as final fallback.
//
// Crypto (Binance) is direct — Binance has open CORS headers.
// ---------------------------------------------------------------------------

const T = 20_000; // global timeout ms
const PRICE_CACHE_KEY = 'etf_reb_price_cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── price cache management ─────────────────────────────────────────────────────
function getPriceCache() {
  try {
    const cached = localStorage.getItem(PRICE_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function savePriceCache(cache) {
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

function isCacheValid(timestamp) {
  return Date.now() - timestamp < CACHE_DURATION_MS;
}

function getCachedPrice(source, ticker) {
  const cache = getPriceCache();
  const entry = cache[`${source}:${ticker}`];
  if (entry && isCacheValid(entry.timestamp)) {
    return entry.data;
  }
  return null;
}

function setCachedPrice(source, ticker, priceData) {
  const cache = getPriceCache();
  cache[`${source}:${ticker}`] = {
    data: priceData,
    timestamp: Date.now()
  };
  savePriceCache(cache);
}

// ── cache export/import functions ──────────────────────────────────────────────
export function exportPriceCache() {
  const cache = getPriceCache();
  return {
    priceCache: cache,
    exportDate: new Date().toISOString()
  };
}

export function importPriceCache(priceData) {
  if (!priceData || !priceData.priceCache) {
    return;
  }
  
  try {
    // Only import cache entries that are still valid
    const cache = priceData.priceCache;
    const validEntries = {};
    
    for (const [ticker, entry] of Object.entries(cache)) {
      if (entry && entry.data && isCacheValid(entry.timestamp)) {
        validEntries[ticker] = entry;
      }
    }
    
    if (Object.keys(validEntries).length > 0) {
      savePriceCache(validEntries);
    }
  } catch (error) {
    console.warn('Failed to import price cache:', error);
  }
}

// ── tiny helper ─────────────────────────────────────────────────────────────
function sig() { return AbortSignal.timeout(T); }

async function getJson(url, options = {}) {
  const r = await fetch(url, { signal: sig(), ...options });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).hostname}`);
  return r.json();
}

// ── Source 1 & 2 : Yahoo Finance v8/chart via two proxy paths ───────────────
// query2 is Yahoo's secondary CDN — often succeeds when query1 is throttled.
function buildChartUrl(subdomain, ticker) {
  return (
    `https://${subdomain}.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(ticker)}?interval=1d&range=14d&includePrePost=false`
  );
}

async function fetchViaAllorigins(ticker) {
  const target = buildChartUrl('query2', ticker);
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`;
  const o = await getJson(url);
  if (!o.contents) throw new Error('allorigins: empty contents');
  return JSON.parse(o.contents);
}

async function fetchViaCorsproxy(ticker) {
  const target = buildChartUrl('query1', ticker);
  const url = `https://corsproxy.io/?${encodeURIComponent(target)}`;
  return getJson(url, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
}

// ── Source 3 : yfapi.net — a public Yahoo-Finance wrapper API ───────────────
// Returns { price, currency } with no OHLC history, so avgHigh/Low = price.
async function fetchViaYfapi(ticker) {
  const url =
    `https://yfapi.net/v6/finance/quote?symbols=${encodeURIComponent(ticker)}`;
  const data = await getJson(url, {
    headers: { accept: 'application/json' }
  });
  const q = data?.quoteResponse?.result?.[0];
  if (!q) throw new Error(`yfapi: no result for ${ticker}`);
  const p = q.regularMarketPrice;
  if (p == null) throw new Error(`yfapi: no regularMarketPrice for ${ticker}`);
  return { synthetic: true, price: p, currency: q.currency || 'EUR' };
}

// ── Source 4 : 30-day price history fallback ─────────────────────────────────
// Fetches 30-day history directly and uses the last close price as final fallback
async function fetchVia30DayHistory(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=30d&includePrePost=false`;
  const data = await getJson(url);
  
  if (data?.chart?.error) {
    throw new Error(data.chart.error.description || 'Yahoo 30-day chart error');
  }
  
  const res = data?.chart?.result?.[0];
  if (!res) throw new Error(`no 30-day chart result for ${ticker}`);
  
  const q = res.indicators.quote[0];
  const close = q.close.filter(x => x != null);
  
  if (!close.length) throw new Error('no close prices in 30-day history');
  
  // Use the last close price
  const lastClose = close[close.length - 1];
  
  // For 30-day fallback, we can't provide reliable avgHigh/Low, so use the close price
  return { 
    synthetic: true, 
    price: lastClose, 
    avgHigh: lastClose, 
    avgLow: lastClose, 
    currency: res.meta.currency || 'EUR' 
  };
}

// ── Parse Yahoo v8/chart response ───────────────────────────────────────────
function parseChart(data, ticker) {
  if (data?.chart?.error)
    throw new Error(data.chart.error.description || 'Yahoo chart error');
  const res = data?.chart?.result?.[0];
  if (!res) throw new Error(`no chart result for ${ticker}`);
  const q   = res.indicators.quote[0];
  const cl  = q.close.filter(x => x != null);
  const hi  = q.high.filter(x => x != null);
  const lo  = q.low.filter(x => x != null);
  if (!cl.length) throw new Error('no close prices');
  const p  = cl[cl.length - 1];
  const h3 = hi.slice(-3);
  const l3 = lo.slice(-3);
  let aH   = h3.length ? h3.reduce((a, v) => a + v, 0) / h3.length : p;
  let aL   = l3.length ? l3.reduce((a, v) => a + v, 0) / l3.length : p;
  if (aL > p) aL = p;
  if (aH < p) aH = p;
  return { price: p, avgHigh: aH, avgLow: aL, currency: res.meta.currency || 'EUR' };
}

// ── Main Yahoo fetch: try sources sequentially, stop at first success ────────
export async function fetchYahooPrice(ticker) {
  // Check cache first
  const cached = getCachedPrice('yahoo', ticker);
  if (cached) {
    return cached;
  }

  const sources = [
    { name: 'allorigins+query2', fn: () => fetchViaAllorigins(ticker).then(d => parseChart(d, ticker)) },
    { name: 'yfapi',             fn: async () => {
        const d = await fetchViaYfapi(ticker);
        // yfapi has no OHLC — avgHigh/Low equal price (no limit-price suggestion)
        return { price: d.price, avgHigh: d.price, avgLow: d.price, currency: d.currency };
      }
    },
    { name: '30day-history',     fn: () => fetchVia30DayHistory(ticker) },
  ];

  const errors = [];
  for (const src of sources) {
    try {
      const result = await src.fn();
      setCachedPrice('yahoo', ticker, result);
      return result;
    } catch (e) {
      errors.push(`[${src.name}] ${e.message}`);
    }
  }
  throw new Error(errors.join(' · '));
}

// ── Binance — direct, no proxy needed ───────────────────────────────────────
export async function fetchBinancePrice(symbol) {
  // Check cache first
  const cached = getCachedPrice('binance', symbol);
  if (cached) {
    return cached;
  }

  let tr, kr;
  try {
    [tr, kr] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, { signal: sig() }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=7`, { signal: sig() }),
    ]);
  } catch (e) {
    throw new Error(`Binance network error (${symbol}): ${e.message}`);
  }
  if (!tr.ok) throw new Error(`Binance ticker HTTP ${tr.status} for ${symbol}`);
  if (!kr.ok) throw new Error(`Binance klines HTTP ${kr.status} for ${symbol}`);
  const tk = await tr.json();
  const kl = await kr.json();
  const p  = parseFloat(tk.price);
  if (isNaN(p)) throw new Error(`Binance non-numeric price for ${symbol}`);
  const l3 = kl.slice(-3);
  let aH = l3.length ? l3.reduce((a, k) => a + parseFloat(k[2]), 0) / l3.length : p;
  let aL = l3.length ? l3.reduce((a, k) => a + parseFloat(k[3]), 0) / l3.length : p;
  if (aL > p) aL = p;
  if (aH < p) aH = p;

  const result = { price: p, avgHigh: aH, avgLow: aL, currency: 'EUR' };
  setCachedPrice('binance', symbol, result);
  return result;
}

// ── fetchAllPrices — main entry point ───────────────────────────────────────
export async function fetchAllPrices(etfs) {
  if (!etfs || !etfs.length) {
    return { pricesById: {}, hiById: {}, loById: {}, currenciesById: {}, infoLines: [], failedFetches: [], hasErrors: false };
  }
  const pricesById     = {};
  const hiById         = {};
  const loById         = {};
  const currenciesById = {};
  const infoLines      = [];
  const failedFetches  = [];

  for (const e of etfs) {
    if (!e.ticker && e.rf) {
      pricesById[e.id]     = 1;
      hiById[e.id]         = 1;
      loById[e.id]         = 1;
      currenciesById[e.id] = 'EUR';
      infoLines.push(`${e.name}: cash (€1.00)`);
      continue;
    }
    try {
      const r = e.cr
        ? await fetchBinancePrice(e.ticker)
        : await fetchYahooPrice(e.ticker);
      pricesById[e.id]     = r.price;
      hiById[e.id]         = r.avgHigh;
      loById[e.id]         = r.avgLow;
      currenciesById[e.id] = r.currency;
      infoLines.push(
        `${e.name} (${e.ticker}): €${r.price.toFixed(2)} ${r.currency}` +
        ` · buy ≤€${r.avgLow.toFixed(2)} · sell ≥€${r.avgHigh.toFixed(2)}`
      );
    } catch (err) {
      failedFetches.push({ etf: e, error: err.message });
      // Don't throw error immediately, continue fetching others
    }
  }

  // If there are failed fetches, throw an error with details
  if (failedFetches.length > 0) {
    const errorDetails = failedFetches.map(f => 
      `${f.etf.name} (${f.etf.ticker}): ${f.error}`
    ).join('\n');
    
    // Still return partial results, but include failed fetches info
    return { 
      pricesById, 
      hiById, 
      loById, 
      currenciesById, 
      infoLines, 
      failedFetches,
      hasErrors: true,
      errorMessage: `Could not fetch prices for:\n${errorDetails}`
    };
  }

  return { pricesById, hiById, loById, currenciesById, infoLines, failedFetches: [], hasErrors: false };
}
