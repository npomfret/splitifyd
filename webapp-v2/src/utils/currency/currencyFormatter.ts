import { getCurrency } from './currencyList';
import {Amount} from "@splitifyd/shared";

export interface FormatOptions {
    locale?: string;
}

export const formatCurrency = (amount: Amount, currencyCode: string, options: FormatOptions = {}): string => {
    const { locale = 'en-US' } = options;

    if (!currencyCode || currencyCode.trim() === '') {
        throw Error('you must supply a currencyCode AND amount');
    }

    // getCurrency now throws for invalid currencies (fail-fast principle)
    const currency = getCurrency(currencyCode);

    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode.toUpperCase(),
        minimumFractionDigits: currency.decimal_digits,
        maximumFractionDigits: currency.decimal_digits,
    });

    return formatter.format(amount);
};
