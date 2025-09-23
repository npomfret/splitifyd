import { describe, test, expect, beforeEach } from 'vitest';
import { StubAuthService } from '../mocks/firestore-stubs';

/**
 * Unit tests for security validation logic converted from integration tests
 * These tests focus on token validation and input sanitization without requiring Firebase Auth
 */
describe('Security Validation - Token and Input Validation', () => {
    let stubAuthService: StubAuthService;

    beforeEach(() => {
        stubAuthService = new StubAuthService();
    });

    describe('Authentication Token Validation', () => {
        test('should reject malformed JWT tokens', async () => {
            const malformedTokens = [
                'not-a-jwt-token',
                'Bearer invalid',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
                'header.payload.invalid-signature',
                '',
                '   ',
                'null',
                'undefined'
            ];

            for (const token of malformedTokens) {
                await expect(
                    stubAuthService.verifyIdToken(token)
                ).rejects.toThrow(/Invalid ID token/);
            }
        });

        test('should reject expired tokens', async () => {
            // Mock expired token (from 2020)
            const expiredToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyN2JmNDk2MmJkY2ZlODdlOGQ1ZWNhM2Y3N2JjOWZjYzA0OWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vc3BsaXRpZnlkIiwiYXVkIjoic3BsaXRpZnlkIiwiYXV0aF90aW1lIjoxNjA5NDU5MjAwLCJ1c2VyX2lkIjoidGVzdC11c2VyIiwic3ViIjoidGVzdC11c2VyIiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE2MDk0NjI4MDB9.invalid-signature';

            await expect(
                stubAuthService.verifyIdToken(expiredToken)
            ).rejects.toThrow(/Invalid ID token/);
        });

        test('should reject tokens with wrong audience/project', async () => {
            const wrongProjectToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyN2JmNDk2MmJkY2ZlODdlOGQ1ZWNhM2Y3N2JjOWZjYzA0OWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vd3JvbmctcHJvamVjdCIsImF1ZCI6Indyb25nLXByb2plY3QiLCJhdXRoX3RpbWUiOjE2MDk0NTkyMDAsInVzZXJfaWQiOiJ0ZXN0LXVzZXIiLCJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MDk0NTkyMDAsImV4cCI6OTk5OTk5OTk5OX0.invalid-signature';

            await expect(
                stubAuthService.verifyIdToken(wrongProjectToken)
            ).rejects.toThrow(/Invalid ID token/);
        });

        test('should accept valid token format', async () => {
            const validToken = 'valid-test-token';
            const mockDecodedToken = {
                uid: 'test-user-123',
                email: 'test@example.com',
                iss: 'https://securetoken.google.com/splitifyd',
                aud: 'splitifyd',
                auth_time: Date.now() / 1000,
                user_id: 'test-user-123',
                sub: 'test-user-123',
                iat: Date.now() / 1000,
                exp: (Date.now() / 1000) + 3600,
                firebase: {
                    identities: {},
                    sign_in_provider: 'password'
                }
            };

            stubAuthService.setDecodedToken(validToken, mockDecodedToken);

            const result = await stubAuthService.verifyIdToken(validToken);
            expect(result).toEqual(mockDecodedToken);
        });
    });

    describe('Input Injection Attack Prevention', () => {
        test('should reject SQL injection attempts in authorization header', () => {
            const sqlInjectionTokens = [
                "'; DROP TABLE users; --",
                "' OR '1'='1",
                "admin'/*",
                "1' UNION SELECT * FROM secrets--"
            ];

            for (const token of sqlInjectionTokens) {
                // These should be treated as invalid tokens
                expect(() => validateAuthorizationHeader(token)).toThrow(/invalid.*token/i);
            }
        });

        test('should reject script injection attempts in authorization header', () => {
            const scriptInjectionTokens = [
                '<script>alert("xss")</script>',
                'javascript:alert(1)',
                'vbscript:msgbox(1)',
                'data:text/html,<script>alert(1)</script>'
            ];

            for (const token of scriptInjectionTokens) {
                // These should be treated as invalid tokens
                expect(() => validateAuthorizationHeader(token)).toThrow(/invalid.*token/i);
            }
        });

        test('should sanitize special characters in input fields', () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                'javascript:void(0)',
                'onload="alert(1)"',
                '${7*7}',
                '{{7*7}}',
                '<!--#exec cmd="/bin/bash"-->',
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32\\cmd.exe'
            ];

            for (const input of maliciousInputs) {
                const sanitized = sanitizeInput(input);
                expect(sanitized).not.toContain('<script>');
                expect(sanitized).not.toContain('javascript:');
                expect(sanitized).not.toContain('onload=');
                expect(sanitized).not.toMatch(/\$\{.*\}/);
                expect(sanitized).not.toMatch(/\{\{.*\}\}/);
                expect(sanitized).not.toContain('<!--');
                expect(sanitized).not.toContain('../');
                expect(sanitized).not.toContain('..\\');
            }
        });
    });

    describe('Request Parameter Validation', () => {
        test('should reject negative amounts in expense data', () => {
            const invalidExpenseData = {
                groupId: 'test-group',
                amount: -100,
                description: 'Test',
                paidBy: 'user-123',
                participants: ['user-123']
            };

            expect(() => validateExpenseData(invalidExpenseData)).toThrow(/amount.*positive/i);
        });

        test('should reject empty required fields', () => {
            const invalidExpenseData = {
                groupId: '',
                amount: 100,
                description: '',
                paidBy: '',
                participants: []
            };

            expect(() => validateExpenseData(invalidExpenseData)).toThrow(/required.*field/i);
        });

        test('should reject excessively long string inputs', () => {
            const longString = 'a'.repeat(10001); // Over 10k characters

            const invalidData = {
                groupId: 'test-group',
                amount: 100,
                description: longString, // Too long
                paidBy: 'user-123',
                participants: ['user-123']
            };

            expect(() => validateExpenseData(invalidData)).toThrow(/description.*too.*long/i);
        });

        test('should accept valid expense data', () => {
            const validExpenseData = {
                groupId: 'test-group-123',
                amount: 100.50,
                description: 'Valid expense description',
                paidBy: 'user-123',
                participants: ['user-123', 'user-456']
            };

            expect(() => validateExpenseData(validExpenseData)).not.toThrow();
        });
    });

    describe('Permission Object Validation', () => {
        test('should reject null permission objects', () => {
            expect(() => validatePermissions(null)).toThrow(/permissions.*required/i);
        });

        test('should reject permission objects with invalid enum values', () => {
            const invalidPermissions = {
                expenseEditing: 'invalid-value',
                expenseDeletion: 'anyone',
                memberInvitation: 'anyone',
                memberApproval: 'automatic',
                settingsManagement: 'anyone'
            };

            expect(() => validatePermissions(invalidPermissions)).toThrow(/invalid.*permission.*value/i);
        });

        test('should accept valid permission configurations', () => {
            const validPermissions = {
                expenseEditing: 'anyone',
                expenseDeletion: 'owner-and-admin',
                memberInvitation: 'admin-only',
                memberApproval: 'admin-required',
                settingsManagement: 'admin-only'
            };

            expect(() => validatePermissions(validPermissions)).not.toThrow();
        });
    });

    describe('Rate Limiting and Resource Protection', () => {
        test('should detect rapid successive requests from same user', () => {
            const userId = 'test-user-123';
            const rateLimiter = new MockRateLimiter();

            // Simulate 5 rapid requests
            for (let i = 0; i < 5; i++) {
                rateLimiter.recordRequest(userId);
            }

            // 6th request should be rate limited
            expect(() => rateLimiter.checkRateLimit(userId)).toThrow(/rate.*limit.*exceeded/i);
        });

        test('should allow requests within rate limit', () => {
            const userId = 'test-user-123';
            const rateLimiter = new MockRateLimiter();

            // Simulate 2 requests (within limit)
            rateLimiter.recordRequest(userId);
            rateLimiter.recordRequest(userId);

            expect(() => rateLimiter.checkRateLimit(userId)).not.toThrow();
        });

        test('should handle different users independently', () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const rateLimiter = new MockRateLimiter();

            // User 1 makes max requests
            for (let i = 0; i < 5; i++) {
                rateLimiter.recordRequest(user1);
            }

            // User 2 should still be allowed
            rateLimiter.recordRequest(user2);
            expect(() => rateLimiter.checkRateLimit(user2)).not.toThrow();

            // But user 1 should be blocked
            expect(() => rateLimiter.checkRateLimit(user1)).toThrow(/rate.*limit.*exceeded/i);
        });
    });
});

