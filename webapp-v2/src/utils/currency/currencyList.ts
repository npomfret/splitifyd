import currenciesData from '../../../../firebase/functions/src/static-data/currencies.json';

export interface Currency {
  acronym: string;
  name: string;
  symbol: string;
  decimal_digits: number;
  countries: string[];
}

export const currencies: Currency[] = currenciesData;

export const currencyMap = new Map<string, Currency>(
  currencies.map(currency => [currency.acronym, currency])
);

export const getCurrency = (code: string): Currency | undefined => {
  return currencyMap.get(code.toUpperCase());
};

export const isValidCurrency = (code: string): boolean => {
  return currencyMap.has(code.toUpperCase());
};

export const DEFAULT_CURRENCY = 'USD';

export const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 
  'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'ZAR'
];