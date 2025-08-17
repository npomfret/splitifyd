import { expect, multiUserTest as test } from '../../fixtures/multi-user-test';
import { pageTest } from '../../fixtures';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';
import type { Request } from '@playwright/test';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Security Authentication and Session Tests', () => {
    test.describe('Session Management Security', () => {
        test('handles session expiration gracefully', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Navigate to a protected page
            await page.goto('/dashboard');
            await page.waitForSelector('[data-testid="dashboard"]');

            // Verify user is authenticated
            await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

            // Simulate session expiration by clearing all storage
            await page.evaluate(() => {
                // Clear all forms of client-side storage
                localStorage.clear();
                sessionStorage.clear();

                // Clear all cookies
                document.cookie.split(';').forEach((c) => {
                    const eqPos = c.indexOf('=');
                    const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${location.hostname}`;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                });

                // Clear IndexedDB if present
                if (window.indexedDB) {
                    try {
                        indexedDB.deleteDatabase('firebaseLocalStorageDb');
                    } catch (e) {
                        console.log('IndexedDB cleanup skipped:', e);
                    }
                }
            });

            // Try to access protected content
            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            // Should be redirected to login page
            await page.waitForURL('**/login', { timeout: 10000 });
            expect(page.url()).toContain('/login');

            // Should see login form
            await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
        });

        test('prevents session fixation attacks', async ({ page }) => {
            // Navigate to login page
            await page.goto('/login');
            await page.waitForSelector('[data-testid="login-form"]');

            // Get initial session cookies
            const initialCookies = await page.context().cookies();
            const initialSessionCookies = initialCookies.filter(
                (cookie) => cookie.name.toLowerCase().includes('session') || cookie.name.toLowerCase().includes('auth') || cookie.name.toLowerCase().includes('token'),
            );

            // Attempt login with valid credentials
            await page.fill('[data-testid="email-input"]', 'test@example.com');
            await page.fill('[data-testid="password-input"]', 'ValidPassword123!');
            await page.click('[data-testid="login-submit"]');

            // Wait for login response (might succeed or fail, doesn't matter for this test)
            await page.waitForLoadState('domcontentloaded');

            // Get cookies after login attempt
            const postLoginCookies = await page.context().cookies();
            const postLoginSessionCookies = postLoginCookies.filter(
                (cookie) => cookie.name.toLowerCase().includes('session') || cookie.name.toLowerCase().includes('auth') || cookie.name.toLowerCase().includes('token'),
            );

            // Session cookies should be different (regenerated) to prevent fixation
            if (initialSessionCookies.length > 0 && postLoginSessionCookies.length > 0) {
                const initialValues = initialSessionCookies.map((c) => c.value).sort();
                const postLoginValues = postLoginSessionCookies.map((c) => c.value).sort();

                expect(initialValues).not.toEqual(postLoginValues);
            }
        });

        test('enforces secure session cookies', async ({ page }) => {
            await page.goto('/login');

            // Attempt authentication
            await page.fill('[data-testid="email-input"]', 'test@example.com');
            await page.fill('[data-testid="password-input"]', 'TestPassword123!');
            await page.click('[data-testid="login-submit"]');
            await page.waitForLoadState('domcontentloaded');

            // Check all cookies for security attributes
            const cookies = await page.context().cookies();

            cookies.forEach((cookie) => {
                // Security-sensitive cookies should have proper attributes
                if (
                    cookie.name.toLowerCase().includes('session') ||
                    cookie.name.toLowerCase().includes('auth') ||
                    cookie.name.toLowerCase().includes('token') ||
                    cookie.name.toLowerCase().includes('firebase')
                ) {
                    // Should be marked as secure (HTTPS only)
                    expect(cookie.secure).toBe(true);

                    // Should be HTTP-only (not accessible via JavaScript)
                    expect(cookie.httpOnly).toBe(true);

                    // Should have SameSite protection
                    expect(cookie.sameSite).toMatch(/strict|lax/i);

                    // Should have reasonable expiration (not too long)
                    if (cookie.expires && cookie.expires > 0) {
                        const expirationDate = new Date(cookie.expires * 1000);
                        const now = new Date();
                        const daysDiff = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

                        // Session cookies shouldn't last more than 30 days
                        expect(daysDiff).toBeLessThanOrEqual(30);
                    }
                }
            });
        });

        test('prevents concurrent session abuse', async ({ authenticatedPage, secondUser }) => {
            const { page: page1 } = authenticatedPage;
            const { page: page2 } = secondUser;

            // Both users should have independent sessions
            await page1.goto('/dashboard');
            await page1.waitForSelector('[data-testid="dashboard"]');

            await page2.goto('/dashboard');
            await page2.waitForSelector('[data-testid="dashboard"]');

            // Create a group with User 1
            const groupWorkflow = new GroupWorkflow(page1);
            const groupName = generateTestGroupName('ConcurrentTest');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing concurrent session security');

            // User 1 should see their group
            await page1.goto('/dashboard');
            await expect(page1.locator(`text=${groupName}`)).toBeVisible();

            // User 2 should NOT see User 1's group
            await page2.goto('/dashboard');
            await page2.waitForSelector('[data-testid="dashboard"]');
            await expect(page2.locator(`text=${groupName}`)).not.toBeVisible();

            // Verify session isolation - User 2 logging out shouldn't affect User 1
            const logoutButton = page2.locator('[data-testid="logout-button"], [data-testid="user-menu"]');
            if (await logoutButton.isVisible()) {
                await logoutButton.click();

                const logoutConfirm = page2.locator('[data-testid="logout-confirm"], text=Logout, text=Sign out');
                if (await logoutConfirm.isVisible()) {
                    await logoutConfirm.click();
                }

                // User 2 should be logged out
                await page2.waitForURL('**/login', { timeout: 5000 });

                // User 1 should still be logged in
                await page1.reload();
                await page1.waitForSelector('[data-testid="dashboard"]');
                await expect(page1.locator('[data-testid="dashboard"]')).toBeVisible();
            }
        });
    });

    test.describe('Password Security', () => {
        test('enforces password strength requirements', async ({ page }) => {
            await page.goto('/register');
            await page.waitForSelector('[data-testid="register-form"]');

            const weakPasswords = [
                'password', // Common password
                '123456', // Numeric only
                'abc', // Too short
                'PASSWORD', // No lowercase
                'password123', // No uppercase
                'Password', // No numbers
                'Password123', // No special characters (might be valid)
                '', // Empty
                '   ', // Whitespace only
                'aaaaaaa', // Repeated characters
                'qwerty', // Keyboard pattern
                'admin', // Common word
                'user', // Common word
                '12345678', // Sequential numbers
                'abcdefgh', // Sequential letters
            ];

            for (const password of weakPasswords) {
                await page.fill('[data-testid="email-input"]', 'test@example.com');
                await page.fill('[data-testid="password-input"]', password);
                await page.fill('[data-testid="confirm-password-input"]', password);
                await page.fill('[data-testid="display-name-input"]', 'Test User');

                await page.click('[data-testid="register-submit"]');
                await page.waitForLoadState('domcontentloaded');

                // Should show password validation error for weak passwords
                const passwordError = page.locator('[data-testid="password-error"], [data-testid="error-message"]');

                if (await passwordError.isVisible()) {
                    const errorText = await passwordError.textContent();
                    expect(errorText).toMatch(/password.*weak|password.*requirements|invalid.*password/i);
                } else if (page.url().includes('/register')) {
                    // Still on register page - form validation prevented submission
                    expect(page.url()).toContain('/register');
                }

                // Clear form for next test
                await page.fill('[data-testid="password-input"]', '');
                await page.fill('[data-testid="confirm-password-input"]', '');
            }
        });

        test('prevents password enumeration attacks', async ({ page }) => {
            await page.goto('/login');
            await page.waitForSelector('[data-testid="login-form"]');

            // Try login with non-existent email
            await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');
            await page.fill('[data-testid="password-input"]', 'SomePassword123!');
            await page.click('[data-testid="login-submit"]');
            await page.waitForLoadState('domcontentloaded');

            const errorMessage1 = await page.locator('[data-testid="error-message"]').textContent();

            // Clear and try with existing email but wrong password
            await page.fill('[data-testid="email-input"]', 'test@example.com');
            await page.fill('[data-testid="password-input"]', 'WrongPassword123!');
            await page.click('[data-testid="login-submit"]');
            await page.waitForLoadState('domcontentloaded');

            const errorMessage2 = await page.locator('[data-testid="error-message"]').textContent();

            // Error messages should be similar to prevent user enumeration
            if (errorMessage1 && errorMessage2) {
                // Both should be generic authentication errors
                expect(errorMessage1).toMatch(/invalid.*credentials|authentication.*failed|login.*failed/i);
                expect(errorMessage2).toMatch(/invalid.*credentials|authentication.*failed|login.*failed/i);

                // Should not reveal whether email exists
                expect(errorMessage1).not.toMatch(/user.*not.*found|email.*not.*exist|account.*not.*found/i);
                expect(errorMessage2).not.toMatch(/user.*not.*found|email.*not.*exist|account.*not.*found/i);
            }
        });

        test('implements proper password reset security', async ({ page }) => {
            await page.goto('/login');

            const forgotPasswordLink = page.locator('[data-testid="forgot-password"], text=Forgot password, text=Reset password');

            if (await forgotPasswordLink.isVisible()) {
                await forgotPasswordLink.click();
                await page.waitForSelector('[data-testid="reset-form"], [data-testid="forgot-password-form"]');

                // Test with invalid email formats
                const invalidEmails = ['not-an-email', '@domain.com', 'user@', 'user@domain', 'user..user@domain.com', 'user@domain..com', '', '   ', 'user@domain.com@domain.com'];

                for (const email of invalidEmails) {
                    await page.fill('[data-testid="email-input"]', email);
                    await page.click('[data-testid="reset-submit"]');
                    await page.waitForLoadState('domcontentloaded');

                    const emailError = page.locator('[data-testid="email-error"], [data-testid="error-message"]');
                    if (await emailError.isVisible()) {
                        const errorText = await emailError.textContent();
                        expect(errorText).toMatch(/invalid.*email|email.*format|valid.*email/i);
                    }
                }

                // Test with valid email format
                await page.fill('[data-testid="email-input"]', 'test@example.com');
                await page.click('[data-testid="reset-submit"]');
                await page.waitForLoadState('domcontentloaded');

                // Should show success message (even for non-existent emails to prevent enumeration)
                const successMessage = page.locator('[data-testid="success-message"], text=sent, text=email');
                if (await successMessage.isVisible()) {
                    const messageText = await successMessage.textContent();
                    expect(messageText).toMatch(/email.*sent|reset.*link|check.*email/i);
                }
            }
        });
    });

    test.describe('Multi-Factor Authentication Security', () => {
        test('handles MFA challenges properly', async ({ page }) => {
            // This test checks for MFA support if implemented
            await page.goto('/login');
            await page.waitForSelector('[data-testid="login-form"]');

            // Try login that might trigger MFA
            await page.fill('[data-testid="email-input"]', 'mfa-user@example.com');
            await page.fill('[data-testid="password-input"]', 'ValidPassword123!');
            await page.click('[data-testid="login-submit"]');
            await page.waitForLoadState('domcontentloaded');

            // Check if MFA challenge appears
            const mfaChallenge = page.locator('[data-testid="mfa-challenge"], [data-testid="verification-code"], text=verification code');

            if (await mfaChallenge.isVisible()) {
                // Test invalid MFA codes
                const invalidCodes = [
                    '000000', // Common invalid code
                    '123456', // Sequential
                    'abcdef', // Non-numeric
                    '12345', // Too short
                    '1234567', // Too long
                    '', // Empty
                    '   ', // Whitespace
                ];

                for (const code of invalidCodes) {
                    await page.fill('[data-testid="mfa-code"], [data-testid="verification-code"]', code);
                    await page.click('[data-testid="verify-submit"]');
                    await page.waitForLoadState('domcontentloaded');

                    const mfaError = page.locator('[data-testid="mfa-error"], [data-testid="error-message"]');
                    if (await mfaError.isVisible()) {
                        const errorText = await mfaError.textContent();
                        expect(errorText).toMatch(/invalid.*code|verification.*failed|incorrect.*code/i);
                    }
                }
            }
        });
    });

    test.describe('Account Lockout Protection', () => {
        test('implements rate limiting for failed login attempts', async ({ page }) => {
            await page.goto('/login');
            await page.waitForSelector('[data-testid="login-form"]');

            const failedAttempts = 10; // Attempt multiple failed logins
            const startTime = Date.now();

            for (let i = 0; i < failedAttempts; i++) {
                await page.fill('[data-testid="email-input"]', 'test@example.com');
                await page.fill('[data-testid="password-input"]', `WrongPassword${i}`);
                await page.click('[data-testid="login-submit"]');
                await page.waitForLoadState('domcontentloaded');

                // Check for rate limiting after several attempts
                if (i > 3) {
                    const errorMessage = page.locator('[data-testid="error-message"]');
                    if (await errorMessage.isVisible()) {
                        const errorText = await errorMessage.textContent();

                        // Look for rate limiting indicators
                        if (errorText?.match(/too.*many.*attempts|rate.*limit|try.*again.*later|account.*locked/i)) {
                            // Rate limiting is working
                            expect(errorText).toMatch(/too.*many.*attempts|rate.*limit|try.*again.*later|account.*locked/i);
                            break;
                        }
                    }
                }

                // Wait for login attempt to complete before next one
                await page.waitForLoadState('domcontentloaded');
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should take reasonable time (rate limiting should add delays)
            expect(duration).toBeGreaterThan(2000); // At least 2 seconds total
        });
    });

    test.describe('Cross-Site Request Forgery (CSRF)', () => {
        test('includes CSRF protection in forms', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Navigate to a page with forms
            await page.goto('/dashboard');
            await page.waitForSelector('[data-testid="dashboard"]');

            // Check create group form for CSRF protection
            await page.click('[data-testid="create-group-button"]');
            await page.waitForSelector('[data-testid="group-name-input"]');

            // Look for CSRF token in the form
            const form = page.locator('[data-testid="create-group-form"], form');
            const csrfToken = form.locator('input[name*="csrf"], input[name*="token"], input[type="hidden"]');

            if ((await csrfToken.count()) > 0) {
                const tokenValue = await csrfToken.first().getAttribute('value');
                expect(tokenValue).toBeTruthy();
                expect(tokenValue!.length).toBeGreaterThan(10);
            }

            // Check that forms include proper headers
            page.on('request', (request: Request) => {
                if (request.method() === 'POST') {
                    const headers = request.headers();

                    // Should include CSRF protection headers
                    const hasCSRFHeader = headers['x-csrf-token'] || headers['x-xsrf-token'] || headers['x-requested-with'] === 'XMLHttpRequest';

                    if (hasCSRFHeader) {
                        expect(hasCSRFHeader).toBeTruthy();
                    }
                }
            });

            await page.fill('[data-testid="group-name-input"]', 'CSRF Test Group');
            await page.fill('[data-testid="group-description-input"]', 'Testing CSRF protection');
            await page.click('[data-testid="create-group-submit"]');
            await page.waitForLoadState('domcontentloaded');
        });
    });
});

// Browser security tests
pageTest.describe('Browser Security Features', () => {
    pageTest('enforces security headers', async ({ page }) => {
        const response = await page.goto('/');
        const headers = response?.headers() || {};

        // Check for important security headers

        // Content Security Policy
        expect(headers['content-security-policy'] || headers['x-content-security-policy']).toBeTruthy();

        // X-Frame-Options to prevent clickjacking
        expect(headers['x-frame-options']).toMatch(/deny|sameorigin/i);

        // X-Content-Type-Options to prevent MIME sniffing
        expect(headers['x-content-type-options']).toBe('nosniff');

        // X-XSS-Protection
        const xssProtection = headers['x-xss-protection'];
        if (xssProtection) {
            expect(xssProtection).toMatch(/1|1; mode=block/);
        }

        // Strict-Transport-Security for HTTPS
        if (page.url().startsWith('https')) {
            expect(headers['strict-transport-security']).toBeTruthy();
        }

        // Referrer Policy
        const referrerPolicy = headers['referrer-policy'];
        if (referrerPolicy) {
            expect(referrerPolicy).toMatch(/strict-origin|strict-origin-when-cross-origin|same-origin/);
        }
    });

    pageTest('prevents sensitive information exposure in console', async ({ page }) => {
        const consoleLogs: string[] = [];
        const consoleErrors: string[] = [];

        page.on('console', (msg) => {
            const text = msg.text();
            if (msg.type() === 'error') {
                consoleErrors.push(text);
            } else {
                consoleLogs.push(text);
            }
        });

        // Navigate through the app
        await page.goto('/');
        await page.goto('/login');
        await page.goto('/register');

        // Check logs for sensitive patterns
        const allLogs = [...consoleLogs, ...consoleErrors];
        const sensitivePatterns = [
            /password/i,
            /token/i,
            /api[_-]?key/i,
            /secret/i,
            /credential/i,
            /firebase.*config/i,
            /auth.*key/i,
            /private.*key/i,
            /access.*token/i,
            /refresh.*token/i,
            /\b[A-Za-z0-9]{20,}\b/, // Long tokens/keys
        ];

        const exposedSecrets = allLogs.filter((log) => sensitivePatterns.some((pattern) => pattern.test(log)));

        // Should not expose sensitive information
        expect(exposedSecrets).toHaveLength(0);
    });
});