// Helper functions that would typically be in security utility modules

function validateAuthorizationHeader(token: string): void {
    if (!token || typeof token !== 'string') {
        throw new Error('Invalid token format');
    }

    // Check for obvious injection attempts
    const suspiciousPatterns = [
        /[<>]/,  // HTML tags
        /javascript:/i,
        /vbscript:/i,
        /data:/i,
        /['";]/,  // SQL injection characters
        /\$\{.*\}/,  // Template injection
        /\{\{.*\}\}/,  // Template injection
        /<!--/,  // HTML comments
        /\.\.\//,  // Path traversal
        /\.\.\\/,  // Path traversal (Windows)
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(token)) {
            throw new Error('Invalid token format - potential injection detected');
        }
    }
}

function sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
        return '';
    }

    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')  // Remove script tags
        .replace(/javascript:/gi, '')  // Remove javascript: protocol
        .replace(/onload=/gi, '')  // Remove onload handlers
        .replace(/\$\{.*?\}/g, '')  // Remove template literals
        .replace(/\{\{.*?\}\}/g, '')  // Remove handlebars/vue templates
        .replace(/<!--.*?-->/g, '')  // Remove HTML comments
        .replace(/\.\.\//g, '')  // Remove path traversal
        .replace(/\.\.\\/g, '')  // Remove path traversal (Windows)
        .trim();
}

