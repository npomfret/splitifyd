import { EmailChangeEmailVariablesBuilder, EmailVerificationEmailVariablesBuilder, PasswordResetEmailVariablesBuilder, WelcomeEmailVariablesBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';
import { EmailTemplateService } from '../../../../services/email/EmailTemplateService';

describe('EmailTemplateService', () => {
    const service = new EmailTemplateService();

    describe('generatePasswordResetEmail', () => {
        it('generates email with all required parts', () => {
            const result = service.generatePasswordResetEmail(new PasswordResetEmailVariablesBuilder().build());

            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('textBody');
            expect(result).toHaveProperty('htmlBody');
        });

        it('interpolates appName in subject', () => {
            const variables = new PasswordResetEmailVariablesBuilder().build();
            const result = service.generatePasswordResetEmail(variables);

            expect(result.subject).toContain(variables.appName);
        });

        it('interpolates all variables in text body', () => {
            const variables = new PasswordResetEmailVariablesBuilder().build();
            const result = service.generatePasswordResetEmail(variables);

            expect(result.textBody).toContain(variables.appName);
            expect(result.textBody).toContain(variables.domain);
            expect(result.textBody).toContain(variables.resetLink);
        });

        it('interpolates all variables in HTML body', () => {
            const variables = new PasswordResetEmailVariablesBuilder().build();
            const result = service.generatePasswordResetEmail(variables);

            expect(result.htmlBody).toContain(variables.appName);
            expect(result.htmlBody).toContain(variables.domain);
            // URL ampersands are escaped in HTML
            expect(result.htmlBody).toContain('mode=resetPassword&amp;oobCode=abc123');
        });

        it('generates valid HTML structure', () => {
            const result = service.generatePasswordResetEmail(new PasswordResetEmailVariablesBuilder().build());

            expect(result.htmlBody).toContain('<!DOCTYPE html>');
            expect(result.htmlBody).toContain('<html>');
            expect(result.htmlBody).toContain('</html>');
            expect(result.htmlBody).toContain('<body');
            expect(result.htmlBody).toContain('</body>');
        });

        it('includes reset link as clickable button in HTML', () => {
            const variables = new PasswordResetEmailVariablesBuilder().build();
            const result = service.generatePasswordResetEmail(variables);

            // URL ampersands are escaped in HTML href attributes
            const escapedLink = variables.resetLink.replace(/&/g, '&amp;');
            expect(result.htmlBody).toContain(`href="${escapedLink}"`);
        });
    });

    describe('HTML escaping (XSS prevention)', () => {
        it('escapes HTML special characters in appName', () => {
            const variables = new PasswordResetEmailVariablesBuilder()
                .withAppName('<script>alert("xss")</script>')
                .build();

            const result = service.generatePasswordResetEmail(variables);

            expect(result.htmlBody).not.toContain('<script>');
            expect(result.htmlBody).toContain('&lt;script&gt;');
        });

        it('escapes HTML special characters in domain', () => {
            const variables = new PasswordResetEmailVariablesBuilder()
                .withDomain('<img src=x onerror=alert(1)>')
                .build();

            const result = service.generatePasswordResetEmail(variables);

            expect(result.htmlBody).not.toContain('<img');
            expect(result.htmlBody).toContain('&lt;img');
        });

        it('escapes quotes in href attributes', () => {
            const variables = new PasswordResetEmailVariablesBuilder()
                .withResetLink('javascript:alert("xss")')
                .build();

            const result = service.generatePasswordResetEmail(variables);

            expect(result.htmlBody).toContain('href="javascript:alert(&quot;xss&quot;)"');
        });

        it('escapes ampersands correctly', () => {
            const variables = new PasswordResetEmailVariablesBuilder()
                .withAppName('Tom & Jerry')
                .build();

            const result = service.generatePasswordResetEmail(variables);

            expect(result.htmlBody).toContain('Tom &amp; Jerry');
        });

        it('escapes single quotes', () => {
            const variables = new PasswordResetEmailVariablesBuilder()
                .withAppName('Tom\'s App')
                .build();

            const result = service.generatePasswordResetEmail(variables);

            expect(result.htmlBody).toContain('Tom&#x27;s App');
        });
    });

    describe('text body formatting', () => {
        it('includes reset link on its own line', () => {
            const variables = new PasswordResetEmailVariablesBuilder().build();
            const result = service.generatePasswordResetEmail(variables);
            const lines = result.textBody.split('\n');

            const linkLine = lines.find(line => line.includes(variables.resetLink));
            expect(linkLine).toBeDefined();
        });

        it('includes expiry notice', () => {
            const result = service.generatePasswordResetEmail(new PasswordResetEmailVariablesBuilder().build());

            expect(result.textBody).toMatch(/expire|hour/i);
        });

        it('includes ignore notice', () => {
            const result = service.generatePasswordResetEmail(new PasswordResetEmailVariablesBuilder().build());

            expect(result.textBody).toMatch(/ignore|didn't request/i);
        });
    });

    describe('caching', () => {
        it('returns consistent results for same language', () => {
            const service1 = new EmailTemplateService();
            const variables = new PasswordResetEmailVariablesBuilder().build();

            const result1 = service1.generatePasswordResetEmail(variables, 'en');
            const result2 = service1.generatePasswordResetEmail(variables, 'en');

            expect(result1.subject).toBe(result2.subject);
            expect(result1.textBody).toBe(result2.textBody);
            expect(result1.htmlBody).toBe(result2.htmlBody);
        });
    });

    describe('fallback behavior', () => {
        it('uses fallback translations for non-existent language', () => {
            const variables = new PasswordResetEmailVariablesBuilder().build();
            const result = service.generatePasswordResetEmail(variables, 'xx-nonexistent');

            expect(result.subject).toContain(variables.appName);
            expect(result.textBody).toContain('Reset Password');
        });
    });

    describe('generateWelcomeEmail', () => {
        it('generates email with all required parts', () => {
            const result = service.generateWelcomeEmail(new WelcomeEmailVariablesBuilder().build());

            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('textBody');
            expect(result).toHaveProperty('htmlBody');
        });

        it('interpolates appName in subject', () => {
            const variables = new WelcomeEmailVariablesBuilder().build();
            const result = service.generateWelcomeEmail(variables);

            expect(result.subject).toContain(variables.appName);
        });

        it('interpolates all variables in text body', () => {
            const variables = new WelcomeEmailVariablesBuilder().build();
            const result = service.generateWelcomeEmail(variables);

            expect(result.textBody).toContain(variables.appName);
            expect(result.textBody).toContain(variables.displayName);
            expect(result.textBody).toContain(variables.dashboardLink);
        });

        it('interpolates all variables in HTML body', () => {
            const variables = new WelcomeEmailVariablesBuilder().build();
            const result = service.generateWelcomeEmail(variables);

            expect(result.htmlBody).toContain(variables.appName);
            expect(result.htmlBody).toContain(variables.displayName);
        });

        it('generates valid HTML structure', () => {
            const result = service.generateWelcomeEmail(new WelcomeEmailVariablesBuilder().build());

            expect(result.htmlBody).toContain('<!DOCTYPE html>');
            expect(result.htmlBody).toContain('<html>');
            expect(result.htmlBody).toContain('</html>');
            expect(result.htmlBody).toContain('<body');
            expect(result.htmlBody).toContain('</body>');
        });

        it('includes dashboard link as clickable button in HTML', () => {
            const variables = new WelcomeEmailVariablesBuilder().build();
            const result = service.generateWelcomeEmail(variables);

            expect(result.htmlBody).toContain(`href="${variables.dashboardLink}"`);
        });
    });

    describe('welcome email HTML escaping (XSS prevention)', () => {
        it('escapes HTML special characters in appName', () => {
            const variables = new WelcomeEmailVariablesBuilder()
                .withAppName('<script>alert("xss")</script>')
                .build();

            const result = service.generateWelcomeEmail(variables);

            expect(result.htmlBody).not.toContain('<script>');
            expect(result.htmlBody).toContain('&lt;script&gt;');
        });

        it('escapes HTML special characters in displayName', () => {
            const variables = new WelcomeEmailVariablesBuilder()
                .withDisplayName('<img src=x onerror=alert(1)>')
                .build();

            const result = service.generateWelcomeEmail(variables);

            expect(result.htmlBody).not.toContain('<img');
            expect(result.htmlBody).toContain('&lt;img');
        });

        it('escapes quotes in href attributes', () => {
            const variables = new WelcomeEmailVariablesBuilder()
                .withDashboardLink('javascript:alert("xss")')
                .build();

            const result = service.generateWelcomeEmail(variables);

            expect(result.htmlBody).toContain('href="javascript:alert(&quot;xss&quot;)"');
        });

        it('escapes ampersands correctly', () => {
            const variables = new WelcomeEmailVariablesBuilder()
                .withAppName('Tom & Jerry')
                .build();

            const result = service.generateWelcomeEmail(variables);

            expect(result.htmlBody).toContain('Tom &amp; Jerry');
        });

        it('escapes single quotes', () => {
            const variables = new WelcomeEmailVariablesBuilder()
                .withDisplayName('Tom\'s Account')
                .build();

            const result = service.generateWelcomeEmail(variables);

            expect(result.htmlBody).toContain('Tom&#x27;s Account');
        });
    });

    describe('welcome email text body formatting', () => {
        it('includes dashboard link on its own line', () => {
            const variables = new WelcomeEmailVariablesBuilder().build();
            const result = service.generateWelcomeEmail(variables);
            const lines = result.textBody.split('\n');

            const linkLine = lines.find(line => line.includes(variables.dashboardLink));
            expect(linkLine).toBeDefined();
        });

        it('includes welcome message', () => {
            const result = service.generateWelcomeEmail(new WelcomeEmailVariablesBuilder().build());

            expect(result.textBody).toMatch(/welcome|thanks|excited/i);
        });
    });

    describe('welcome email fallback behavior', () => {
        it('uses fallback translations for non-existent language', () => {
            const variables = new WelcomeEmailVariablesBuilder().build();
            const result = service.generateWelcomeEmail(variables, 'xx-nonexistent');

            expect(result.subject).toContain(variables.appName);
            expect(result.textBody).toContain('Get Started');
        });
    });

    describe('generateEmailVerificationEmail', () => {
        it('generates email with all required parts', () => {
            const result = service.generateEmailVerificationEmail(new EmailVerificationEmailVariablesBuilder().build());

            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('textBody');
            expect(result).toHaveProperty('htmlBody');
        });

        it('interpolates appName in subject', () => {
            const variables = new EmailVerificationEmailVariablesBuilder().build();
            const result = service.generateEmailVerificationEmail(variables);

            expect(result.subject).toContain(variables.appName);
        });

        it('interpolates all variables in text body', () => {
            const variables = new EmailVerificationEmailVariablesBuilder().build();
            const result = service.generateEmailVerificationEmail(variables);

            expect(result.textBody).toContain(variables.appName);
            expect(result.textBody).toContain(variables.displayName);
            expect(result.textBody).toContain(variables.verificationLink);
        });

        it('interpolates all variables in HTML body', () => {
            const variables = new EmailVerificationEmailVariablesBuilder().build();
            const result = service.generateEmailVerificationEmail(variables);

            expect(result.htmlBody).toContain(variables.appName);
            expect(result.htmlBody).toContain(variables.displayName);
        });

        it('generates valid HTML structure', () => {
            const result = service.generateEmailVerificationEmail(new EmailVerificationEmailVariablesBuilder().build());

            expect(result.htmlBody).toContain('<!DOCTYPE html>');
            expect(result.htmlBody).toContain('<html>');
            expect(result.htmlBody).toContain('</html>');
            expect(result.htmlBody).toContain('<body');
            expect(result.htmlBody).toContain('</body>');
        });

        it('includes verification link as clickable button in HTML', () => {
            const variables = new EmailVerificationEmailVariablesBuilder().build();
            const result = service.generateEmailVerificationEmail(variables);

            const escapedLink = variables.verificationLink.replace(/&/g, '&amp;');
            expect(result.htmlBody).toContain(`href="${escapedLink}"`);
        });
    });

    describe('verification email HTML escaping (XSS prevention)', () => {
        it('escapes HTML special characters in appName', () => {
            const variables = new EmailVerificationEmailVariablesBuilder()
                .withAppName('<script>alert("xss")</script>')
                .build();

            const result = service.generateEmailVerificationEmail(variables);

            expect(result.htmlBody).not.toContain('<script>');
            expect(result.htmlBody).toContain('&lt;script&gt;');
        });

        it('escapes HTML special characters in displayName', () => {
            const variables = new EmailVerificationEmailVariablesBuilder()
                .withDisplayName('<img src=x onerror=alert(1)>')
                .build();

            const result = service.generateEmailVerificationEmail(variables);

            expect(result.htmlBody).not.toContain('<img');
            expect(result.htmlBody).toContain('&lt;img');
        });

        it('escapes quotes in href attributes', () => {
            const variables = new EmailVerificationEmailVariablesBuilder()
                .withVerificationLink('javascript:alert("xss")')
                .build();

            const result = service.generateEmailVerificationEmail(variables);

            expect(result.htmlBody).toContain('href="javascript:alert(&quot;xss&quot;)"');
        });

        it('escapes ampersands correctly', () => {
            const variables = new EmailVerificationEmailVariablesBuilder()
                .withAppName('Tom & Jerry')
                .build();

            const result = service.generateEmailVerificationEmail(variables);

            expect(result.htmlBody).toContain('Tom &amp; Jerry');
        });

        it('escapes single quotes', () => {
            const variables = new EmailVerificationEmailVariablesBuilder()
                .withDisplayName('Tom\'s Account')
                .build();

            const result = service.generateEmailVerificationEmail(variables);

            expect(result.htmlBody).toContain('Tom&#x27;s Account');
        });
    });

    describe('verification email text body formatting', () => {
        it('includes verification link on its own line', () => {
            const variables = new EmailVerificationEmailVariablesBuilder().build();
            const result = service.generateEmailVerificationEmail(variables);
            const lines = result.textBody.split('\n');

            const linkLine = lines.find(line => line.includes(variables.verificationLink));
            expect(linkLine).toBeDefined();
        });

        it('includes expiry notice', () => {
            const result = service.generateEmailVerificationEmail(new EmailVerificationEmailVariablesBuilder().build());

            expect(result.textBody).toMatch(/expire|hour/i);
        });

        it('includes ignore notice', () => {
            const result = service.generateEmailVerificationEmail(new EmailVerificationEmailVariablesBuilder().build());

            expect(result.textBody).toMatch(/ignore|didn't create/i);
        });
    });

    describe('verification email fallback behavior', () => {
        it('uses fallback translations for non-existent language', () => {
            const variables = new EmailVerificationEmailVariablesBuilder().build();
            const result = service.generateEmailVerificationEmail(variables, 'xx-nonexistent');

            expect(result.subject).toContain(variables.appName);
            expect(result.textBody).toContain('Verify Email');
        });
    });

    describe('generateEmailChangeEmail', () => {
        it('generates email with all required parts', () => {
            const result = service.generateEmailChangeEmail(new EmailChangeEmailVariablesBuilder().build());

            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('textBody');
            expect(result).toHaveProperty('htmlBody');
        });

        it('interpolates appName in subject', () => {
            const variables = new EmailChangeEmailVariablesBuilder().build();
            const result = service.generateEmailChangeEmail(variables);

            expect(result.subject).toContain(variables.appName);
        });

        it('interpolates all variables in text body', () => {
            const variables = new EmailChangeEmailVariablesBuilder().build();
            const result = service.generateEmailChangeEmail(variables);

            expect(result.textBody).toContain(variables.appName);
            expect(result.textBody).toContain(variables.displayName);
            expect(result.textBody).toContain(variables.verificationLink);
        });

        it('interpolates all variables in HTML body', () => {
            const variables = new EmailChangeEmailVariablesBuilder().build();
            const result = service.generateEmailChangeEmail(variables);

            expect(result.htmlBody).toContain(variables.appName);
            expect(result.htmlBody).toContain(variables.displayName);
        });

        it('generates valid HTML structure', () => {
            const result = service.generateEmailChangeEmail(new EmailChangeEmailVariablesBuilder().build());

            expect(result.htmlBody).toContain('<!DOCTYPE html>');
            expect(result.htmlBody).toContain('<html>');
            expect(result.htmlBody).toContain('</html>');
            expect(result.htmlBody).toContain('<body');
            expect(result.htmlBody).toContain('</body>');
        });

        it('includes verification link as clickable button in HTML', () => {
            const variables = new EmailChangeEmailVariablesBuilder().build();
            const result = service.generateEmailChangeEmail(variables);

            const escapedLink = variables.verificationLink.replace(/&/g, '&amp;');
            expect(result.htmlBody).toContain(`href="${escapedLink}"`);
        });
    });

    describe('email change HTML escaping (XSS prevention)', () => {
        it('escapes HTML special characters in appName', () => {
            const variables = new EmailChangeEmailVariablesBuilder()
                .withAppName('<script>alert("xss")</script>')
                .build();

            const result = service.generateEmailChangeEmail(variables);

            expect(result.htmlBody).not.toContain('<script>');
            expect(result.htmlBody).toContain('&lt;script&gt;');
        });

        it('escapes HTML special characters in displayName', () => {
            const variables = new EmailChangeEmailVariablesBuilder()
                .withDisplayName('<img src=x onerror=alert(1)>')
                .build();

            const result = service.generateEmailChangeEmail(variables);

            expect(result.htmlBody).not.toContain('<img');
            expect(result.htmlBody).toContain('&lt;img');
        });

        it('escapes quotes in href attributes', () => {
            const variables = new EmailChangeEmailVariablesBuilder()
                .withVerificationLink('javascript:alert("xss")')
                .build();

            const result = service.generateEmailChangeEmail(variables);

            expect(result.htmlBody).toContain('href="javascript:alert(&quot;xss&quot;)"');
        });

        it('escapes ampersands correctly', () => {
            const variables = new EmailChangeEmailVariablesBuilder()
                .withAppName('Tom & Jerry')
                .build();

            const result = service.generateEmailChangeEmail(variables);

            expect(result.htmlBody).toContain('Tom &amp; Jerry');
        });

        it('escapes single quotes', () => {
            const variables = new EmailChangeEmailVariablesBuilder()
                .withDisplayName('Tom\'s Account')
                .build();

            const result = service.generateEmailChangeEmail(variables);

            expect(result.htmlBody).toContain('Tom&#x27;s Account');
        });
    });

    describe('email change text body formatting', () => {
        it('includes verification link on its own line', () => {
            const variables = new EmailChangeEmailVariablesBuilder().build();
            const result = service.generateEmailChangeEmail(variables);
            const lines = result.textBody.split('\n');

            const linkLine = lines.find(line => line.includes(variables.verificationLink));
            expect(linkLine).toBeDefined();
        });

        it('includes expiry notice', () => {
            const result = service.generateEmailChangeEmail(new EmailChangeEmailVariablesBuilder().build());

            expect(result.textBody).toMatch(/expire|hour/i);
        });

        it('includes ignore notice', () => {
            const result = service.generateEmailChangeEmail(new EmailChangeEmailVariablesBuilder().build());

            expect(result.textBody).toMatch(/ignore|didn't request/i);
        });
    });

    describe('email change fallback behavior', () => {
        it('uses fallback translations for non-existent language', () => {
            const variables = new EmailChangeEmailVariablesBuilder().build();
            const result = service.generateEmailChangeEmail(variables, 'xx-nonexistent');

            expect(result.subject).toContain(variables.appName);
            expect(result.textBody).toContain('Verify New Email');
        });
    });
});
