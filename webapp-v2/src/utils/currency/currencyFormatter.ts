import { Amount, amountToSmallestUnit, normalizeAmount } from '@splitifyd/shared';
import { getCurrency } from './currencyList';

export interface FormatOptions {
    locale?: string;
    includeCurrencyCode?: boolean;
}

export const formatCurrency = (amount: Amount | number, currencyCode: string, options: FormatOptions = {}): string => {
    const {
        locale = 'en-US',
        includeCurrencyCode = true,
    } = options;

    if (!currencyCode || currencyCode.trim() === '') {
        throw Error('you must supply a currencyCode AND amount');
    }

    // getCurrency now throws for invalid currencies (fail-fast principle)
    const currency = getCurrency(currencyCode);
    const normalizedAmount = normalizeAmount(amount, currencyCode);
    const amountUnits = amountToSmallestUnit(normalizedAmount, currencyCode);
    const multiplier = Math.pow(10, currency.decimal_digits);
    const numericAmount = amountUnits / multiplier;

    const magnitudeFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: currency.decimal_digits,
        maximumFractionDigits: currency.decimal_digits,
        useGrouping: true,
    });

    const parts = magnitudeFormatter.formatToParts(numericAmount);
    const signPart = parts.find((part) => part.type === 'minusSign')?.value ?? '';
    const unsignedFormattedNumber = parts
        .filter((part) => part.type !== 'minusSign')
        .map((part) => part.value)
        .join('');

    const symbol = currency.symbol || currency.acronym;
    const formatted = `${signPart}${symbol}${unsignedFormattedNumber}`;

    if (!includeCurrencyCode) {
        return formatted;
    }

    return `${formatted} ${currencyCode.toUpperCase()}`;
};
