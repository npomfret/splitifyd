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
        it('should validate valid register request', () => {
            const validRequest = new RegisterRequestBuilder().build();

            const result = validateRegisterRequest(validRequest);

            expect(result.email).toBe('test@example.com');
            expect(result.password).toBe('TestPass123\!');
            expect(result.displayName).toBe('Test User');
            expect(result.termsAccepted).toBe(true);
            expect(result.cookiePolicyAccepted).toBe(true);
        });

        it('should normalize email to lowercase and trim display name', () => {
            const request = new RegisterRequestBuilder()
                .withEmail('TEST@EXAMPLE.COM')
                .withDisplayName('  Test User  ')
                .build();

            const result = validateRegisterRequest(request);

            expect(result.email).toBe('test@example.com');
            expect(result.displayName).toBe('Test User');
        });

        it('should throw error for weak password', () => {
            const request = new RegisterRequestBuilder()
                .withPassword('weakpass')
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('Password must contain at least 8 characters');
        });

        it('should throw error for missing display name', () => {
            const request = new RegisterRequestBuilder()
                .withoutDisplayName()
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('Display name is required');
        });

        it('should throw error for display name too short', () => {
            const request = new RegisterRequestBuilder()
                .withDisplayName('A')
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('Display name must be at least 2 characters');
        });

        it('should throw error for display name too long', () => {
            const request = new RegisterRequestBuilder()
                .withDisplayName('A'.repeat(51))
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('Display name cannot exceed 50 characters');
        });

        it('should throw error for invalid display name characters', () => {
            const request = new RegisterRequestBuilder()
                .withDisplayName('Test<script>alert("xss")</script>')
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods');
        });

        it('should accept valid display name characters', () => {
            const request = new RegisterRequestBuilder()
                .withDisplayName('John Doe-Smith_123.Jr')
                .build();

            const result = validateRegisterRequest(request);

            expect(result.displayName).toBe('John Doe-Smith_123.Jr');
        });

        it('should throw error for missing terms acceptance', () => {
            const request = new RegisterRequestBuilder()
                .withoutTermsAccepted()
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('Terms acceptance is required');
        });

        it('should throw error for missing cookie policy acceptance', () => {
            const request = new RegisterRequestBuilder()
                .withoutCookiePolicyAccepted()
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('Cookie policy acceptance is required');
        });

        it('should throw error for false terms acceptance', () => {
            const request = new RegisterRequestBuilder()
                .withTermsAccepted(false)
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('You must accept the Terms of Service');
        });

        it('should throw error for false cookie policy acceptance', () => {
            const request = new RegisterRequestBuilder()
                .withCookiePolicyAccepted(false)
                .build();

            expect(() => validateRegisterRequest(request)).toThrow(ApiError);
            expect(() => validateRegisterRequest(request)).toThrow('You must accept the Cookie Policy');
        });
    });
});

describe('Expense Validation', () => {
    describe('validateCreateExpense', () => {
        it('should validate expense with all fields', () => {
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

        it('should handle empty receiptUrl', () => {
            const dataWithEmptyReceipt = new ExpenseDataBuilder()
                .withReceiptUrl('')
                .build();

            const result = validateCreateExpense(dataWithEmptyReceipt);

            expect(result.receiptUrl).toBe('');
        });
    });

    describe('validateUpdateExpense', () => {
        it('should validate partial update data', () => {
            const updateData = {
                description: 'Updated dinner',
                category: 'food',
                receiptUrl: 'https://example.com/new-receipt.jpg',
            };

            const result = validateUpdateExpense(updateData);

            expect(result.description).toBe('Updated dinner');
            expect(result.category).toBe('food');
            expect(result.receiptUrl).toBe('https://example.com/new-receipt.jpg');
        });
    });
});
