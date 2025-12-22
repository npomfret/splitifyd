import type { EmailChangeEmailVariables, EmailVerificationEmailVariables, PasswordResetEmailVariables, WelcomeEmailVariables } from '@billsplit-wl/shared';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../../logger';

/**
 * Password reset email template translations
 */
interface PasswordResetEmailTranslations {
    subject: string;
    ignoreNotice: string;
    greeting: string;
    instruction: string;
    buttonText: string;
    linkLabel: string;
    expiryNotice: string;
}

/**
 * Welcome email template translations
 */
interface WelcomeEmailTranslations {
    subject: string;
    greeting: string;
    welcomeMessage: string;
    instruction: string;
    buttonText: string;
}

/**
 * Email verification email template translations
 */
interface EmailVerificationEmailTranslations {
    subject: string;
    ignoreNotice: string;
    greeting: string;
    instruction: string;
    buttonText: string;
    linkLabel: string;
    expiryNotice: string;
}

/**
 * Email change email template translations
 */
interface EmailChangeEmailTranslations {
    subject: string;
    ignoreNotice: string;
    greeting: string;
    instruction: string;
    buttonText: string;
    linkLabel: string;
    expiryNotice: string;
}

/**
 * Generated email content (text and HTML versions)
 */
interface EmailContent {
    subject: string;
    textBody: string;
    htmlBody: string;
}

// Hardcoded fallback if translations can't be loaded
const FALLBACK_PASSWORD_RESET_TRANSLATIONS: PasswordResetEmailTranslations = {
    subject: '{{appName}}: Reset your password',
    ignoreNotice: 'Ignore this email if you didn\'t request a password reset via {{domain}}.',
    greeting: 'Hi there,',
    instruction: 'We received a request to reset your password for your {{appName}} account.',
    buttonText: 'Reset Password',
    linkLabel: 'Or copy and paste this link into your browser:',
    expiryNotice: 'This link will expire in 1 hour.',
};

const FALLBACK_WELCOME_TRANSLATIONS: WelcomeEmailTranslations = {
    subject: 'Welcome to {{appName}}!',
    greeting: 'Hi {{displayName}},',
    welcomeMessage: 'Thanks for signing up for {{appName}}! We\'re excited to have you on board.',
    instruction: 'With {{appName}}, you can easily split expenses with friends, family, and roommates. Create groups, add expenses, and let us calculate who owes what.',
    buttonText: 'Get Started',
};

const FALLBACK_EMAIL_VERIFICATION_TRANSLATIONS: EmailVerificationEmailTranslations = {
    subject: '{{appName}}: Verify your email address',
    ignoreNotice: 'Ignore this email if you didn\'t create an account on {{domain}}.',
    greeting: 'Hi {{displayName}},',
    instruction: 'Please verify your email address to complete your {{appName}} registration.',
    buttonText: 'Verify Email',
    linkLabel: 'Or copy and paste this link into your browser:',
    expiryNotice: 'This link will expire in 24 hours.',
};

const FALLBACK_EMAIL_CHANGE_TRANSLATIONS: EmailChangeEmailTranslations = {
    subject: '{{appName}}: Verify your new email address',
    ignoreNotice: 'Ignore this email if you didn\'t request an email change on {{domain}}.',
    greeting: 'Hi {{displayName}},',
    instruction: 'We received a request to change the email address for your {{appName}} account to this address.',
    buttonText: 'Verify New Email',
    linkLabel: 'Or copy and paste this link into your browser:',
    expiryNotice: 'This link will expire in 24 hours.',
};

type EmailTranslations = {
    passwordReset: PasswordResetEmailTranslations;
    welcome: WelcomeEmailTranslations;
    verification: EmailVerificationEmailTranslations;
    emailChange: EmailChangeEmailTranslations;
};

/**
 * Service for loading and rendering email templates with i18n support.
 * Translations are loaded from the webapp's locales directory.
 */
export class EmailTemplateService {
    private translationsCache: Map<string, EmailTranslations> = new Map();

