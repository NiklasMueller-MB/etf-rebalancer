export function validateNumberFormat(input) {
  const value = input.trim();
  
  // Check if the input contains comma as decimal separator
  if (value.includes(',') && !value.includes('.')) {
    // Count commas - if more than 1, it's likely a thousands separator, not decimal
    const commaCount = (value.match(/,/g) || []).length;
    if (commaCount === 1) {
      // Check if it's in a decimal position (not at the end)
      const parts = value.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        return {
          isValid: false,
          error: 'Please use point (.) as decimal separator instead of comma (,)',
          suggestedValue: value.replace(',', '.')
        };
      }
    }
  }
  
  // Check if it's a valid number format
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return {
      isValid: false,
      error: 'Please enter a valid number',
      suggestedValue: null
    };
  }
  
  return {
    isValid: true,
    error: null,
    suggestedValue: null
  };
}

export function showInputError(inputElement, message, suggestedValue = null) {
  // Remove any existing error message
  hideInputError(inputElement);
  
  // Create error message element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'input-error';
  errorDiv.style.cssText = `
    color: #e74c3c;
    font-size: 12px;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  `;
  
  errorDiv.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    <span>${message}</span>
  `;

  if (suggestedValue) {
    const fixBtn = document.createElement('button');
    fixBtn.className = 'fix-format-btn';
    fixBtn.style.cssText = 'background: #3498db; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-left: 8px;';
    fixBtn.textContent = `Fix: ${suggestedValue}`;
    fixBtn.addEventListener('click', () => {
      inputElement.value = suggestedValue;
      hideInputError(inputElement);
      inputElement.dispatchEvent(new Event('change'));
    });
    errorDiv.appendChild(fixBtn);
  }

  // Insert error after the input's parent
  inputElement.parentNode.style.position = 'relative';
  inputElement.parentNode.appendChild(errorDiv);

  // Add red border to input
  inputElement.style.borderColor = '#e74c3c';
}

export function hideInputError(inputElement) {
  const existingError = inputElement.parentNode.querySelector('.input-error');
  if (existingError) {
    existingError.remove();
  }
  inputElement.style.borderColor = '';
}

export function validateAndParseNumber(input, options = {}) {
  const { min, max, allowZero = true } = options;
  const validation = validateNumberFormat(input);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error,
      suggestedValue: validation.suggestedValue,
      value: null
    };
  }
  
  const value = parseFloat(input);
  
  // Check range constraints
  if (min !== undefined && value < min) {
    return {
      isValid: false,
      error: `Value must be at least ${min}`,
      suggestedValue: null,
      value: null
    };
  }
  
  if (max !== undefined && value > max) {
    return {
      isValid: false,
      error: `Value must be at most ${max}`,
      suggestedValue: null,
      value: null
    };
  }
  
  if (!allowZero && value === 0) {
    return {
      isValid: false,
      error: 'Value cannot be zero',
      suggestedValue: null,
      value: null
    };
  }
  
  return {
    isValid: true,
    error: null,
    suggestedValue: null,
    value
  };
}
