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

// List of supported currencies
export const supportedCurrencies = Object.keys(currencySymbols);

export function formatCurrency(amount, currency) {
    const symbol = currencySymbols[currency] || currency;
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toFixed(2);
    return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}