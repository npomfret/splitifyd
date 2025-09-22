import { generateShortId } from '@splitifyd/test-support';

/**
 * Test scenarios object that provides consistent test data for Playwright tests
 * Replaces the static TEST_SCENARIOS constant with an object-oriented approach
 */
export class TestScenarios {
    // Static instances to ensure consistency within test runs
    private static _validUser: { email: string; password: string; displayName: string } | null = null;
    private static _anotherValidUser: { email: string; password: string; displayName: string } | null = null;

    // User data scenarios
    static get validUser() {
        if (!this._validUser) {
            this._validUser = {
                email: `test-${generateShortId()}@example.com`,
                password: 'password123',
                displayName: 'Test User'
            };
        }
        return this._validUser;
    }

    static get anotherValidUser() {
        if (!this._anotherValidUser) {
            this._anotherValidUser = {
                email: `user-${generateShortId()}@example.com`,
                password: 'password123',
                displayName: 'Another User'
            };
        }
        return this._anotherValidUser;
    }

    static get userWithLongName() {
        return {
            email: `long-name-${generateShortId()}@example.com`,
            password: 'password123',
            displayName: 'Test User With Very Long Display Name That Might Cause Issues'
        };
    }

    // Email scenarios
    static get invalidEmails() {
        return [
            'invalid-email',
            'user@domain',
            '@example.com',
            'user@',
            'plaintext',
            'user..name@domain.com',
            'user@domain..com'
        ];
    }

    static get validEmails() {
        return [
            `valid1-${generateShortId()}@example.com`,
            `valid2-${generateShortId()}@test.org`,
            `valid3-${generateShortId()}@domain.co.uk`
        ];
    }

    // Password scenarios
    static get weakPasswords() {
        return [
            'weak',
            '123',
            'password',
            '12345678',
            'abc123'
        ];
    }

    static get strongPasswords() {
        return [
            'StrongPassword123!',
            'MySecureP@ssw0rd',
            'Complex!Pass123',
            'Tr0ub4dor&3',
            'correct-horse-battery-staple-123'
        ];
    }

    static get validPassword() {
        return 'rrRR44$$';
    }

    // Form value scenarios
    static get emptyValues() {
        return ['', '   ', '\t\n', '    '];
    }

    static get whitespaceValues() {
        return [
            '  leading spaces',
            'trailing spaces  ',
            '  both sides  ',
            'middle   spaces',
            '\ttabs\t',
            '\nnewlines\n'
        ];
    }

    // Group scenarios
    static get validGroupNames() {
        return [
            `Test Group ${generateShortId()}`,
            'Coffee & Lunch',
            'Trip to Paris 2024',
            'Roommates - Apt 123',
            'Family Vacation (Summer)',
            'Work Team Building!'
        ];
    }

    static get invalidGroupNames() {
        return [
            '', // Empty
            'A', // Too short
            'A'.repeat(101), // Too long
            '   ', // Only whitespace
        ];
    }

    static get validDescriptions() {
        return [
            'A group for tracking shared expenses',
            'Monthly apartment costs including rent and utilities',
            'Weekend trip expenses for beach house vacation',
            '', // Empty description should be valid
            'Short desc',
            'A'.repeat(200) // Max length description
        ];
    }

    // Amount scenarios
    static get validAmounts() {
        return [
            0.01, // Minimum
            1.00,
            10.50,
            100.00,
            999.99,
            1000.00,
            9999.99 // Maximum reasonable amount
        ];
    }

    static get invalidAmounts() {
        return [
            0, // Zero
            -1, // Negative
            -10.50, // Negative decimal
            0.001, // Too many decimal places
            10000, // Too large
            99999.99 // Way too large
        ];
    }

    // URL scenarios
    static get validReturnUrls() {
        return [
            '/dashboard',
            '/groups/123',
            '/groups/test-group/add-expense',
            '/groups/my-group/expenses/456',
            '/settings/profile'
        ];
    }

