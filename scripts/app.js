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

async function onViewComparison() {
  const btn = byId('view-comparison');
  const sp = byId('fs');

  const currentPortfolio = getActivePortfolio();
  
  // Check if all required prices are available (manual or will be fetched)
  const etfsNeedingPrices = currentPortfolio.etfs.filter(e => !e.rf && e.ticker);
  const missingPrices = etfsNeedingPrices.filter(e => !currentPortfolio.manualPrices[e.id]);
  
  if (missingPrices.length > 0) {
    const proceed = confirm(
      `You are missing prices for: ${missingPrices.map(e => e.name).join(', ')}\n\n` +
      `Click OK to fetch these prices now, or Cancel to enter them manually first.`
    );
    
    if (!proceed) {
      // Highlight missing prices and return to holdings page
      const holdingsPage = document.getElementById('p2');
      if (holdingsPage && !holdingsPage.classList.contains('active')) {
        showPage(2);
        renderHoldingsPage();
      }
      
      // Highlight missing price fields
      setTimeout(() => {
        missingPrices.forEach(e => {
          const input = document.querySelector(`tr[data-id="${e.id}"] input[data-field="price"]`);
          if (input) {
            input.classList.add('highlighted');
          }
        });
      }, 100);
      
      alert('Please enter the missing prices manually (highlighted in amber) or use the "Fetch Prices" button.');
      return;
    }
  }

  if (btn) btn.disabled = true;
  if (sp) sp.style.display = 'inline-block';

  try {
    const portfolio = getActivePortfolio();
    
    // Start with manual prices
    let priceData = {
      pricesById: {},
      hiById: {},
      loById: {},
      currenciesById: {},
      infoLines: [],
      failedFetches: [],
      hasErrors: false
    };
    
    // Set manual prices and default values for cash
    portfolio.etfs.forEach(e => {
      if (!e.ticker && e.rf) {
        priceData.pricesById[e.id] = 1;
        priceData.hiById[e.id] = 1;
        priceData.loById[e.id] = 1;
        priceData.currenciesById[e.id] = 'EUR';
        priceData.infoLines.push(`${e.name}: cash (€1.00)`);
      } else if (portfolio.manualPrices[e.id]) {
        priceData.pricesById[e.id] = portfolio.manualPrices[e.id];
        priceData.hiById[e.id] = portfolio.manualPrices[e.id];
        priceData.loById[e.id] = portfolio.manualPrices[e.id];
        priceData.currenciesById[e.id] = 'EUR';
        priceData.infoLines.push(`${e.name} (${e.ticker}): €${portfolio.manualPrices[e.id].toFixed(2)} (manual)`);
      }
    });
    
    // Fetch missing prices
    const etfsToFetch = portfolio.etfs.filter(e => 
      e.ticker && !e.rf && !portfolio.manualPrices[e.id]
    );
    
    if (etfsToFetch.length > 0) {
      const fetchedData = await fetchAllPrices(etfsToFetch);
      
      // Merge fetched data with manual prices
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
    
    setHTML(
      'pi',
      priceData.infoLines.map(p => `<div>${p}</div>`).join('')
    );
    
    // Store price data for later use in optimization
    window.currentPriceData = priceData;
    
    // Show comparison without optimization
    showComparisonOnly(portfolio, priceData);
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
  
  const inv = ia ? parseFloat(ia.value) || 0 : currentPortfolio.inv;
  updateActivePortfolio(prev => ({ ...prev, inv }));

  if (btn) btn.disabled = true;
  if (sp) sp.style.display = 'inline-block';

  try {
    const portfolio = getActivePortfolio();
    
    // Use stored price data or fetch if not available
    let priceData = window.currentPriceData;
    if (!priceData) {
      // Fallback: fetch prices again
      priceData = await fetchAllPrices(portfolio.etfs);
      window.currentPriceData = priceData;
    }
    
    const result = optimizeAllocation(portfolio, priceData);
    renderResultsPage(result);
    
    // Show the trades card
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

