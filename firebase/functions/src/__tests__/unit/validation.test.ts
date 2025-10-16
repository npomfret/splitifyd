import { CreateExpenseRequestBuilder, RegisterRequestBuilder } from '@splitifyd/test-support';
import { validateRegisterRequest } from '../../auth/validation';
import { validateCreateExpense, validateUpdateExpense } from '../../expenses/validation';
import { ApiError } from '../../utils/errors';

describe('Auth Validation', () => {
    describe('validateRegisterRequest', () => {
        it('should validate valid register request and normalize data', () => {
            const request = new RegisterRequestBuilder()
                .withEmail('TEST@EXAMPLE.COM')
                .withDisplayName('  Test User  ')
                .withTermsAccepted(true)
                .withCookiePolicyAccepted(true)
                .build();

            const result = validateRegisterRequest(request);

            expect(result.email).toBe('test@example.com');
            expect(result.displayName).toBe('Test User');
            expect(result.termsAccepted).toBe(true);
            expect(result.cookiePolicyAccepted).toBe(true);
        });

        it('should enforce password requirements', () => {
            const request = new RegisterRequestBuilder()
                .withPassword('weak')
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
        });

        it('should enforce display name boundary conditions', () => {
            // Too short
            expect(() =>
                validateRegisterRequest(
                    new RegisterRequestBuilder()
                        .withDisplayName('A')
                        .withTermsAccepted(true)
                        .withCookiePolicyAccepted(true)
                        .build(),
                )
            )
                .toThrow(ApiError);

            // Too long
            expect(() =>
                validateRegisterRequest(
                    new RegisterRequestBuilder()
                        .withDisplayName('A'.repeat(51))
                        .withTermsAccepted(true)
                        .withCookiePolicyAccepted(true)
                        .build(),
                )
            )
                .toThrow(ApiError);

            // Invalid characters
            expect(() =>
                validateRegisterRequest(
                    new RegisterRequestBuilder()
                        .withDisplayName('Test<script>')
                        .withTermsAccepted(true)
                        .withCookiePolicyAccepted(true)
                        .build(),
                )
            )
                .toThrow(ApiError);

            // Valid boundary case
            const result = validateRegisterRequest(
                new RegisterRequestBuilder()
                    .withDisplayName('John Doe-Smith_123.Jr')
                    .withTermsAccepted(true)
                    .withCookiePolicyAccepted(true)
                    .build(),
            );
            expect(result.displayName).toBe('John Doe-Smith_123.Jr');
        });

        it('should require terms and cookie policy acceptance', () => {
            expect(() =>
                validateRegisterRequest(
                    new RegisterRequestBuilder()
                        .withTermsAccepted(false)
                        .withCookiePolicyAccepted(true)
                        .build(),
                )
            )
                .toThrow(ApiError);

            expect(() =>
                validateRegisterRequest(
                    new RegisterRequestBuilder()
                        .withTermsAccepted(true)
                        .withCookiePolicyAccepted(false)
                        .build(),
                )
            )
                .toThrow(ApiError);
        });
    });
});

describe('Expense Validation', () => {
    describe('validateCreateExpense and validateUpdateExpense', () => {
        it('should validate complete expense data including optional fields', () => {
            const validExpenseData = new CreateExpenseRequestBuilder()
                .withDescription('Dinner at restaurant')
                .withCategory('food')
                .withAmount(100.5)
                .withCurrency('USD')
                .withSplitType('equal')
                .withReceiptUrl('https://example.com/receipt.jpg')
                .build();

            const result = validateCreateExpense(validExpenseData);

            expect(result.description).toBe('Dinner at restaurant');
            expect(result.category).toBe('food');
            expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
            expect(result.amount).toBe('100.5');
            expect(result.splitType).toBe('equal');
        });

        it('should handle partial update data and empty optional fields', () => {
            const updateData = {
                description: 'Updated dinner',
                receiptUrl: '', // Test empty optional field
            };

            const result = validateUpdateExpense(updateData);

            expect(result.description).toBe('Updated dinner');
            expect(result.receiptUrl).toBe('');
        });
    });
});
