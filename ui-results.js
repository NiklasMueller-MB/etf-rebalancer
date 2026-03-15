/**
 * ui-results.js
 * Renders Page 3 (Results: allocation table, chart, trade recommendations).
 *
 * Depends on:
 *   state.js     (State)
 *   optimizer.js (optimizeAllocation, computeTargets)
 *   Chart.js     (global `Chart`)
 */

/** Keep a reference to the current Chart instance so we can destroy it on re-render. */
let allocationChart = null;

/**
 * Format a number as German locale euros (two decimal places).
 * @param {number} n
 * @returns {string}
 */
function fmtEur(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Render the summary metric cards at the top of the results page.
 */
function renderMetrics(currentTotal, investmentAmount, riskyFraction, mode) {
  document.getElementById('sm').innerHTML = `
    <div class="mc">
      <div class="ml">Current portfolio</div>
      <div class="mv">€${fmtEur(currentTotal)}</div>
      <div class="ms">${State.etfs.filter(e => (State.h[e.id] || 0) > 0).length} positions</div>
    </div>
    <div class="mc">
      <div class="ml">After investment</div>
      <div class="mv">€${fmtEur(currentTotal + investmentAmount)}</div>
      <div class="ms">+€${fmtEur(investmentAmount)}</div>
    </div>
    <div class="mc">
      <div class="ml">Risky / risk-free</div>
      <div class="mv" style="font-size:16px">
        ${(riskyFraction * 100).toFixed(0)}% / ${((1 - riskyFraction) * 100).toFixed(0)}%
      </div>
      <div class="ms">target split</div>
    </div>
    <div class="mc">
      <div class="ml">Mode</div>
      <div class="mv" style="font-size:14px;padding-top:4px">
        ${mode === 'onetime' ? 'One-time' : 'Savings'}
      </div>
      <div class="ms">€${fmtEur(investmentAmount)}${mode === 'savings' ? '/mo' : ''}</div>
    </div>`;
}

/**
 * Render the allocation comparison table (current % vs target %).
 */
function renderAllocationTable(orderedEtfs, currentValues, targetValues, prices, currencies, currentTotal, futureTotal) {
  const etfs = State.etfs;

  document.getElementById('ab').innerHTML = orderedEtfs.map(etf => {
    const i   = etfs.indexOf(etf);
    const cur = currentTotal > 0 ? (currentValues[i] / currentTotal) * 100 : 0;
    const tgt = (targetValues[i] / futureTotal) * 100;
    const dr  = cur - tgt;

    const driftBadge =
      Math.abs(dr) < 0.5 ? `<span class="badge bx">${dr.toFixed(1)}%</span>` :
      dr > 0              ? `<span class="badge ba">+${dr.toFixed(1)}%</span>` :
                            `<span class="badge bb">${dr.toFixed(1)}%</span>`;

    const barColor = dr > 2 ? '#EF9F27' : dr < -2 ? '#378ADD' : '#1D9E75';
    const barWidth = Math.min(100, Math.abs(dr) / 20 * 100);

    const priceStr = (etf.rf && !etf.ticker)
      ? '—'
      : `${prices[etf.id].toFixed(2)} ${currencies[etf.id] || ''}`;

    return `
      <tr>
        <td style="font-weight:500">${etf.name}</td>
        <td class="hs"><span class="cat">${etf.cat || ''}</span></td>
        <td class="mono">${priceStr}</td>
        <td>${cur.toFixed(1)}%</td>
        <td>${tgt.toFixed(1)}%</td>
        <td>${driftBadge}</td>
        <td class="hs">
          <div class="bw"><div class="bf" style="width:${barWidth}%;background:${barColor}"></div></div>
        </td>
      </tr>`;
  }).join('');
}

/**
 * (Re-)render the Chart.js bar chart.
 */
function renderAllocationChart(orderedEtfs, currentValues, targetValues, currentTotal, futureTotal) {
  const etfs = State.etfs;

  // Only include assets that have meaningful value
  const visible = orderedEtfs.filter(etf => {
    const i = etfs.indexOf(etf);
    return currentValues[i] > 1 || targetValues[i] > 1;
  });

  if (allocationChart) {
    allocationChart.destroy();
    allocationChart = null;
  }

  allocationChart = new Chart(document.getElementById('ac'), {
    type: 'bar',
    data: {
      labels: visible.map(etf =>
        etf.name
          .replace('iShares',    'iSh.')
          .replace('Xtrackers', 'Xtr.')
          .split(' ')
          .slice(0, 4)
          .join(' ')
      ),
      datasets: [
        {
          label: 'Current %',
          data: visible.map(etf => {
            const i = etfs.indexOf(etf);
            return currentTotal > 0 ? +((currentValues[i] / currentTotal * 100).toFixed(2)) : 0;
          }),
          backgroundColor: '#9FE1CB',
          borderRadius: 3,
        },
        {
          label: 'Target %',
          data: visible.map(etf => {
            const i = etfs.indexOf(etf);
            return +((targetValues[i] / futureTotal * 100).toFixed(2));
          }),
          backgroundColor: '#1D9E75',
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 40 } },
        y: { ticks: { callback: v => v + '%', font: { size: 11 } } },
      },
    },
  });
}

