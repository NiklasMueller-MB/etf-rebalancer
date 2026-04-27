import { getActivePortfolio, updateActivePortfolio } from './state.js';
import { byId, setHTML, showPage } from './dom.js';
import { initSetupPage, renderSetupPage, validateSetup } from './setupPage.js';
import { initHoldingsPage, renderHoldingsPage } from './holdingsPage.js';
import { fetchAllPrices } from './pricingService.js';
import { optimizeAllocation } from './optimizer.js';
import { renderResultsPage, renderComparisonOnly, initInvestmentSettings, renderInvestmentSettings } from './resultsPage.js';
import { initPortfolioBar, renderPortfolioBar } from './portfolioBar.js';
import { initImportExport } from './importExport.js';
import { validateAndParseNumber } from './validation.js';

function goToSetup() {
  showPage(1);
  renderSetupPage();
}

function goToHoldings() {
  if (!validateSetup()) return;
  showPage(2);
  renderHoldingsPage();
}

async function goToResults() {
  // Check if we have valid data to show results
  const state = getActivePortfolio();
  if (!state.h || Object.keys(state.h).length === 0) {
    alert('Please enter your holdings first before viewing results.');
    return;
  }
  
  // Trigger the comparison view when entering step 3
  await onViewComparison();
}

function goBackToSetup() {
  showPage(1);
  renderSetupPage();
}

function goBackToHoldings() {
  showPage(2);
  renderHoldingsPage();
}

async function buildPriceData(portfolio) {
  const priceData = {
    pricesById: {},
    hiById: {},
    loById: {},
    currenciesById: {},
    infoLines: [],
    failedFetches: [],
    hasErrors: false
  };

  portfolio.etfs.forEach(e => {
    if (!e.ticker && e.rf) {
      priceData.pricesById[e.id] = 1;
      priceData.hiById[e.id] = 1;
      priceData.loById[e.id] = 1;
      priceData.currenciesById[e.id] = 'EUR';
      priceData.infoLines.push(`${e.name}: cash (€1.00)`);
    } else if (portfolio.manualPrices[e.id] !== undefined) {
      const price = portfolio.manualPrices[e.id] || 0;
      priceData.pricesById[e.id] = price;
      priceData.hiById[e.id] = price;
      priceData.loById[e.id] = price;
      priceData.currenciesById[e.id] = 'EUR';
      if (price > 0) {
        priceData.infoLines.push(`${e.name} (${e.ticker}): €${price.toFixed(2)} (manual)`);
      } else {
        priceData.infoLines.push(`${e.name} (${e.ticker}): no price (no holdings)`);
      }
    }
  });

  const etfsWithHoldings = portfolio.etfs.filter(e =>
    e.ticker && !e.rf && !portfolio.manualPrices[e.id] && (portfolio.h[e.id] || 0) > 0
  );

  if (etfsWithHoldings.length > 0) {
    const fetchedData = await fetchAllPrices(etfsWithHoldings);
    Object.assign(priceData.pricesById, fetchedData.pricesById);
    Object.assign(priceData.hiById, fetchedData.hiById);
    Object.assign(priceData.loById, fetchedData.loById);
    Object.assign(priceData.currenciesById, fetchedData.currenciesById);
    priceData.infoLines.push(...fetchedData.infoLines);
    if (fetchedData.hasErrors) {
      priceData.failedFetches.push(...fetchedData.failedFetches);
      priceData.hasErrors = true;
    }
  }

  portfolio.etfs.forEach(e => {
    if (e.ticker && !e.rf && priceData.pricesById[e.id] === undefined) {
      priceData.pricesById[e.id] = 0;
      priceData.hiById[e.id] = 0;
      priceData.loById[e.id] = 0;
      priceData.currenciesById[e.id] = 'EUR';
      priceData.infoLines.push(`${e.name} (${e.ticker}): no price (no holdings)`);
    }
  });

  return priceData;
}

async function onViewComparison() {
  const btn = byId('view-comparison');
  const sp = byId('fs');

  if (btn) btn.disabled = true;
  if (sp) sp.style.display = 'inline-block';

  try {
    const portfolio = getActivePortfolio();
    const priceData = await buildPriceData(portfolio);

    if (priceData.hasErrors && priceData.failedFetches.length > 0) {
      const failedNames = priceData.failedFetches.map(f => f.etf.name).join(', ');
      alert(`Could not fetch prices for: ${failedNames}\n\nShowing cached or manual prices where available.`);
    }

    setHTML(
      'pi',
      priceData.infoLines.map(p => `<div>${p}</div>`).join('')
    );

    renderComparisonOnly(portfolio, priceData);
    renderInvestmentSettings();
    showPage(3);
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (sp) sp.style.display = 'none';
  }
}

async function onOptimize() {
  const btn = byId('optimize-btn');
  const sp = byId('os');
  const ia = byId('ia');

  const currentPortfolio = getActivePortfolio();
  
  // Validate investment amount format
  if (ia) {
    const validation = validateAndParseNumber(ia.value, { min: 0 });
    if (!validation.isValid) {
      alert('Please correct the investment amount: ' + validation.error);
      ia.focus();
      return;
    }
  }
  
  // Validate trading options for one-time investment
  if (currentPortfolio.mode === 'onetime') {
    const allowBuy = currentPortfolio.allowBuy ?? true;
    const allowSell = currentPortfolio.allowSell ?? false;
    
    if (!allowBuy && !allowSell) {
      alert('Please select at least one trading option (buy or sell) for one-time investment.');
      return;
    }
  }
  
  const inv = ia ? parseFloat(ia.value) || 0 : currentPortfolio.inv;
  updateActivePortfolio(prev => ({ ...prev, inv }));

  if (btn) btn.disabled = true;
  if (sp) sp.style.display = 'inline-block';

  try {
    const portfolio = getActivePortfolio();
    const priceData = await buildPriceData(portfolio);
    const result = optimizeAllocation(portfolio, priceData);
    renderResultsPage(result);
    
    // Show trades card
    const tradesCard = document.getElementById('trades-card');
    if (tradesCard) {
      tradesCard.style.display = 'block';
    }
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (sp) sp.style.display = 'none';
  }
}

function initNav() {
  const next = byId('next-to-holdings');
  const backToSetup = byId('back-to-setup');
  const backToHoldings = byId('back-to-holdings');
  const viewComparisonBtn = byId('view-comparison');
  const optimizeBtn = byId('optimize-btn');

  // Step navigation
  const step1 = byId('s1');
  const step2 = byId('s2');
  const step3 = byId('s3');

  next?.addEventListener('click', goToHoldings);
  backToSetup?.addEventListener('click', goBackToSetup);
  backToHoldings?.addEventListener('click', goBackToHoldings);
  viewComparisonBtn?.addEventListener('click', onViewComparison);
  optimizeBtn?.addEventListener('click', onOptimize);

  // Step indicator navigation
  step1?.addEventListener('click', goToSetup);
  step2?.addEventListener('click', goToHoldings);
  step3?.addEventListener('click', goToResults);
}

function init() {
  initSetupPage();
  initHoldingsPage();
  initPortfolioBar();
  initImportExport();
  initNav();
  initInvestmentSettings();
  renderPortfolioBar();
  goToSetup();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

