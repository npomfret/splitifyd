import { Amount, amountToSmallestUnit, normalizeAmount } from '@splitifyd/shared';
import { getCurrency } from './currencyList';

export interface FormatOptions {
    locale?: string;
}

export const formatCurrency = (amount: Amount | number, currencyCode: string, options: FormatOptions = {}): string => {
    const { locale = 'en-US' } = options;

    if (!currencyCode || currencyCode.trim() === '') {
        throw Error('you must supply a currencyCode AND amount');
    }

    // getCurrency now throws for invalid currencies (fail-fast principle)
    const currency = getCurrency(currencyCode);
    const normalizedAmount = normalizeAmount(amount, currencyCode);
    const amountUnits = amountToSmallestUnit(normalizedAmount, currencyCode);
    const multiplier = Math.pow(10, currency.decimal_digits);
    const numericAmount = amountUnits / multiplier;

    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode.toUpperCase(),
        minimumFractionDigits: currency.decimal_digits,
        maximumFractionDigits: currency.decimal_digits,
    });

    return formatter.format(numericAmount);
};