/**
 * Render the recommended trades table.
 */
function renderTradesTable(orderedEtfs, allocation, prices, lows, highs, mode, investmentAmount) {
  document.getElementById('att').textContent =
    mode === 'onetime'
      ? `Recommended trades — one-time €${fmtEur(investmentAmount)} investment`
      : `Recommended savings plan — €${fmtEur(investmentAmount)}/month`;

  document.getElementById('actb').innerHTML = orderedEtfs.map(etf => {
    const i   = State.etfs.indexOf(etf);
    const amt = allocation[i];

    if (Math.abs(amt) < 0.5) {
      return `
        <tr>
          <td style="font-weight:500">${etf.name}</td>
          <td><span class="badge bx">Hold</span></td>
          <td style="color:var(--text3)">—</td>
          <td style="color:var(--text3)">—</td>
          <td class="mono" style="color:var(--text2)">
            ${(etf.rf && !etf.ticker) ? '—' : '€' + prices[etf.id].toFixed(2)}
          </td>
        </tr>`;
    }

    const isBuy  = amt > 0;
    const units  = Math.abs(amt) / prices[etf.id];
    const limit  = isBuy ? lows[etf.id] : highs[etf.id];
    const label  = isBuy ? 'max' : 'min';

    return `
      <tr>
        <td style="font-weight:500">${etf.name}</td>
        <td><span class="badge ${isBuy ? 'bg' : 'br'}">${isBuy ? 'Buy' : 'Sell'}</span></td>
        <td style="font-weight:500">€${Math.abs(amt).toFixed(2)}</td>
        <td>~${units.toFixed(4)}</td>
        <td class="mono">€${limit.toFixed(2)} (${label})</td>
      </tr>`;
  }).join('');
}

/**
 * Render the raw price fetch info log.
 */
function renderPriceInfo(infoLines) {
  document.getElementById('pi').innerHTML =
    infoLines.map(line => `<div>${line}</div>`).join('');
}

/**
 * Main entry point: compute allocations and render all result sections.
 *
 * @param {object} priceData - result from fetchAllPrices()
 */
function renderResults(priceData) {
  const { prices, highs, lows, currencies, infoLines } = priceData;
  const { etfs, inv, rp, mode, h } = State;

  // Current € values per position
  const currentValues = etfs.map(e => (h[e.id] || 0) * prices[e.id]);
  const currentTotal  = currentValues.reduce((a, v) => a + v, 0);

  // Future total depends on mode (savings uses 3× monthly for target calc)
  const futureTotal = mode === 'onetime' ? currentTotal + inv : currentTotal + 3 * inv;

  // Does the user hold any crypto? (affects target calc via fee haircut)
  const hasCrypto = etfs.some(e => e.cr && (h[e.id] || 0) > 0);

  // Compute per-asset € targets
  const targetValues = computeTargets(etfs, futureTotal, rp, hasCrypto);

  // Solve for optimal allocation of the investment amount
  const allocation = optimizeAllocation(
    currentValues,
    targetValues,
    inv,
    etfs.map(() => 0),
    etfs.map(() => inv)
  );

  // Display order: risky first, then risk-free
  const ordered = [...etfs.filter(e => !e.rf), ...etfs.filter(e => e.rf)];

  renderMetrics(currentTotal, inv, rp, mode);
  renderAllocationTable(ordered, currentValues, targetValues, prices, currencies, currentTotal, futureTotal);
  renderAllocationChart(ordered, currentValues, targetValues, currentTotal, futureTotal);
  renderTradesTable(ordered, allocation, prices, lows, highs, mode, inv);
  renderPriceInfo(infoLines);
}