    /**
     * Generate password reset email content with translated templates
     */
    generatePasswordResetEmail(variables: PasswordResetEmailVariables, lang: string = 'en'): EmailContent {
        const translations = this.loadTranslations(lang);
        const t = translations.passwordReset;
        const vars = this.toRecord(variables);

        const subject = this.interpolate(t.subject, vars);
        const textBody = this.generatePasswordResetTextBody(t, vars);
        const htmlBody = this.generatePasswordResetHtmlBody(t, vars);

        return { subject, textBody, htmlBody };
    }

    /**
     * Generate welcome email content with translated templates
     */
    generateWelcomeEmail(variables: WelcomeEmailVariables, lang: string = 'en'): EmailContent {
        const translations = this.loadTranslations(lang);
        const t = translations.welcome;
        const vars = this.welcomeToRecord(variables);

        const subject = this.interpolate(t.subject, vars);
        const textBody = this.generateWelcomeTextBody(t, vars);
        const htmlBody = this.generateWelcomeHtmlBody(t, vars);

        return { subject, textBody, htmlBody };
    }

    /**
     * Generate email verification email content with translated templates
     */
    generateEmailVerificationEmail(variables: EmailVerificationEmailVariables, lang: string = 'en'): EmailContent {
        const translations = this.loadTranslations(lang);
        const t = translations.verification;
        const vars = this.verificationToRecord(variables);

        const subject = this.interpolate(t.subject, vars);
        const textBody = this.generateVerificationTextBody(t, vars);
        const htmlBody = this.generateVerificationHtmlBody(t, vars);

        return { subject, textBody, htmlBody };
    }

    private generateVerificationTextBody(
        t: EmailVerificationEmailTranslations,
        vars: Record<string, string>,
    ): string {
        return [
            this.interpolate(t.ignoreNotice, vars),
            '',
            this.interpolate(t.greeting, vars),
            '',
            this.interpolate(t.instruction, vars),
            '',
            `${this.interpolate(t.buttonText, vars)}: ${vars.verificationLink}`,
            '',
            this.interpolate(t.expiryNotice, vars),
        ]
            .join('\n');
    }

