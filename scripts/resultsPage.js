import { byId, setHTML } from './dom.js';
import { getActivePortfolio, updateActivePortfolio } from './state.js';
import { validateAndParseNumber, showInputError, hideInputError } from './validation.js';

let chartInstance = null;

function f(n) {
  return n.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function renderComparisonOnly(portfolio, priceData) {
  const { etfs, manualPrices, h } = portfolio;
  const pr = priceData.pricesById;
  const cu = priceData.currenciesById;
  
  // Calculate current values
  const ist = etfs.map(e => (h[e.id] || 0) * (pr[e.id] || 0));
  const tot = ist.reduce((a, b) => a + b, 0);
  
  // Calculate target values (without investment)
  const sol = etfs.map(e => {
    const targetValue = tot * (e.tgt / 100);
    return targetValue;
  });
  const ft = sol.reduce((a, b) => a + b, 0);

  // Update metrics without investment info
  setHTML(
    'sm',
    `
    <div class="mc"><div class="ml">Current portfolio</div><div class="mv">€${f(
      tot
    )}</div><div class="ms">${etfs.filter(e => (h[e.id] || 0) > 0).length || etfs.length} positions</div></div>
    <div class="mc"><div class="ml">Target allocation</div><div class="mv">€${f(
      ft
    )}</div><div class="ms">based on current value</div></div>`
  );

  const ord = [...etfs.filter(e => !e.rf), ...etfs.filter(e => e.rf)];
  const rows = ord
    .map(e => {
      const i = etfs.indexOf(e);
      const cur = tot > 0 ? (ist[i] / tot) * 100 : 0;
      const tgt = sol[i] / ft * 100;
      const dr = cur - tgt;
      const db =
        Math.abs(dr) < 0.5
          ? `<span class="badge bx">${dr.toFixed(1)}%</span>`
          : dr > 0
          ? `<span class="badge ba">+${dr.toFixed(1)}%</span>`
          : `<span class="badge bb">${dr.toFixed(1)}%</span>`;
      const bc = dr > 2 ? '#EF9F27' : dr < -2 ? '#378ADD' : '#1D9E75';
      const bw = Math.min(100, (Math.abs(dr) / 20) * 100);
      const priceStr =
        e.rf && !e.ticker ? '—' : `${pr[e.id].toFixed(2)} ${cu[e.id] || ''}`;
      return `<tr><td style="font-weight:500">${e.name}</td><td class="hs"><span class="cat">${
        e.cat || ''
      }</span></td><td class="mono">${priceStr}</td><td>${cur.toFixed(
        1
      )}%</td><td>${tgt.toFixed(1)}%</td><td>${db}</td><td class="hs"><div class="bw"><div class="bf" style="width:${bw}%;background:${bc}"></div></div></td></tr>`;
    })
    .join('');
  setHTML('ab', rows);

  // Clear trades table and hide trades card
  setHTML('actb', '');
  const tradesCard = document.getElementById('trades-card');
  if (tradesCard) {
    tradesCard.style.display = 'none';
  }

  // Render chart with a small delay to ensure canvas is ready
  setTimeout(() => {
    renderChart(ord, etfs, ist, tot, sol, ft);
  }, 100);
}

function renderChart(ord, etfs, ist, tot, sol, ft) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  const ce = ord.filter((_, j) => {
    const i = etfs.indexOf(ord[j]);
    return ist[i] > 1 || sol[i] > 1;
  });
  const ctx = byId('ac');
  if (ctx && window.Chart) {
    chartInstance = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ce.map(e =>
          e.name
            .replace('iShares', 'iSh.')
            .replace('Xtrackers', 'Xtr.')
            .split(' ')
            .slice(0, 4)
            .join(' ')
        ),
        datasets: [
          {
            label: 'Current %',
            data: ce.map(e => {
              const i = etfs.indexOf(e);
              return tot > 0 ? +((ist[i] / tot * 100).toFixed(2)) : 0;
            }),
            backgroundColor: '#9FE1CB',
            borderRadius: 3
          },
          {
            label: 'Target %',
            data: ce.map(e => {
              const i = etfs.indexOf(e);
              return +((sol[i] / ft * 100).toFixed(2));
            }),
            backgroundColor: '#1D9E75',
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 40 } },
          y: {
            ticks: {
              callback: v => v + '%',
              font: { size: 11 }
            }
          }
        }
      }
    });
  }
}

