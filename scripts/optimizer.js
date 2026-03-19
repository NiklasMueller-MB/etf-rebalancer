// Deviation function - sum of squared differences between current+rebalancing and target
// Includes penalty terms for trades below minimum amounts
function deviationFunction(r, ist, sol, minBuyAmount, minSellAmount) {
  let sum = 0;
  let penalty = 0;
  const penaltyWeight = 10; // High weight to strongly discourage small trades
  
  for (let i = 0; i < r.length; i++) {
    const diff = ist[i] + r[i] - sol[i];
    sum += diff * diff;
    
    // Add penalty for trades below minimum amounts
    if (r[i] > 0 && r[i] < minBuyAmount) {
      penalty += penaltyWeight * Math.pow(minBuyAmount - r[i], 2);
    } else if (r[i] < 0 && Math.abs(r[i]) < minSellAmount) {
      penalty += penaltyWeight * Math.pow(minSellAmount + r[i], 2);
    }
  }
  return sum + penalty;
}

// Simple COBYLA-like optimization using pattern search
function optim(ist, sol, inv, lb, ub, minBuyAmount, minSellAmount) {
  const n = ist.length;
  
  // Debug: Check for valid bounds
  for (let i = 0; i < n; i++) {
    if (isNaN(lb[i]) || isNaN(ub[i]) || !isFinite(lb[i]) || !isFinite(ub[i])) {
      console.error('Invalid bounds:', i, lb[i], ub[i]);
      return new Array(n).fill(0);
    }
  }
  
  // Initial guess - distribute evenly
  // For sell-only mode, inv should be negative (selling)
  const effectiveInv = (lb[0] < 0 && ub[0] <= 0) ? -inv : inv;
  let r = new Array(n).fill(effectiveInv / n);
  for (let i = 0; i < n; i++) {
    r[i] = Math.max(lb[i], Math.min(ub[i], r[i]));
  }
  
  // Normalize to meet constraint sum(r) = inv
  function normalizeToConstraint(arr) {
    const currentSum = arr.reduce((a, v) => a + v, 0);
    if (Math.abs(currentSum - effectiveInv) < 1e-6) return arr;
    
    const scale = effectiveInv / currentSum;
    const normalized = arr.map((v, i) => {
      const scaled = v * scale;
      return Math.max(lb[i], Math.min(ub[i], scaled));
    });
    
    // Adjust for bound violations
    const normalizedSum = normalized.reduce((a, v) => a + v, 0);
    const adjustment = effectiveInv - normalizedSum;
    
    if (Math.abs(adjustment) > 1e-6) {
      // Distribute adjustment to variables that can move
      const canIncrease = normalized.map((v, i) => v < ub[i] ? i : -1).filter(i => i >= 0);
      const canDecrease = normalized.map((v, i) => v > lb[i] ? i : -1).filter(i => i >= 0);
      
      if (adjustment > 0 && canIncrease.length > 0) {
        const adjPerVar = adjustment / canIncrease.length;
        canIncrease.forEach(i => {
          normalized[i] = Math.min(ub[i], normalized[i] + adjPerVar);
        });
      } else if (adjustment < 0 && canDecrease.length > 0) {
        const adjPerVar = adjustment / canDecrease.length;
        canDecrease.forEach(i => {
          normalized[i] = Math.max(lb[i], normalized[i] + adjPerVar);
        });
      }
    }
    
    return normalized;
  }
  
  r = normalizeToConstraint(r);
  
  let bestR = [...r];
  let bestDev = deviationFunction(r, ist, sol, minBuyAmount, minSellAmount);
  
  // Pattern search optimization
  const maxIterations = 1000;
  const initialStepSize = Math.max(Math.abs(inv), 1) * 0.1;
  let stepSize = initialStepSize;
  const tolerance = 1e-6;
  const minStepSize = 1e-8;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;
    
    // Try coordinate-wise search
    for (let i = 0; i < n; i++) {
      const originalValue = r[i];
      
      // Try positive direction
      if (originalValue + stepSize <= ub[i]) {
        r[i] = originalValue + stepSize;
        const candidateR = normalizeToConstraint(r);
        const candidateDev = deviationFunction(candidateR, ist, sol, minBuyAmount, minSellAmount);
        
        if (candidateDev < bestDev - tolerance) {
          bestR = [...candidateR];
          bestDev = candidateDev;
          improved = true;
        }
      }
      
      // Try negative direction
      if (originalValue - stepSize >= lb[i]) {
        r[i] = originalValue - stepSize;
        const candidateR = normalizeToConstraint(r);
        const candidateDev = deviationFunction(candidateR, ist, sol, minBuyAmount, minSellAmount);
        
        if (candidateDev < bestDev - tolerance) {
          bestR = [...candidateR];
          bestDev = candidateDev;
          improved = true;
        }
      }
      
      r[i] = originalValue;
    }
    
    // If improvement found, continue with current step size
    if (improved) {
      r = [...bestR];
    } else {
      // Reduce step size and continue
      stepSize *= 0.5;
      if (stepSize < minStepSize) break;
    }
  }
  
  // Final normalization to ensure constraint is met
  r = normalizeToConstraint(bestR);
  
  return r;
}

