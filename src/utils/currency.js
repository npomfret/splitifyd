// Currency conversion rates (fixed rates relative to USD)
export const currencyRates = {
    USD: 1,
    EUR: 0.85,
    GBP: 0.73,
    JPY: 110.0,
    AUD: 1.35,
    CAD: 1.25,
    CHF: 0.92,
    CNY: 6.45,
    INR: 74.5
};

// Currency symbols
export const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    INR: '₹'
};

export function formatCurrency(amount, currency) {
    const symbol = currencySymbols[currency] || currency;
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toFixed(2);
    return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    const amountInUSD = amount / currencyRates[fromCurrency];
    return amountInUSD * currencyRates[toCurrency];
}

export function detectDefaultCurrency() {
    const locale = navigator.language || 'en-US';
    
    if (locale.includes('GB')) return 'GBP';
    if (locale.includes('EU') || locale.includes('FR') || locale.includes('DE') || 
        locale.includes('IT') || locale.includes('ES')) return 'EUR';
    if (locale.includes('JP')) return 'JPY';
    if (locale.includes('AU')) return 'AUD';
    if (locale.includes('CA')) return 'CAD';
    if (locale.includes('CH')) return 'CHF';
    if (locale.includes('CN')) return 'CNY';
    if (locale.includes('IN')) return 'INR';
    
    return 'USD';
}