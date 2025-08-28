import { validateRegisterRequest } from '../../auth/validation';
import { validateCreateExpense, validateUpdateExpense } from '../../expenses/validation';
import { ApiError } from '../../utils/errors';

// Test builders - only specify what's needed for each test
class RegisterRequestBuilder {
    private request: any = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'Test User',
        termsAccepted: true,
        cookiePolicyAccepted: true,
    };

    withEmail(email: string): RegisterRequestBuilder {
        this.request.email = email;
        return this;
    }

    withPassword(password: string): RegisterRequestBuilder {
        this.request.password = password;
        return this;
    }

    withDisplayName(displayName: string): RegisterRequestBuilder {
        this.request.displayName = displayName;
        return this;
    }

    withoutDisplayName(): RegisterRequestBuilder {
        delete this.request.displayName;
        return this;
    }

    withTermsAccepted(accepted: boolean): RegisterRequestBuilder {
        this.request.termsAccepted = accepted;
        return this;
    }

    withoutTermsAccepted(): RegisterRequestBuilder {
        delete this.request.termsAccepted;
        return this;
    }

    withCookiePolicyAccepted(accepted: boolean): RegisterRequestBuilder {
        this.request.cookiePolicyAccepted = accepted;
        return this;
    }

    withoutCookiePolicyAccepted(): RegisterRequestBuilder {
        delete this.request.cookiePolicyAccepted;
        return this;
    }

    build(): any {
        return { ...this.request };
    }
}

class ExpenseDataBuilder {
    private expense: any = {
        groupId: 'group123',
        paidBy: 'user123',
        amount: 100.5,
        description: 'Dinner at restaurant',
        category: 'food',
        currency: 'USD',
        date: '2024-01-15T00:00:00.000Z',
        splitType: 'equal',
        participants: ['user123', 'user456'],
    };

    withReceiptUrl(url: string): ExpenseDataBuilder {
        this.expense.receiptUrl = url;
        return this;
    }

    build(): any {
        return { ...this.expense };
    }
}

describe('Auth Validation', () => {
    describe('validateRegisterRequest', () => {
        it('should validate valid register request and normalize data', () => {
            const request = new RegisterRequestBuilder()
                .withEmail('TEST@EXAMPLE.COM')
                .withDisplayName('  Test User  ')
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
            expect(() => validateRegisterRequest(
                new RegisterRequestBuilder().withDisplayName('A').build()
            )).toThrow(ApiError);

            // Too long  
            expect(() => validateRegisterRequest(
                new RegisterRequestBuilder().withDisplayName('A'.repeat(51)).build()
            )).toThrow(ApiError);

            // Invalid characters
            expect(() => validateRegisterRequest(
                new RegisterRequestBuilder().withDisplayName('Test<script>').build()
            )).toThrow(ApiError);

            // Valid boundary case
            const result = validateRegisterRequest(
                new RegisterRequestBuilder().withDisplayName('John Doe-Smith_123.Jr').build()
            );
            expect(result.displayName).toBe('John Doe-Smith_123.Jr');
        });

        it('should require terms and cookie policy acceptance', () => {
            expect(() => validateRegisterRequest(
                new RegisterRequestBuilder().withTermsAccepted(false).build()
            )).toThrow(ApiError);

            expect(() => validateRegisterRequest(
                new RegisterRequestBuilder().withCookiePolicyAccepted(false).build()
            )).toThrow(ApiError);
        });
    });
});

describe('Expense Validation', () => {
    describe('validateCreateExpense and validateUpdateExpense', () => {
        it('should validate complete expense data including optional fields', () => {
            const validExpenseData = new ExpenseDataBuilder()
                .withReceiptUrl('https://example.com/receipt.jpg')
                .build();
                
            const result = validateCreateExpense(validExpenseData);

            expect(result.description).toBe('Dinner at restaurant');
            expect(result.category).toBe('food');
            expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
            expect(result.amount).toBe(100.5);
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
