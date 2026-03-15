/**
 * prices.js
 * Fetches live prices from Yahoo Finance (via allorigins proxy) and Binance.
 *
 * Exported helpers:
 *   fetchYahooPrice(ticker)  → PriceResult
 *   fetchBinancePrice(symbol) → PriceResult
 *   fetchAllPrices(etfs)     → { prices, highs, lows, currencies, infoLines }
 *
 * PriceResult: { p: number, aH: number, aL: number, cur: string }
 *   p   = latest close price
 *   aH  = average of last-3-day highs  (sell limit reference)
 *   aL  = average of last-3-day lows   (buy  limit reference)
 *   cur = currency string, e.g. 'EUR'
 */

const YAHOO_PROXY = 'https://api.allorigins.win/get?url=';
const YAHOO_BASE  = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const BINANCE_BASE = 'https://api.binance.com/api/v3/';
const TIMEOUT_MS  = 15_000;

/** Average an array of numbers, ignoring nulls. */
function avg(arr) {
  const valid = arr.filter(x => x != null);
  return valid.length ? valid.reduce((a, v) => a + v, 0) / valid.length : 0;
}

/** Clamp limit prices so they never cross the spot price. */
function clampLimits(p, rawHigh, rawLow) {
  return {
    aH: rawHigh < p ? p : rawHigh,
    aL: rawLow  > p ? p : rawLow,
  };
}

/**
 * Fetch price data for a single ETF ticker from Yahoo Finance.
 * Uses allorigins.win as a CORS proxy.
 */
async function fetchYahooPrice(ticker) {
  const url = `${YAHOO_BASE}${encodeURIComponent(ticker)}?interval=1d&range=14d`;
  const proxyUrl = `${YAHOO_PROXY}${encodeURIComponent(url)}`;

  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const wrapper = await res.json();
  const data = JSON.parse(wrapper.contents);

  if (data.chart.error) {
    throw new Error(data.chart.error.description || 'Yahoo Finance error');
  }

  const result = data.chart.result[0];
  const quote  = result.indicators.quote[0];

  const closes = quote.close.filter(x => x != null);
  const highs  = quote.high.filter(x  => x != null);
  const lows   = quote.low.filter(x   => x != null);

  if (!closes.length) throw new Error('No price data returned');

  const p = closes[closes.length - 1];
  const rawHigh = avg(highs.slice(-3));
  const rawLow  = avg(lows.slice(-3));
  const { aH, aL } = clampLimits(p, rawHigh, rawLow);

  return { p, aH, aL, cur: result.meta.currency || 'EUR' };
}

/**
 * Fetch price data for a crypto symbol from Binance.
 * symbol should be a EUR pair, e.g. 'BTCEUR'.
 */
async function fetchBinancePrice(symbol) {
  const tickerUrl = `${BINANCE_BASE}ticker/price?symbol=${symbol}`;
  const klinesUrl = `${BINANCE_BASE}klines?symbol=${symbol}&interval=1d&limit=7`;

  const [tickerRes, klinesRes] = await Promise.all([
    fetch(tickerUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
    fetch(klinesUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
  ]);
  if (!tickerRes.ok || !klinesRes.ok) throw new Error('Binance API error');

  const tickerData = await tickerRes.json();
  const klines     = await klinesRes.json();

  const p = parseFloat(tickerData.price);
  const last3 = klines.slice(-3);
  const rawHigh = last3.reduce((a, k) => a + parseFloat(k[2]), 0) / last3.length;
  const rawLow  = last3.reduce((a, k) => a + parseFloat(k[3]), 0) / last3.length;
  const { aH, aL } = clampLimits(p, rawHigh, rawLow);

  return { p, aH, aL, cur: 'EUR' };
}

/**
 * Fetch prices for every ETF in the list.
 * Cash entries (rf=true, ticker='') are handled synthetically (price = 1).
 *
 * @param {Array} etfs - array of ETF objects from State
 * @returns {Promise<{
 *   prices:     { [id]: number },
 *   highs:      { [id]: number },
 *   lows:       { [id]: number },
 *   currencies: { [id]: string },
 *   infoLines:  string[]
 * }>}
 * @throws Error with a user-friendly message on failure, including which asset failed.
 */
async function fetchAllPrices(etfs) {
  const prices     = {};
  const highs      = {};
  const lows       = {};
  const currencies = {};
  const infoLines  = [];

  for (const etf of etfs) {
    // Cash / Tagesgeld — no ticker needed
    if (!etf.ticker && etf.rf) {
      prices[etf.id]     = 1;
      highs[etf.id]      = 1;
      lows[etf.id]       = 1;
      currencies[etf.id] = 'EUR';
      infoLines.push(`${etf.name}: cash (€1.00)`);
      continue;
    }

    try {
      const result = etf.cr
        ? await fetchBinancePrice(etf.ticker)
        : await fetchYahooPrice(etf.ticker);

      prices[etf.id]     = result.p;
      highs[etf.id]      = result.aH;
      lows[etf.id]       = result.aL;
      currencies[etf.id] = result.cur;
      infoLines.push(
        `${etf.name} (${etf.ticker}): €${result.p.toFixed(2)} ${result.cur}` +
        ` · buy ≤€${result.aL.toFixed(2)} · sell ≥€${result.aH.toFixed(2)}`
      );
    } catch (err) {
      const source = etf.cr ? 'Binance (EUR pair, e.g. BTCEUR)' : 'Yahoo Finance (e.g. XZW0.DE)';
      throw new Error(
        `Could not fetch price for "${etf.name}" (${etf.ticker}).\n\nExpected source: ${source}\n\nDetail: ${err.message}`
      );
    }
  }

  return { prices, highs, lows, currencies, infoLines };
}
