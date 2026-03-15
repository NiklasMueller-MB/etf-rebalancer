// ---------------------------------------------------------------------------
// pricingService.js
//
// Strategy — three independent data sources tried in order per ticker:
//
//  1. Yahoo Finance v8 chart via query2 subdomain (different rate-limit pool)
//     wrapped in allorigins (still works for query2, blocked less than query1).
//  2. Yahoo Finance v8 chart via query1 subdomain wrapped in corsproxy.io.
//  3. Open-source yahoo-finance2-compatible REST mirror at
//     https://yfapi.net  (free tier, no key needed for basic quotes).
//
// Crypto (Binance) is direct — Binance has open CORS headers.
// ---------------------------------------------------------------------------

const T = 20_000; // global timeout ms

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
  const sources = [
    { name: 'allorigins+query2', fn: () => fetchViaAllorigins(ticker).then(d => parseChart(d, ticker)) },
    { name: 'corsproxy+query1',  fn: () => fetchViaCorsproxy(ticker).then(d => parseChart(d, ticker)) },
    { name: 'yfapi',             fn: async () => {
        const d = await fetchViaYfapi(ticker);
        // yfapi has no OHLC — avgHigh/Low equal price (no limit-price suggestion)
        return { price: d.price, avgHigh: d.price, avgLow: d.price, currency: d.currency };
      }
    },
  ];

  const errors = [];
  for (const src of sources) {
    try {
      return await src.fn();
    } catch (e) {
      errors.push(`[${src.name}] ${e.message}`);
    }
  }
  throw new Error(errors.join(' · '));
}

// ── Binance — direct, no proxy needed ───────────────────────────────────────
export async function fetchBinancePrice(symbol) {
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
  let aH = l3.reduce((a, k) => a + parseFloat(k[2]), 0) / l3.length;
  let aL = l3.reduce((a, k) => a + parseFloat(k[3]), 0) / l3.length;
  if (aL > p) aL = p;
  if (aH < p) aH = p;
  return { price: p, avgHigh: aH, avgLow: aL, currency: 'EUR' };
}

// ── fetchAllPrices — main entry point ───────────────────────────────────────
export async function fetchAllPrices(etfs) {
  const pricesById     = {};
  const hiById         = {};
  const loById         = {};
  const currenciesById = {};
  const infoLines      = [];

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
