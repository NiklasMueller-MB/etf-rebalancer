import { getActivePortfolio, updateActivePortfolio } from './state.js';
import { byId, setHTML, showPage } from './dom.js';
import { initSetupPage, renderSetupPage, validateSetup } from './setupPage.js';
import { initHoldingsPage, renderHoldingsPage } from './holdingsPage.js';
import { fetchAllPrices } from './pricingService.js';
import { optimizeAllocation } from './optimizer.js';
import { renderResultsPage } from './resultsPage.js';
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

function goBackToSetup() {
  showPage(1);
  renderSetupPage();
}

function goBackToHoldings() {
  showPage(2);
  renderHoldingsPage();
}

async function onFetchAndCalculate() {
  const btn = byId('fb');
  const sp = byId('fs');
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
    const priceData = await fetchAllPrices(portfolio.etfs);
    setHTML(
      'pi',
      priceData.infoLines.map(p => `<div>${p}</div>`).join('')
    );
    const result = optimizeAllocation(portfolio, priceData);
    showPage(3);
    renderResultsPage(result);
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
  const fetchBtn = byId('fb');

  next?.addEventListener('click', goToHoldings);
  backToSetup?.addEventListener('click', goBackToSetup);
  backToHoldings?.addEventListener('click', goBackToHoldings);
  fetchBtn?.addEventListener('click', onFetchAndCalculate);
}

function init() {
  initSetupPage();
  initHoldingsPage();
  initPortfolioBar();
  initImportExport();
  initNav();
  renderPortfolioBar();
  goToSetup();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

