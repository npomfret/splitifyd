import { describe, expect, it } from 'vitest';
import { EmailTemplateService, type PasswordResetEmailVariables } from '../../../../services/email/EmailTemplateService';

describe('EmailTemplateService', () => {
    const service = new EmailTemplateService();

    const defaultVariables: PasswordResetEmailVariables = {
        appName: 'TestApp',
        domain: 'example.com',
        resetLink: 'https://example.com/__/auth/action?mode=resetPassword&oobCode=abc123',
        supportEmail: 'support@example.com',
    };

    describe('generatePasswordResetEmail', () => {
        it('generates email with all required parts', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('textBody');
            expect(result).toHaveProperty('htmlBody');
        });

        it('interpolates appName in subject', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            expect(result.subject).toContain('TestApp');
        });

        it('interpolates all variables in text body', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            expect(result.textBody).toContain('TestApp');
            expect(result.textBody).toContain('example.com');
            expect(result.textBody).toContain(defaultVariables.resetLink);
            expect(result.textBody).toContain('support@example.com');
        });

        it('interpolates all variables in HTML body', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            expect(result.htmlBody).toContain('TestApp');
            expect(result.htmlBody).toContain('example.com');
            // URL ampersands are escaped in HTML
            expect(result.htmlBody).toContain('mode=resetPassword&amp;oobCode=abc123');
            expect(result.htmlBody).toContain('support@example.com');
        });

        it('generates valid HTML structure', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            expect(result.htmlBody).toContain('<!DOCTYPE html>');
            expect(result.htmlBody).toContain('<html>');
            expect(result.htmlBody).toContain('</html>');
            expect(result.htmlBody).toContain('<body');
            expect(result.htmlBody).toContain('</body>');
        });

        it('includes reset link as clickable button in HTML', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            // URL ampersands are escaped in HTML href attributes
            const escapedLink = defaultVariables.resetLink.replace(/&/g, '&amp;');
            expect(result.htmlBody).toContain(`href="${escapedLink}"`);
        });

        it('includes mailto link for support email in HTML', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            expect(result.htmlBody).toContain('mailto:support@example.com');
        });
    });

    describe('HTML escaping (XSS prevention)', () => {
        it('escapes HTML special characters in appName', () => {
            const xssVariables: PasswordResetEmailVariables = {
                ...defaultVariables,
                appName: '<script>alert("xss")</script>',
            };

            const result = service.generatePasswordResetEmail(xssVariables);

            expect(result.htmlBody).not.toContain('<script>');
            expect(result.htmlBody).toContain('&lt;script&gt;');
        });

        it('escapes HTML special characters in domain', () => {
            const xssVariables: PasswordResetEmailVariables = {
                ...defaultVariables,
                domain: '<img src=x onerror=alert(1)>',
            };

            const result = service.generatePasswordResetEmail(xssVariables);

            expect(result.htmlBody).not.toContain('<img');
            expect(result.htmlBody).toContain('&lt;img');
        });

        it('escapes HTML special characters in supportEmail', () => {
            const xssVariables: PasswordResetEmailVariables = {
                ...defaultVariables,
                supportEmail: '"><script>alert(1)</script>@evil.com',
            };

            const result = service.generatePasswordResetEmail(xssVariables);

            expect(result.htmlBody).not.toContain('"><script>');
            expect(result.htmlBody).toContain('&quot;&gt;&lt;script&gt;');
        });

        it('escapes quotes in href attributes', () => {
            const xssVariables: PasswordResetEmailVariables = {
                ...defaultVariables,
                resetLink: 'javascript:alert("xss")',
            };

            const result = service.generatePasswordResetEmail(xssVariables);

            expect(result.htmlBody).toContain('href="javascript:alert(&quot;xss&quot;)"');
        });

        it('escapes ampersands correctly', () => {
            const variables: PasswordResetEmailVariables = {
                ...defaultVariables,
                appName: 'Tom & Jerry',
            };

            const result = service.generatePasswordResetEmail(variables);

            expect(result.htmlBody).toContain('Tom &amp; Jerry');
        });

        it('escapes single quotes', () => {
            const variables: PasswordResetEmailVariables = {
                ...defaultVariables,
                appName: "Tom's App",
            };

            const result = service.generatePasswordResetEmail(variables);

            expect(result.htmlBody).toContain("Tom&#x27;s App");
        });
    });

    describe('text body formatting', () => {
        it('includes reset link on its own line', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);
            const lines = result.textBody.split('\n');

            const linkLine = lines.find(line => line.includes(defaultVariables.resetLink));
            expect(linkLine).toBeDefined();
        });

        it('includes expiry notice', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            expect(result.textBody).toMatch(/expire|hour/i);
        });

        it('includes ignore notice', () => {
            const result = service.generatePasswordResetEmail(defaultVariables);

            expect(result.textBody).toMatch(/ignore|didn't request/i);
        });
    });

    describe('caching', () => {
        it('returns consistent results for same language', () => {
            const service1 = new EmailTemplateService();

            const result1 = service1.generatePasswordResetEmail(defaultVariables, 'en');
            const result2 = service1.generatePasswordResetEmail(defaultVariables, 'en');

            expect(result1.subject).toBe(result2.subject);
            expect(result1.textBody).toBe(result2.textBody);
            expect(result1.htmlBody).toBe(result2.htmlBody);
        });
    });

    describe('fallback behavior', () => {
        it('uses fallback translations for non-existent language', () => {
            const result = service.generatePasswordResetEmail(defaultVariables, 'xx-nonexistent');

            expect(result.subject).toContain('TestApp');
            expect(result.textBody).toContain('Reset Password');
        });
    });
});
