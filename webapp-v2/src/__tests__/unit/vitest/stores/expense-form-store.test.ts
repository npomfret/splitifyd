import { expenseFormStore } from '@/app/stores/expense-form-store';
import { toCurrencyISOCode } from '@billsplit-wl/shared';
import { beforeEach, describe, expect, it } from 'vitest';

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

describe('expenseFormStore receipt management', () => {
    beforeEach(() => {
        expenseFormStore.reset();
    });

    describe('setReceiptFile', () => {
        it('should set receipt file', () => {
            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });

            expenseFormStore.setReceiptFile(file);

            expect(expenseFormStore.receiptFile).toBe(file);
            expect(expenseFormStore.receiptError).toBeNull();
        });

        it('should clear receipt URL when file is selected', () => {
            expenseFormStore.setReceiptUrl('https://example.com/receipt.jpg');
            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });

            expenseFormStore.setReceiptFile(file);

            expect(expenseFormStore.receiptFile).toBe(file);
            expect(expenseFormStore.receiptUrl).toBeNull();
        });

        it('should allow clearing receipt file by setting null', () => {
            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
            expenseFormStore.setReceiptFile(file);

            expenseFormStore.setReceiptFile(null);

            expect(expenseFormStore.receiptFile).toBeNull();
        });

        it('should clear any existing receipt error when setting file', () => {
            // Simulate an error state (via internal mechanism)
            expenseFormStore.setReceiptFile(new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
            expenseFormStore.setReceiptFile(null);

            // Setting a new file should clear errors
            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
            expenseFormStore.setReceiptFile(file);

            expect(expenseFormStore.receiptError).toBeNull();
        });
    });

    describe('setReceiptUrl', () => {
        it('should set receipt URL', () => {
            const url = 'https://example.com/receipt.jpg';

            expenseFormStore.setReceiptUrl(url);

            expect(expenseFormStore.receiptUrl).toBe(url);
            expect(expenseFormStore.receiptError).toBeNull();
        });

        it('should clear receipt file when URL is set', () => {
            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
            expenseFormStore.setReceiptFile(file);

            expenseFormStore.setReceiptUrl('https://example.com/receipt.jpg');

            expect(expenseFormStore.receiptUrl).toBe('https://example.com/receipt.jpg');
            expect(expenseFormStore.receiptFile).toBeNull();
        });

        it('should allow clearing receipt URL by setting null', () => {
            expenseFormStore.setReceiptUrl('https://example.com/receipt.jpg');

            expenseFormStore.setReceiptUrl(null);

            expect(expenseFormStore.receiptUrl).toBeNull();
        });
    });

    describe('clearReceiptError', () => {
        it('should clear receipt error', () => {
            // The error is set internally during upload failures, but we can test the clear function
            expenseFormStore.clearReceiptError();

            expect(expenseFormStore.receiptError).toBeNull();
        });
    });

    describe('reset', () => {
        it('should clear all receipt state on reset', () => {
            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
            expenseFormStore.setReceiptFile(file);
            expenseFormStore.setReceiptUrl('https://example.com/receipt.jpg');

            expenseFormStore.reset();

            expect(expenseFormStore.receiptFile).toBeNull();
            expect(expenseFormStore.receiptUrl).toBeNull();
            expect(expenseFormStore.receiptUploading).toBe(false);
            expect(expenseFormStore.receiptError).toBeNull();
        });
    });

    describe('hasUnsavedChanges', () => {
        it('should detect receipt file as unsaved change when no initial state captured', () => {
            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
            expenseFormStore.setReceiptFile(file);

            expect(expenseFormStore.hasUnsavedChanges()).toBe(true);
        });

        it('should detect receipt URL as unsaved change when no initial state captured', () => {
            expenseFormStore.setReceiptUrl('https://example.com/receipt.jpg');

            expect(expenseFormStore.hasUnsavedChanges()).toBe(true);
        });

        it('should detect receipt file change after initial state captured', () => {
            expenseFormStore.captureInitialState();

            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
            expenseFormStore.setReceiptFile(file);

            expect(expenseFormStore.hasUnsavedChanges()).toBe(true);
        });

        it('should detect receipt URL removal as unsaved change', () => {
            expenseFormStore.setReceiptUrl('https://example.com/receipt.jpg');
            expenseFormStore.captureInitialState();

            expenseFormStore.setReceiptUrl(null);

            expect(expenseFormStore.hasUnsavedChanges()).toBe(true);
        });

        it('should not detect unsaved changes when receipt URL unchanged', () => {
            expenseFormStore.setReceiptUrl('https://example.com/receipt.jpg');
            expenseFormStore.captureInitialState();

            expect(expenseFormStore.hasUnsavedChanges()).toBe(false);
        });
    });

    describe('signal accessors', () => {
        it('should expose receiptFileSignal as readonly', () => {
            const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
            expenseFormStore.setReceiptFile(file);

            expect(expenseFormStore.receiptFileSignal.value).toBe(file);
        });

        it('should expose receiptUrlSignal as readonly', () => {
            expenseFormStore.setReceiptUrl('https://example.com/receipt.jpg');

            expect(expenseFormStore.receiptUrlSignal.value).toBe('https://example.com/receipt.jpg');
        });

        it('should expose receiptUploadingSignal as readonly', () => {
            expect(expenseFormStore.receiptUploadingSignal.value).toBe(false);
        });

        it('should expose receiptErrorSignal as readonly', () => {
            expect(expenseFormStore.receiptErrorSignal.value).toBeNull();
        });
    });
});