    private generateVerificationHtmlBody(
        t: EmailVerificationEmailTranslations,
        vars: Record<string, string>,
    ): string {
        const escapedVars: Record<string, string> = {
            appName: escapeHtml(vars.appName),
            displayName: escapeHtml(vars.displayName),
            domain: escapeHtml(vars.domain),
            verificationLink: escapeAttribute(vars.verificationLink),
        };

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
        ${this.interpolate(t.ignoreNotice, escapedVars)}
    </p>

    <p style="font-size: 18px;">${this.interpolate(t.greeting, escapedVars)}</p>

    <p>${this.interpolate(t.instruction, escapedVars)}</p>

    <p style="margin: 32px 0;">
        <a href="${escapedVars.verificationLink}"
           style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            ${this.interpolate(t.buttonText, escapedVars)}
        </a>
    </p>

    <p style="color: #666; font-size: 14px;">
        ${this.interpolate(t.linkLabel, escapedVars)}<br>
        <a href="${escapedVars.verificationLink}" style="color: #4F46E5; word-break: break-all;">${escapedVars.verificationLink}</a>
    </p>

    <p style="color: #666; font-size: 14px;">
        ${this.interpolate(t.expiryNotice, escapedVars)}
    </p>
</body>
</html>`
            .trim();
    }

    private verificationToRecord(vars: EmailVerificationEmailVariables): Record<string, string> {
        return {
            appName: vars.appName,
            displayName: vars.displayName,
            domain: vars.domain,
            verificationLink: vars.verificationLink,
        };
    }

    /**
     * Generate email change verification email content with translated templates
     */
    generateEmailChangeEmail(variables: EmailChangeEmailVariables, lang: string = 'en'): EmailContent {
        const translations = this.loadTranslations(lang);
        const t = translations.emailChange;
        const vars = this.emailChangeToRecord(variables);

        const subject = this.interpolate(t.subject, vars);
        const textBody = this.generateEmailChangeTextBody(t, vars);
        const htmlBody = this.generateEmailChangeHtmlBody(t, vars);

        return { subject, textBody, htmlBody };
    }

    private generateEmailChangeTextBody(
        t: EmailChangeEmailTranslations,
        vars: Record<string, string>,
    ): string {
        return [
            this.interpolate(t.ignoreNotice, vars),
            '',
            this.interpolate(t.greeting, vars),
            '',
            this.interpolate(t.instruction, vars),
            '',
            `${this.interpolate(t.buttonText, vars)}: ${vars.verificationLink}`,
            '',
            this.interpolate(t.expiryNotice, vars),
        ]
            .join('\n');
    }

    private generateEmailChangeHtmlBody(
        t: EmailChangeEmailTranslations,
        vars: Record<string, string>,
    ): string {
        const escapedVars: Record<string, string> = {
            appName: escapeHtml(vars.appName),
            displayName: escapeHtml(vars.displayName),
            domain: escapeHtml(vars.domain),
            verificationLink: escapeAttribute(vars.verificationLink),
        };

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
        ${this.interpolate(t.ignoreNotice, escapedVars)}
    </p>

    <p style="font-size: 18px;">${this.interpolate(t.greeting, escapedVars)}</p>

    <p>${this.interpolate(t.instruction, escapedVars)}</p>

    <p style="margin: 32px 0;">
        <a href="${escapedVars.verificationLink}"
           style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            ${this.interpolate(t.buttonText, escapedVars)}
        </a>
    </p>

    <p style="color: #666; font-size: 14px;">
        ${this.interpolate(t.linkLabel, escapedVars)}<br>
        <a href="${escapedVars.verificationLink}" style="color: #4F46E5; word-break: break-all;">${escapedVars.verificationLink}</a>
    </p>

    <p style="color: #666; font-size: 14px;">
        ${this.interpolate(t.expiryNotice, escapedVars)}
    </p>
</body>
</html>`
            .trim();
    }

    private emailChangeToRecord(vars: EmailChangeEmailVariables): Record<string, string> {
        return {
            appName: vars.appName,
            displayName: vars.displayName,
            domain: vars.domain,
            verificationLink: vars.verificationLink,
        };
    }

    private generateWelcomeTextBody(
        t: WelcomeEmailTranslations,
        vars: Record<string, string>,
    ): string {
        return [
            this.interpolate(t.greeting, vars),
            '',
            this.interpolate(t.welcomeMessage, vars),
            '',
            this.interpolate(t.instruction, vars),
            '',
            `${this.interpolate(t.buttonText, vars)}: ${vars.dashboardLink}`,
        ]
            .join('\n');
    }

