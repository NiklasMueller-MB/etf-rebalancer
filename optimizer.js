/**
 * optimizer.js
 * Greedy coordinate-descent allocation optimizer.
 *
 * Given a total investment amount and per-asset bounds, finds a distribution
 * that sums exactly to `totalInvestment` while respecting [lb_i, ub_i] for
 * each asset. Iterates until the residual is negligible.
 *
 * Exported function:
 *   optimizeAllocation(currentValues, targetValues, totalInvestment, lowerBounds, upperBounds)
 *   → number[]  (allocation per asset in €)
 */

/**
 * Coordinate-descent optimizer.
 *
 * @param {number[]} currentValues   - current € value of each position
 * @param {number[]} targetValues    - desired € value of each position (after investment)
 * @param {number}   totalInvestment - total € to allocate (must be ≥ 0)
 * @param {number[]} lowerBounds     - minimum allocation per asset (usually 0)
 * @param {number[]} upperBounds     - maximum allocation per asset (usually totalInvestment)
 * @returns {number[]}               - € to buy (positive) or sell (negative) per asset
 */
function optimizeAllocation(currentValues, targetValues, totalInvestment, lowerBounds, upperBounds) {
  const n = currentValues.length;

  // Initialise: spread investment equally, then clamp
  let allocation = new Array(n).fill(totalInvestment / n);
  for (let i = 0; i < n; i++) {
    allocation[i] = Math.max(lowerBounds[i], Math.min(upperBounds[i], allocation[i]));
  }

  // Coordinate descent: 10 000 iterations is sufficient for ~20 assets
  const MAX_ITER = 10_000;
  const EPSILON  = 0.01; // €0.01 tolerance

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Fix each variable in turn
    for (let i = 0; i < n; i++) {
      const sumOthers = allocation.reduce((s, v, j) => j === i ? s : s + v, 0);
      allocation[i] = Math.max(lowerBounds[i], Math.min(upperBounds[i], totalInvestment - sumOthers));
    }

    // Re-distribute any residual caused by clamping
    const sum      = allocation.reduce((a, v) => a + v, 0);
    const residual = totalInvestment - sum;

    if (Math.abs(residual) > EPSILON) {
      // Identify assets that still have room to absorb the residual
      const eligible = allocation.map((v, i) =>
        residual > 0 ? v < upperBounds[i] : v > lowerBounds[i]
      );
      const count = eligible.filter(Boolean).length || 1;

      for (let i = 0; i < n; i++) {
        if (eligible[i]) {
          allocation[i] = Math.max(
            lowerBounds[i],
            Math.min(upperBounds[i], allocation[i] + residual / count)
          );
        }
      }
    }
  }

  return allocation;
}

/**
 * Compute per-asset target € values given the portfolio setup.
 *
 * @param {Array}  etfs          - ETF objects from State
 * @param {number} futureTotal   - projected portfolio value after investment
 * @param {number} riskyFraction - fraction (0–1) allocated to risky assets
 * @param {boolean} hasCrypto    - whether any crypto is held (applies a fee haircut)
 * @returns {number[]}           - target € per asset (parallel to etfs array)
 */
function computeTargets(etfs, futureTotal, riskyFraction, hasCrypto) {
  // Rough crypto trading-fee haircut (~5%)
  const cryptoScale = hasCrypto ? 1 / 1.05 : 1;

  return etfs.map(etf => {
    if (etf.rf) {
      // Risk-free bucket
      return (etf.tgt / 100) * (1 - riskyFraction) * futureTotal;
    } else {
      // Risky bucket
      return (etf.tgt / 100) * riskyFraction * cryptoScale * futureTotal;
    }
  });
}
