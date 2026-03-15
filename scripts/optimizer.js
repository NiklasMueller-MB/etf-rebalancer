// Deviation function - sum of squared differences between current+rebalancing and target
function deviationFunction(r, ist, sol) {
  let sum = 0;
  for (let i = 0; i < r.length; i++) {
    const diff = ist[i] + r[i] - sol[i];
    sum += diff * diff;
  }
  return sum;
}

// Simple COBYLA-like optimization using pattern search
function optim(ist, sol, inv, lb, ub) {
  const n = ist.length;
  
  // Initial guess - distribute evenly
  let r = new Array(n).fill(inv / n);
  for (let i = 0; i < n; i++) {
    r[i] = Math.max(lb[i], Math.min(ub[i], r[i]));
  }
  
  // Normalize to meet constraint sum(r) = inv
  function normalizeToConstraint(arr) {
    const currentSum = arr.reduce((a, v) => a + v, 0);
    if (Math.abs(currentSum - inv) < 1e-6) return arr;
    
    const scale = inv / currentSum;
    const normalized = arr.map((v, i) => {
      const scaled = v * scale;
      return Math.max(lb[i], Math.min(ub[i], scaled));
    });
    
    // Adjust for bound violations
    const normalizedSum = normalized.reduce((a, v) => a + v, 0);
    const adjustment = inv - normalizedSum;
    
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
  let bestDev = deviationFunction(r, ist, sol);
  
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
        const candidateDev = deviationFunction(candidateR, ist, sol);
        
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
        const candidateDev = deviationFunction(candidateR, ist, sol);
        
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
  const { pricesById: pr, hiById: hi, loById: lo, currenciesById: cu } = priceData;

  const ist = etfs.map(e => (state.h[e.id] || 0) * pr[e.id]);
  const tot = ist.reduce((a, v) => a + v, 0);
  const ft = mode === 'onetime' ? tot + inv : tot + 3 * inv;
  const hasCrypto = etfs.some(e => e.cr && (state.h[e.id] || 0) > 0);
  const cs = hasCrypto ? 1 / 1.05 : 1;
  const sol = etfs.map(e =>
    e.rf ? (e.tgt / 100) * (1 - rp) * ft : (e.tgt / 100) * rp * cs * ft
  );
  
  // Calculate bounds based on R implementation logic
  let lb, ub;
  if (inv < 0) {
    // Selling: lower bound is investment amount, upper bound is 0
    lb = etfs.map(() => inv);
    ub = etfs.map(() => 0);
  } else if (inv === 0) {
    // Rebalancing: calculate free cash similar to R logic
    const freeCash = tot; // Simplified - in R this considers specific ISINs
    lb = etfs.map(() => -freeCash);
    ub = etfs.map(() => freeCash);
  } else {
    // Buying: lower bound is 0, upper bound is investment amount
    lb = etfs.map(() => 0);
    ub = etfs.map(() => inv);
  }
  
  const r = optim(ist, sol, inv, lb, ub);

  return {
    etfs,
    inv,
    rp,
    mode,
    ist,
    tot,
    ft,
    hasCrypto,
    cs,
    sol,
    r,
    pr,
    hi,
    lo,
    cu
  };
}