    static get complexUrls() {
        return [
            '/groups/test-group/add-expense?id=123&edit=true',
            '/groups/my%20group/add-expense?copy=true&sourceId=456',
            '/groups/special-chars_123/expenses?tab=details&filter=recent'
        ];
    }

    // Navigation scenarios
    static get protectedRoutes() {
        return [
            '/dashboard',
            '/groups/123',
            '/groups/123/add-expense',
            '/groups/123/expenses/456',
            '/settings',
            '/settings/profile'
        ];
    }

    static get publicRoutes() {
        return [
            '/login',
            '/register',
            '/reset-password',
            '/privacy-policy',
            '/terms-of-service',
            '/cookies'
        ];
    }

    // Error scenarios
    static get authErrors() {
        return {
            invalidPassword: {
                code: 'INVALID_PASSWORD',
                message: 'The password is invalid or the user does not have a password.'
            },
            userNotFound: {
                code: 'USER_NOT_FOUND',
                message: 'There is no user record corresponding to this identifier.'
            },
            emailAlreadyInUse: {
                code: 'EMAIL_ALREADY_IN_USE',
                message: 'The email address is already in use by another account.'
            },
            weakPassword: {
                code: 'WEAK_PASSWORD',
                message: 'The password must be 6 characters long or more.'
            }
        };
    }

    static get apiErrors() {
        return {
            notFound: {
                code: 'NOT_FOUND',
                message: 'Resource not found'
            },
            unauthorized: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            },
            forbidden: {
                code: 'FORBIDDEN',
                message: 'Access denied'
            },
            serverError: {
                code: 'SERVER_ERROR',
                message: 'Internal server error'
            },
            validationError: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed'
            }
        };
    }

    // Member scenarios
    static createGroupMembers(count: number) {
        const members = [];
        for (let i = 0; i < count; i++) {
            members.push({
                email: `member${i + 1}-${generateShortId()}@test.com`,
                displayName: `Member ${i + 1}`,
                role: i === 0 ? 'admin' : 'member',
                status: 'active'
            });
        }
        return members;
    }

    static createGroupMembersWithVariedStatus(adminCount: number = 1, activeCount: number = 2, pendingCount: number = 1) {
        const members = [];
        let index = 0;

        // Add admins
        for (let i = 0; i < adminCount; i++) {
            members.push({
                email: `admin${i + 1}-${generateShortId()}@test.com`,
                displayName: `Admin ${i + 1}`,
                role: 'admin',
                status: 'active'
            });
            index++;
        }

        // Add active members
        for (let i = 0; i < activeCount; i++) {
            members.push({
                email: `member${index + 1}-${generateShortId()}@test.com`,
                displayName: `Member ${index + 1}`,
                role: 'member',
                status: 'active'
            });
            index++;
        }

        // Add pending members
        for (let i = 0; i < pendingCount; i++) {
            members.push({
                email: `pending${index + 1}-${generateShortId()}@test.com`,
                displayName: `Pending ${index + 1}`,
                role: 'member',
                status: 'pending'
            });
            index++;
        }

        return members;
    }

    // Keyboard navigation scenarios
    static get commonTabOrders() {
        return {
            loginForm: [
                '#email-input',
                '#password-input',
                '[data-testid="remember-me-checkbox"]',
                'button[type="submit"]:not([data-testid])',
                'button:has-text("Forgot")',
                '[data-testid="loginpage-signup-button"]'
            ],
            registrationForm: [
                '#fullname-input',
                '#email-input',
                '#password-input',
                '#confirm-password-input',
                '[data-testid="terms-checkbox"]',
                '[data-testid="cookies-checkbox"]',
                'button[type="submit"]:not([data-testid])'
            ],
            groupForm: [
                '#group-name',
                '#group-description',
                '#create-group',
                '#cancel-group'
            ]
        };
    }
}