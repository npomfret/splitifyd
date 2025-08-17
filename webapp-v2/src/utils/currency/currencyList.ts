export interface Currency {
    acronym: string;
    name: string;
    symbol: string;
    decimal_digits: number;
    countries: string[];
}

// Lazy loading of currencies data
let currenciesCache: Currency[] | null = null;
let currencyMapCache: Map<string, Currency> | null = null;
let loadingPromise: Promise<Currency[]> | null = null;

// Load currencies lazily
async function loadCurrencies(): Promise<Currency[]> {
    if (currenciesCache) {
        return currenciesCache;
    }

    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = import('../../../../firebase/functions/src/static-data/currencies.json').then((module) => {
        currenciesCache = module.default as Currency[];
        currencyMapCache = new Map<string, Currency>(currenciesCache.map((currency) => [currency.acronym, currency]));
        return currenciesCache;
    });

    return loadingPromise;
}

// Synchronous access to currencies (returns empty array if not loaded)
export const currencies: Currency[] = [];

// Get all currencies (async)
export const getCurrenciesAsync = async (): Promise<Currency[]> => {
    return loadCurrencies();
};

// Pre-load essential currencies for immediate use
const ESSENTIAL_CURRENCIES_DATA: Currency[] = [
    { acronym: 'USD', name: 'United States Dollar', symbol: '$', decimal_digits: 2, countries: ['United States'] },
    { acronym: 'EUR', name: 'Euro', symbol: '€', decimal_digits: 2, countries: ['European Union'] },
    { acronym: 'GBP', name: 'British Pound', symbol: '£', decimal_digits: 2, countries: ['United Kingdom'] },
    { acronym: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_digits: 0, countries: ['Japan'] },
    { acronym: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimal_digits: 2, countries: ['Canada'] },
    { acronym: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimal_digits: 2, countries: ['Australia'] },
    { acronym: 'CHF', name: 'Swiss Franc', symbol: 'Fr', decimal_digits: 2, countries: ['Switzerland'] },
    { acronym: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimal_digits: 2, countries: ['China'] },
    { acronym: 'INR', name: 'Indian Rupee', symbol: '₹', decimal_digits: 2, countries: ['India'] },
    { acronym: 'MXN', name: 'Mexican Peso', symbol: '$', decimal_digits: 2, countries: ['Mexico'] },
    { acronym: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimal_digits: 2, countries: ['Brazil'] },
    { acronym: 'ZAR', name: 'South African Rand', symbol: 'R', decimal_digits: 2, countries: ['South Africa'] },
];

// Pre-loaded map for essential currencies
const essentialCurrencyMap = new Map<string, Currency>(ESSENTIAL_CURRENCIES_DATA.map((currency) => [currency.acronym, currency]));

export const getCurrency = (code: string): Currency | undefined => {
    const upperCode = code.toUpperCase();

    // First check essential currencies (immediately available)
    const essential = essentialCurrencyMap.get(upperCode);
    if (essential) return essential;

    // Then check cache if loaded
    if (currencyMapCache) {
        return currencyMapCache.get(upperCode);
    }

    // Trigger lazy load for future use but return undefined for now
    loadCurrencies();
    return undefined;
};

export const isValidCurrency = (code: string): boolean => {
    const upperCode = code.toUpperCase();

    // Check essential currencies first
    if (essentialCurrencyMap.has(upperCode)) return true;

    // Check cache if loaded
    if (currencyMapCache) {
        return currencyMapCache.has(upperCode);
    }

    // For now, return false and trigger load
    loadCurrencies();
    return false;
};

export const DEFAULT_CURRENCY = 'USD';

export const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'ZAR'];
