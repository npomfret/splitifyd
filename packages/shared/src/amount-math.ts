import { Amount } from './shared-types';
import { amountToSmallestUnit, roundToCurrencyPrecision, smallestUnitToAmountString } from './split-utils';

function normalizeAndConvertToUnits(amount: Amount | number, currency: string): number {
    const normalized = roundToCurrencyPrecision(amount, currency);
    return amountToSmallestUnit(normalized, currency);
}

export function normalizeAmount(amount: Amount | number, currency: string): Amount {
    return roundToCurrencyPrecision(amount, currency);
}

export function zeroAmount(currency: string): Amount {
    return smallestUnitToAmountString(0, currency);
}

export function addAmounts(a: Amount | number, b: Amount | number, currency: string): Amount {
    const sumUnits = normalizeAndConvertToUnits(a, currency) + normalizeAndConvertToUnits(b, currency);
    return smallestUnitToAmountString(sumUnits, currency);
}

export function subtractAmounts(a: Amount | number, b: Amount | number, currency: string): Amount {
    const diffUnits = normalizeAndConvertToUnits(a, currency) - normalizeAndConvertToUnits(b, currency);
    return smallestUnitToAmountString(diffUnits, currency);
}

export function negateAmount(amount: Amount | number, currency: string): Amount {
    return smallestUnitToAmountString(-normalizeAndConvertToUnits(amount, currency), currency);
}

export function negateNormalizedAmount(amount: Amount): Amount {
    if (amount === '0' || amount === '0.0' || amount === '0.00' || amount === '0.000') {
        return amount;
    }
    return amount.startsWith('-') ? amount.slice(1) as Amount : (`-${amount}` as Amount);
}

export function absAmount(amount: Amount | number, currency: string): Amount {
    const units = normalizeAndConvertToUnits(amount, currency);
    const absUnits = Math.abs(units);
    return smallestUnitToAmountString(absUnits, currency);
}

export function compareAmounts(a: Amount | number, b: Amount | number, currency: string): number {
    return normalizeAndConvertToUnits(a, currency) - normalizeAndConvertToUnits(b, currency);
}

export function minAmount(a: Amount | number, b: Amount | number, currency: string): Amount {
    return compareAmounts(a, b, currency) <= 0 ? normalizeAmount(a, currency) : normalizeAmount(b, currency);
}

export function sumAmounts(amounts: Array<Amount | number>, currency: string): Amount {
    const totalUnits = amounts.reduce<number>(
        (acc, value) => acc + normalizeAndConvertToUnits(value, currency),
        0,
    );
    return smallestUnitToAmountString(totalUnits, currency);
}

export function isZeroAmount(amount: Amount | number, currency: string): boolean {
    return normalizeAndConvertToUnits(amount, currency) === 0;
}
