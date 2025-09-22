import { getCurrency } from './currencyList';

export interface FormatOptions {
    showSymbol?: boolean;
    showCode?: boolean;
    locale?: string;
}

export const formatCurrency = (amount: number, currencyCode: string, options: FormatOptions = {}): string => {
    const { showSymbol = true, showCode = false, locale = 'en-US' } = options;

    // getCurrency now throws for invalid currencies (fail-fast principle)
    const currency = getCurrency(currencyCode);

    try {
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode.toUpperCase(),
            minimumFractionDigits: currency.decimal_digits,
            maximumFractionDigits: currency.decimal_digits,
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