export { optim };

export function optimizeAllocation(state, priceData) {
  const etfs = state.etfs;
  const inv = state.inv;
  const rp = state.rp;
  const mode = state.mode;
  const allowBuy = state.allowBuy ?? true;
  const allowSell = state.allowSell ?? false;
  const minBuyAmount = state.minBuyAmount ?? 250;
  const minSellAmount = state.minSellAmount ?? 250;
  const { pricesById: pr, hiById: hi, loById: lo, currenciesById: cu } = priceData;

  const ist = etfs.map(e => (state.h[e.id] || 0) * pr[e.id]);
  const tot = ist.reduce((a, v) => a + v, 0);
  const ft = mode === 'onetime' ? tot + inv : tot + 3 * inv;
  const hasCrypto = etfs.some(e => e.cr && (state.h[e.id] || 0) > 0);
  const cs = hasCrypto ? 1 / 1.05 : 1;
  
  // Special handling when all holdings are 0: exclude risk-free assets from target allocation
  const allHoldingsZero = tot === 0;
  const sol = etfs.map(e => {
    if (e.rf) {
      // For risk-free assets, only allocate if we have existing holdings
      return allHoldingsZero ? 0 : (e.tgt / 100) * (1 - rp) * ft;
    } else {
      return (e.tgt / 100) * rp * cs * ft;
    }
  });
  
  // Calculate bounds based on user preferences and minimal amounts
  let lb, ub;
  if (mode === 'savings') {
    // For savings plan, always allow buying only
    lb = etfs.map(() => 0);
    ub = etfs.map(() => inv);
  } else {
    // For one-time investment, respect user preferences
    if (!allowBuy && !allowSell) {
      // No trading allowed - everything stays at 0
      lb = etfs.map(() => 0);
      ub = etfs.map(() => 0);
    } else if (allowBuy && !allowSell) {
      // Only buying allowed
      lb = etfs.map(() => 0);
      ub = etfs.map(() => inv);
    } else if (!allowBuy && allowSell) {
      // Only selling allowed - investment amount is negative (total to sell)
      lb = etfs.map(() => -inv);
      ub = etfs.map(() => 0);
    } else {
      // Both buying and selling allowed - can rebalance
      // If investment is 0, this is pure rebalancing (sell some, buy others)
      // If investment > 0, can both buy and sell
      const totalValue = ist.reduce((a, v) => a + v, 0);
      lb = etfs.map(() => inv === 0 ? -totalValue * 0.5 : -inv);
      ub = etfs.map(() => inv === 0 ? totalValue * 0.5 : inv);
    }
  }
  
  const r = optim(ist, sol, inv, lb, ub, minBuyAmount, minSellAmount);
  
  // Post-process to round to valid discrete states (0 or >= minimum)
  const adjustedR = r.map((amount, i) => {
    if (amount > 0 && amount < minBuyAmount) {
      // Round small buy to nearest valid state (0 or minBuyAmount)
      const targetWithZero = Math.abs(amount - 0);
      const targetWithMin = Math.abs(amount - minBuyAmount);
      return targetWithZero <= targetWithMin ? 0 : minBuyAmount;
    } else if (amount < 0 && Math.abs(amount) < minSellAmount) {
      // Round small sell to nearest valid state (0 or -minSellAmount)
      const targetWithZero = Math.abs(amount - 0);
      const targetWithMin = Math.abs(amount + minSellAmount);
      return targetWithZero <= targetWithMin ? 0 : -minSellAmount;
    }
    return amount;
  });
  
  // Adjust to maintain sum constraint exactly
  const currentSum = adjustedR.reduce((a, v) => a + v, 0);
  const sumError = effectiveInv - currentSum;
  
  if (Math.abs(sumError) > 1e-6) {
    // Distribute error to trades that can be adjusted
    const canIncrease = adjustedR.map((v, i) => v > 0 && v < effectiveInv ? i : -1).filter(i => i >= 0);
    const canDecrease = adjustedR.map((v, i) => v < 0 && v > effectiveInv ? i : -1).filter(i => i >= 0);
    
    if (sumError > 0 && canIncrease.length > 0) {
      const adjPerVar = sumError / canIncrease.length;
      canIncrease.forEach(i => {
        adjustedR[i] += adjPerVar;
      });
    } else if (sumError < 0 && canDecrease.length > 0) {
      const adjPerVar = sumError / canDecrease.length;
      canDecrease.forEach(i => {
        adjustedR[i] += adjPerVar;
      });
    }
  }

  return {
    etfs,
    inv,
    rp,
    mode,
    allowBuy,
    allowSell,
    minBuyAmount,
    minSellAmount,
    ist,
    tot,
    ft,
    hasCrypto,
    cs,
    sol,
    r: adjustedR,
    pr,
    hi,
    lo,
    cu
  };
}

