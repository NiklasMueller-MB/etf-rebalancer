import { getState, setState } from './state.js';
import { byId } from './dom.js';

export function exportPortfolioData() {
  const state = getState();
  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    portfolios: state.portfolios.map(portfolio => ({
      id: portfolio.id,
      name: portfolio.name,
      riskPercentage: portfolio.rp,
      defaultInvestment: portfolio.di,
      mode: portfolio.mode,
      etfs: portfolio.etfs.map(etf => ({
        id: etf.id,
        isin: etf.isin,
        ticker: etf.ticker,
        name: etf.name,
        category: etf.cat,
        targetPercentage: etf.tgt,
        isCrypto: etf.cr,
        isRiskFree: etf.rf
      })),
      holdings: portfolio.h || {}
    })),
    activePortfolioId: state.activePortfolioId
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `portfolio-settings-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importPortfolioData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        
        // Validate import data structure
        if (!importData.portfolios || !Array.isArray(importData.portfolios)) {
          throw new Error('Invalid file format: missing portfolios array');
        }

        // Convert import data back to app state format
        const newState = {
          portfolios: importData.portfolios.map(portfolio => ({
            id: portfolio.id,
            name: portfolio.name,
            rp: portfolio.riskPercentage || 100,
            di: portfolio.defaultInvestment || 500,
            nid: 20,
            mode: portfolio.mode || 'onetime',
            inv: portfolio.defaultInvestment || 500,
            etfs: portfolio.etfs.map(etf => ({
              id: etf.id,
              isin: etf.isin,
              ticker: etf.ticker,
              name: etf.name,
              rf: etf.isRiskFree || false,
              cr: etf.isCrypto || false,
              cat: etf.category,
              tgt: etf.targetPercentage
            })),
            h: portfolio.holdings || {}
          })),
          activePortfolioId: importData.activePortfolioId || importData.portfolios[0]?.id || 'p1'
        };

        setState(newState);
        resolve(importData);
      } catch (error) {
        reject(new Error(`Failed to import portfolio data: ${error.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function initImportExport() {
  const exportBtn = byId('export-portfolio');
  const importBtn = byId('import-portfolio');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      try {
        exportPortfolioData();
      } catch (error) {
        alert('Export failed: ' + error.message);
      }
    });
  }

  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          await importPortfolioData(file);
          alert('Portfolio settings imported successfully!');
          // Reload the page to refresh the UI
          window.location.reload();
        } catch (error) {
          alert('Import failed: ' + error.message);
        }
      };
      input.click();
    });
  }
}