export function renderResultsPage(data) {
  const { etfs, inv, rp, mode, ist, tot, ft, sol, r, pr, hi, lo, cu } = data;

  setHTML(
    'sm',
    `
    <div class="mc"><div class="ml">Current portfolio</div><div class="mv">€${f(
      tot
    )}</div><div class="ms">${etfs.filter(e => (data.state?.h?.[e.id] || 0) > 0).length || etfs.length} positions</div></div>
    <div class="mc"><div class="ml">After investment</div><div class="mv">€${f(
      tot + inv
    )}</div><div class="ms">+€${f(inv)}</div></div>
    <div class="mc"><div class="ml">Risky / risk-free</div><div class="mv" style="font-size:16px">${(
      rp * 100
    ).toFixed(0)}% / ${((1 - rp) * 100).toFixed(0)}%</div><div class="ms">target split</div></div>
    <div class="mc"><div class="ml">Mode</div><div class="mv" style="font-size:14px;padding-top:4px">${
      mode === 'onetime' ? 'One-time' : 'Savings'
    }</div><div class="ms">€${f(inv)}${mode === 'savings' ? '/mo' : ''}</div></div>`
  );

  const ord = [...etfs.filter(e => !e.rf), ...etfs.filter(e => e.rf)];
  const rows = ord
    .map(e => {
      const i = etfs.indexOf(e);
      const cur = tot > 0 ? (ist[i] / tot) * 100 : 0;
      const tgt = sol[i] / ft * 100;
      const dr = cur - tgt;
      const db =
        Math.abs(dr) < 0.5
          ? `<span class="badge bx">${dr.toFixed(1)}%</span>`
          : dr > 0
          ? `<span class="badge ba">+${dr.toFixed(1)}%</span>`
          : `<span class="badge bb">${dr.toFixed(1)}%</span>`;
      const bc = dr > 2 ? '#EF9F27' : dr < -2 ? '#378ADD' : '#1D9E75';
      const bw = Math.min(100, (Math.abs(dr) / 20) * 100);
      const priceStr =
        e.rf && !e.ticker ? '—' : `${pr[e.id].toFixed(2)} ${cu[e.id] || ''}`;
      return `<tr><td style="font-weight:500">${e.name}</td><td class="hs"><span class="cat">${
        e.cat || ''
      }</span></td><td class="mono">${priceStr}</td><td>${cur.toFixed(
        1
      )}%</td><td>${tgt.toFixed(1)}%</td><td>${db}</td><td class="hs"><div class="bw"><div class="bf" style="width:${bw}%;background:${bc}"></div></div></td></tr>`;
    })
    .join('');
  setHTML('ab', rows);

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  const ce = ord.filter((_, j) => {
    const i = etfs.indexOf(ord[j]);
    return ist[i] > 1 || sol[i] > 1;
  });
  const ctx = byId('ac');
  if (ctx && window.Chart) {
    chartInstance = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ce.map(e =>
          e.name
            .replace('iShares', 'iSh.')
            .replace('Xtrackers', 'Xtr.')
            .split(' ')
            .slice(0, 4)
            .join(' ')
        ),
        datasets: [
          {
            label: 'Current %',
            data: ce.map(e => {
              const i = etfs.indexOf(e);
              return tot > 0 ? +((ist[i] / tot * 100).toFixed(2)) : 0;
            }),
            backgroundColor: '#9FE1CB',
            borderRadius: 3
          },
          {
            label: 'Target %',
            data: ce.map(e => {
              const i = etfs.indexOf(e);
              return +((sol[i] / ft * 100).toFixed(2));
            }),
            backgroundColor: '#1D9E75',
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 40 } },
          y: {
            ticks: {
              callback: v => v + '%',
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  const att = byId('att');
  if (att) {
    att.textContent =
      mode === 'onetime'
        ? `Recommended trades — one-time €${f(inv)} investment`
        : `Recommended savings plan — €${f(inv)}/month`;
  }

  const tradeRows = ord
    .map(e => {
      const i = etfs.indexOf(e);
      const amt = r[i];
      if (Math.abs(amt) < 0.5) {
        return `<tr><td style="font-weight:500">${e.name}</td><td><span class="badge bx">Hold</span></td><td style="color:var(--text3)">—</td><td style="color:var(--text3)">—</td><td class="mono" style="color:var(--text2)">${
          e.rf && !e.ticker ? '—' : '€' + pr[e.id].toFixed(2)
        }</td></tr>`;
      }
      const buy = amt > 0;
      const units = Math.abs(amt) / pr[e.id];
      const lim = buy ? lo[e.id] : hi[e.id];
      return `<tr><td style="font-weight:500">${e.name}</td><td><span class="badge ${
        buy ? 'bg' : 'br'
      }">${buy ? 'Buy' : 'Sell'}</span></td><td style="font-weight:500">€${Math.abs(
        amt
      ).toFixed(2)}</td><td>~${units.toFixed(
        4
      )}</td><td class="mono">€${lim.toFixed(2)} (${buy ? 'max' : 'min'})</td></tr>`;
    })
    .join('');
  setHTML('actb', tradeRows);
}

export function initInvestmentSettings() {
  const to = byId('to');
  const ts = byId('ts');
  const ia = byId('ia');
  const allowBuy = byId('allow-buy');
  const allowSell = byId('allow-sell');
  const minBuy = byId('min-buy');
  const minSell = byId('min-sell');
  const onetimeOptions = byId('onetime-options');
  const tradingWarning = byId('trading-warning');

  to?.addEventListener('click', () => {
    updateActivePortfolio(prev => ({ ...prev, mode: 'onetime' }));
    setMode('onetime');
  });

  ts?.addEventListener('click', () => {
    updateActivePortfolio(prev => ({ ...prev, mode: 'savings' }));
    setMode('savings');
  });

  ia?.addEventListener('change', () => {
    // Validate the investment amount
    const validation = validateAndParseNumber(ia.value, { min: 0 });
    
    if (!validation.isValid) {
      showInputError(ia, validation.error, validation.suggestedValue);
      return;
    }
    
    hideInputError(ia);
    
    const v = parseFloat(ia.value) || 0;
    updateActivePortfolio(prev => ({ ...prev, inv: v }));
  });

  allowBuy?.addEventListener('change', () => {
    const checked = allowBuy.checked;
    updateActivePortfolio(prev => ({ ...prev, allowBuy: checked }));
    validateTradingOptions();
  });

  allowSell?.addEventListener('change', () => {
    const checked = allowSell.checked;
    updateActivePortfolio(prev => ({ ...prev, allowSell: checked }));
    validateTradingOptions();
  });

  minBuy?.addEventListener('change', () => {
    const validation = validateAndParseNumber(minBuy.value, { min: 0 });
    
    if (!validation.isValid) {
      showInputError(minBuy, validation.error, validation.suggestedValue);
      return;
    }
    
    hideInputError(minBuy);
    
    const v = parseFloat(minBuy.value) || 0;
    updateActivePortfolio(prev => ({ ...prev, minBuyAmount: v }));
  });

  minSell?.addEventListener('change', () => {
    const validation = validateAndParseNumber(minSell.value, { min: 0 });
    
    if (!validation.isValid) {
      showInputError(minSell, validation.error, validation.suggestedValue);
      return;
    }
    
    hideInputError(minSell);
    
    const v = parseFloat(minSell.value) || 0;
    updateActivePortfolio(prev => ({ ...prev, minSellAmount: v }));
  });

  function validateTradingOptions() {
    if (!allowBuy || !allowSell || !tradingWarning) return;
    
    const buyChecked = allowBuy.checked;
    const sellChecked = allowSell.checked;
    
    if (!buyChecked && !sellChecked) {
      tradingWarning.style.display = 'block';
    } else {
      tradingWarning.style.display = 'none';
    }
  }
}

function setMode(mode) {
  const to = byId('to');
  const ts = byId('ts');
  const onetimeOptions = byId('onetime-options');
  
  to?.classList.toggle('active', mode === 'onetime');
  ts?.classList.toggle('active', mode === 'savings');
  
  // Show/hide trading options based on mode
  if (onetimeOptions) {
    onetimeOptions.style.display = mode === 'onetime' ? 'block' : 'none';
  }
  
  const mh = byId('mh');
  if (mh) {
    mh.textContent = mode === 'onetime'
      ? 'invested as a one-time purchase'
      : 'per month (3× used for target calculation)';
  }
}

export function renderInvestmentSettings() {
  const state = getActivePortfolio();
  setMode(state.mode);
  
  const ia = byId('ia');
  if (ia) ia.value = state.inv;
  
  const allowBuy = byId('allow-buy');
  if (allowBuy) allowBuy.checked = state.allowBuy ?? true;
  
  const allowSell = byId('allow-sell');
  if (allowSell) allowSell.checked = state.allowSell ?? false;
  
  const minBuy = byId('min-buy');
  if (minBuy) minBuy.value = state.minBuyAmount ?? 250;
  
  const minSell = byId('min-sell');
  if (minSell) minSell.value = state.minSellAmount ?? 250;
  
  // Validate trading options after setting values
  const tradingWarning = byId('trading-warning');
  if (tradingWarning && allowBuy && allowSell) {
    const buyChecked = allowBuy.checked;
    const sellChecked = allowSell.checked;
    
    if (!buyChecked && !sellChecked) {
      tradingWarning.style.display = 'block';
    } else {
      tradingWarning.style.display = 'none';
    }
  }
}

