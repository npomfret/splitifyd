import { Amount, amountToSmallestUnit, CurrencyISOCode, normalizeAmount } from '@billsplit-wl/shared';
import { getCurrency } from './currencyList';

export interface FormatOptions {
    locale?: string;
    includeCurrencyCode?: boolean;
}

interface CurrencyParts {
    sign: string;
    symbol: string;
    formattedNumber: string;
    currencyCode: string;
}

export const formatCurrency = (amount: Amount, currencyCode: CurrencyISOCode, options: FormatOptions = {}): string => {
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
    const symbolMatchesCode = symbol.toUpperCase() === currencyCode.toUpperCase();

    // If symbol matches code (e.g. CHF), don't duplicate it
    if (symbolMatchesCode) {
        const formatted = `${signPart}${unsignedFormattedNumber}`;
        return includeCurrencyCode ? `${formatted} ${currencyCode.toUpperCase()}` : formatted;
    }

    // Use LRM (Left-to-Right Mark) to prevent RTL symbols from being repositioned by browser's bidi algorithm
    const formatted = `${signPart}\u200E${symbol}\u200E ${unsignedFormattedNumber}`;

    if (!includeCurrencyCode) {
        return formatted;
    }

    return `${formatted} ${currencyCode.toUpperCase()}`;
};

export const formatCurrencyParts = (amount: Amount, currencyCode: CurrencyISOCode, options: FormatOptions = {}): CurrencyParts => {
    const { locale = 'en-US' } = options;

    if (!currencyCode || currencyCode.trim() === '') {
        throw Error('you must supply a currencyCode AND amount');
    }

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
    const sign = parts.find((part) => part.type === 'minusSign')?.value ?? '';
    const formattedNumber = parts
        .filter((part) => part.type !== 'minusSign')
        .map((part) => part.value)
        .join('');

    const symbol = currency.symbol || currency.acronym;

    return {
        sign,
        symbol,
        formattedNumber,
        currencyCode: currencyCode.toUpperCase(),
    };
};
