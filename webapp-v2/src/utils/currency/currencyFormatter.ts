import { getCurrency, DEFAULT_CURRENCY } from './currencyList';

export interface FormatOptions {
  showSymbol?: boolean;
  showCode?: boolean;
  locale?: string;
}

export const formatCurrency = (
  amount: number,
  currencyCode: string,
  options: FormatOptions = {}
): string => {
  const {
    showSymbol = true,
    showCode = false,
    locale = 'en-US'
  } = options;

  const currency = getCurrency(currencyCode) || getCurrency(DEFAULT_CURRENCY)!;
  
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: currency.decimal_digits,
      maximumFractionDigits: currency.decimal_digits
    });
    
    return formatter.format(amount);
  } catch (error) {
    const formattedAmount = amount.toFixed(currency.decimal_digits);
    
    if (showSymbol && !showCode) {
      return `${currency.symbol}${formattedAmount}`;
    } else if (showCode && !showSymbol) {
      return `${formattedAmount} ${currencyCode.toUpperCase()}`;
    } else if (showSymbol && showCode) {
      return `${currency.symbol}${formattedAmount} ${currencyCode.toUpperCase()}`;
    }
    
    return formattedAmount;
  }
};

export const formatCurrencyCompact = (
  amount: number,
  currencyCode: string,
  locale: string = 'en-US'
): string => {
  const currency = getCurrency(currencyCode) || getCurrency(DEFAULT_CURRENCY)!;
  
  if (Math.abs(amount) < 1000) {
    return formatCurrency(amount, currencyCode, { locale });
  }
  
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      notation: 'compact',
      maximumSignificantDigits: 3
    });
    
    return formatter.format(amount);
  } catch (error) {
    const absAmount = Math.abs(amount);
    let formattedAmount: string;
    
    if (absAmount >= 1_000_000) {
      formattedAmount = `${(amount / 1_000_000).toFixed(1)}M`;
    } else if (absAmount >= 1_000) {
      formattedAmount = `${(amount / 1_000).toFixed(1)}K`;
    } else {
      formattedAmount = amount.toFixed(currency.decimal_digits);
    }
    
    return `${currency.symbol}${formattedAmount}`;
  }
};

export const getCurrencySymbol = (currencyCode: string): string => {
  const currency = getCurrency(currencyCode);
  return currency?.symbol || currencyCode.toUpperCase();
};