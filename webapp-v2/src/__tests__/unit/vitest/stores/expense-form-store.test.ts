import { expenseFormStore } from '@/app/stores/expense-form-store';
import { beforeEach, describe, expect, it } from 'vitest';
import {toCurrencyISOCode} from "@billsplit-wl/shared";

describe('expenseFormStore amount validation', () => {
    beforeEach(() => {
        expenseFormStore.reset();
    });

    it('surfaces precision validation errors without throwing for currencies that disallow extra decimals', () => {
        expenseFormStore.updateField('currency', toCurrencyISOCode('EUR'));

        expect(() => {
            expenseFormStore.updateField('amount', '3.333');
        })
            .not
            .toThrow();

        expect(expenseFormStore.validationErrors.amount).toContain('decimal place');
        expect(expenseFormStore.splits).toEqual([]);
    });
});