    private generateWelcomeHtmlBody(
        t: WelcomeEmailTranslations,
        vars: Record<string, string>,
    ): string {
        const escapedVars: Record<string, string> = {
            appName: escapeHtml(vars.appName),
            displayName: escapeHtml(vars.displayName),
            dashboardLink: escapeAttribute(vars.dashboardLink),
        };

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <p style="font-size: 18px;">${this.interpolate(t.greeting, escapedVars)}</p>

    <p>${this.interpolate(t.welcomeMessage, escapedVars)}</p>

    <p>${this.interpolate(t.instruction, escapedVars)}</p>

    <p style="margin: 32px 0;">
        <a href="${escapedVars.dashboardLink}"
           style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            ${this.interpolate(t.buttonText, escapedVars)}
        </a>
    </p>
</body>
</html>`
            .trim();
    }

    private welcomeToRecord(vars: WelcomeEmailVariables): Record<string, string> {
        return {
            appName: vars.appName,
            displayName: vars.displayName,
            dashboardLink: vars.dashboardLink,
        };
    }

    private generatePasswordResetTextBody(
        t: PasswordResetEmailTranslations,
        vars: Record<string, string>,
    ): string {
        return [
            this.interpolate(t.ignoreNotice, vars),
            '',
            this.interpolate(t.greeting, vars),
            '',
            this.interpolate(t.instruction, vars),
            '',
            `${this.interpolate(t.buttonText, vars)}: ${vars.resetLink}`,
            '',
            this.interpolate(t.expiryNotice, vars),
        ]
            .join('\n');
    }

    private generatePasswordResetHtmlBody(
        t: PasswordResetEmailTranslations,
        vars: Record<string, string>,
    ): string {
        // Escape all user-provided variables once upfront
        // Translation templates are trusted internal content, so we only escape the interpolated values
        const escapedVars: Record<string, string> = {
            appName: escapeHtml(vars.appName),
            domain: escapeHtml(vars.domain),
            resetLink: escapeAttribute(vars.resetLink),
        };

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
        ${this.interpolate(t.ignoreNotice, escapedVars)}
    </p>

    <p>${this.interpolate(t.greeting, escapedVars)}</p>

    <p>${this.interpolate(t.instruction, escapedVars)}</p>

    <p style="margin: 32px 0;">
        <a href="${escapedVars.resetLink}"
           style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            ${this.interpolate(t.buttonText, escapedVars)}
        </a>
    </p>

    <p style="color: #666; font-size: 14px;">
        ${this.interpolate(t.linkLabel, escapedVars)}<br>
        <a href="${escapedVars.resetLink}" style="color: #4F46E5; word-break: break-all;">${escapedVars.resetLink}</a>
    </p>

    <p style="color: #666; font-size: 14px;">
        ${this.interpolate(t.expiryNotice, escapedVars)}
    </p>
</body>
</html>`
            .trim();
    }

    private interpolate(template: string, variables: Record<string, string>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
    }

    private toRecord(vars: PasswordResetEmailVariables): Record<string, string> {
        return {
            appName: vars.appName,
            domain: vars.domain,
            resetLink: vars.resetLink,
        };
    }

    private loadTranslations(lang: string = 'en'): EmailTranslations {
        // Check cache first
        const cached = this.translationsCache.get(lang);
        if (cached) {
            return cached;
        }

        // Try to load requested language, fall back to English
        const translations = this.loadTranslationsForLanguage(lang)
            ?? this.loadTranslationsForLanguage('en')
            ?? {
                passwordReset: FALLBACK_PASSWORD_RESET_TRANSLATIONS,
                welcome: FALLBACK_WELCOME_TRANSLATIONS,
                verification: FALLBACK_EMAIL_VERIFICATION_TRANSLATIONS,
                emailChange: FALLBACK_EMAIL_CHANGE_TRANSLATIONS,
            };

        this.translationsCache.set(lang, translations);
        return translations;
    }

    private loadTranslationsForLanguage(lang: string): EmailTranslations | null {
        // Check multiple locations for translations:
        // 1. Same directory as compiled JS (production: lib/locales/)
        // 2. Webapp locales directory (dev mode with tsx)
        const possiblePaths = [
            path.resolve(__dirname, `../../locales/${lang}/translation.json`),
            path.resolve(__dirname, `../../../../webapp-v2/src/locales/${lang}/translation.json`),
            path.resolve(__dirname, `../../../../../webapp-v2/src/locales/${lang}/translation.json`),
        ];

        for (const translationPath of possiblePaths) {
            if (fs.existsSync(translationPath)) {
                try {
                    const content = fs.readFileSync(translationPath, 'utf-8');
                    const parsed = JSON.parse(content) as { email?: EmailTranslations; };
                    if (parsed.email?.passwordReset) {
                        logger.info('email-translations-loaded', { path: translationPath, lang });
                        return parsed.email;
                    }
                } catch (error) {
                    logger.warn('email-translations-parse-error', {
                        path: translationPath,
                        lang,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }

        if (lang !== 'en') {
            logger.info('email-translations-fallback', {
                requestedLang: lang,
                message: 'Language not found, will fall back to English',
            });
        }
        return null;
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function escapeAttribute(value: string): string {
    return escapeHtml(value);
}
