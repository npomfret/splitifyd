import { getCurrency, DEFAULT_CURRENCY } from './currencyList';

export const parseCurrencyAmount = (
  input: string,
  currencyCode: string
): number | null => {
  if (!input || input.trim() === '') {
    return null;
  }

  const currency = getCurrency(currencyCode) || getCurrency(DEFAULT_CURRENCY)!;
  
  let cleanedInput = input.trim();
  
  cleanedInput = cleanedInput.replace(new RegExp(`^\\${currency.symbol}`), '');
  cleanedInput = cleanedInput.replace(new RegExp(`${currencyCode}$`, 'i'), '');
  
  cleanedInput = cleanedInput.replace(/[,\s]/g, '');
  
  cleanedInput = cleanedInput.replace(/[()]/g, '');
  
  const isNegative = cleanedInput.startsWith('-') || input.includes('(');
  cleanedInput = cleanedInput.replace(/^-/, '');
  
  const parsed = parseFloat(cleanedInput);
  
  if (isNaN(parsed)) {
    return null;
  }
  
  const multiplier = Math.pow(10, currency.decimal_digits);
  const rounded = Math.round(parsed * multiplier) / multiplier;
  
  return isNegative ? -rounded : rounded;
};

export const validateCurrencyAmount = (
  amount: number,
  currencyCode: string
): { valid: boolean; error?: string } => {
  const currency = getCurrency(currencyCode);
  
  if (!currency) {
    return { valid: false, error: 'Invalid currency code' };
  }
  
  if (amount < 0) {
    return { valid: false, error: 'Amount cannot be negative' };
  }
  
  const maxAmount = 999999999.99;
  if (amount > maxAmount) {
    return { valid: false, error: 'Amount is too large' };
  }
  
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > currency.decimal_digits) {
    return { 
      valid: false, 
      error: `${currencyCode} only supports ${currency.decimal_digits} decimal places` 
    };
  }
  
  return { valid: true };
};