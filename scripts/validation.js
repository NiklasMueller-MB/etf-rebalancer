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
    <span style="font-size: 14px;">⚠️</span>
    <span>${message}</span>
    ${suggestedValue ? `<button class="fix-format-btn" style="background: #3498db; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-left: 8px;">Fix: ${suggestedValue}</button>` : ''}
  `;
  
  // Insert error after the input's parent
  inputElement.parentNode.style.position = 'relative';
  inputElement.parentNode.appendChild(errorDiv);
  
  // Add red border to input
  inputElement.style.borderColor = '#e74c3c';
  
  // Add click handler for fix button
  if (suggestedValue) {
    const fixBtn = errorDiv.querySelector('.fix-format-btn');
    fixBtn.addEventListener('click', () => {
      inputElement.value = suggestedValue;
      hideInputError(inputElement);
      // Trigger change event to update the value
      inputElement.dispatchEvent(new Event('change'));
    });
  }
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