function validateExpenseData(data: any): void {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid expense data format');
    }

    // Check required fields
    const requiredFields = ['groupId', 'amount', 'description', 'paidBy', 'participants'];
    for (const field of requiredFields) {
        if (!data[field] || (Array.isArray(data[field]) && data[field].length === 0)) {
            throw new Error(`Required field missing: ${field}`);
        }
    }

    // Validate amount
    if (typeof data.amount !== 'number' || data.amount <= 0) {
        throw new Error('Amount must be a positive number');
    }

    // Validate string lengths
    if (data.description && data.description.length > 10000) {
        throw new Error('Description is too long (max 10000 characters)');
    }
}

function validatePermissions(permissions: any): void {
    if (!permissions || typeof permissions !== 'object') {
        throw new Error('Permissions object is required');
    }

    const validValues = ['anyone', 'owner-and-admin', 'admin-only', 'admin-required', 'automatic'];
    const permissionFields = ['expenseEditing', 'expenseDeletion', 'memberInvitation', 'memberApproval', 'settingsManagement'];

    for (const field of permissionFields) {
        if (permissions[field] && !validValues.includes(permissions[field])) {
            throw new Error(`Invalid permission value for ${field}: ${permissions[field]}`);
        }
    }
}

// Mock rate limiter for testing
class MockRateLimiter {
    private requests = new Map<string, number>();
    private readonly maxRequests = 5;

    recordRequest(userId: string): void {
        const current = this.requests.get(userId) || 0;
        this.requests.set(userId, current + 1);
    }

    checkRateLimit(userId: string): void {
        const requestCount = this.requests.get(userId) || 0;
        if (requestCount >= this.maxRequests) {
            throw new Error('Rate limit exceeded');
        }
    }
}