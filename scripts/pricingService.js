const PROXIES = [
  async (url) => {
    const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(18000)
    });
    if (!r.ok) throw new Error(`corsproxy.io HTTP ${r.status}`);
    return r.json();
  },
  async (url) => {
    const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(18000)
    });
    if (!r.ok) throw new Error(`allorigins HTTP ${r.status}`);
    const o = await r.json();
    return JSON.parse(o.contents);
  },
  async (url) => {
    const r = await fetch(`https://thingproxy.freeboard.io/fetch/${url}`, {
      signal: AbortSignal.timeout(18000)
    });
    if (!r.ok) throw new Error(`thingproxy HTTP ${r.status}`);
    return r.json();
  }
];

async function fetchYahooJSON(ticker) {
  const yUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=1d&range=14d`;

  let lastErr;
  for (const proxy of PROXIES) {
    try {
      const data = await proxy(yUrl);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`All proxies failed for ${ticker}. Last error: ${lastErr?.message || 'unknown'}`);
}

export async function fetchYahooPrice(ticker) {
  const d = await fetchYahooJSON(ticker);
  if (d.chart.error) throw new Error(d.chart.error.description || 'Yahoo error');
  const res = d.chart.result[0];
  const q = res.indicators.quote[0];
  const cl = q.close.filter(x => x != null);
  const hi = q.high.filter(x => x != null);
  const lo = q.low.filter(x => x != null);
  if (!cl.length) throw new Error('No price data');
  const p = cl[cl.length - 1];
  const h3 = hi.slice(-3);
  const l3 = lo.slice(-3);
  let aH = h3.reduce((a, v) => a + v, 0) / h3.length;
  let aL = l3.reduce((a, v) => a + v, 0) / l3.length;
  if (aL > p) aL = p;
  if (aH < p) aH = p;
  return { price: p, avgHigh: aH, avgLow: aL, currency: res.meta.currency || 'EUR' };
}

export async function fetchBinancePrice(symbol) {
  const [tr, kr] = await Promise.all([
    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
      signal: AbortSignal.timeout(10000)
    }),
    fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=7`, {
      signal: AbortSignal.timeout(10000)
    })
  ]);
  if (!tr.ok || !kr.ok) throw new Error('Binance error');
  const tk = await tr.json();
  const kl = await kr.json();
  const p = parseFloat(tk.price);
  const l3 = kl.slice(-3);
  let aH = l3.reduce((a, k) => a + parseFloat(k[2]), 0) / l3.length;
  let aL = l3.reduce((a, k) => a + parseFloat(k[3]), 0) / l3.length;
  if (aL > p) aL = p;
  if (aH < p) aH = p;
  return { price: p, avgHigh: aH, avgLow: aL, currency: 'EUR' };
}

export async function fetchAllPrices(etfs) {
  const pricesById = {};
  const hiById = {};
  const loById = {};
  const currenciesById = {};
  const infoLines = [];

  for (const e of etfs) {
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
        `${e.name} (${e.ticker}): €${r.price.toFixed(2)} ${r.currency} · buy ≤€${r.avgLow.toFixed(
          2
        )} · sell ≥€${r.avgHigh.toFixed(2)}`
      );
    } catch (err) {
      throw new Error(
        `Could not fetch price for "${e.name}" (${e.ticker}).\n\nETFs: use Yahoo Finance ticker (e.g. XZW0.DE, EMIM.AS)\nCrypto: use Binance EUR pair (e.g. BTCEUR, ETHEUR)\n\nError: ${err.message}`
      );
    }
  }

  return { pricesById, hiById, loById, currenciesById, infoLines };
}

