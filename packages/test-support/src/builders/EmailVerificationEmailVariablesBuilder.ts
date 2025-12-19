import type { EmailVerificationEmailVariables } from '@billsplit-wl/shared';

/**
 * Builder for creating email verification email variable objects for testing
 */
export class EmailVerificationEmailVariablesBuilder {
    private variables: EmailVerificationEmailVariables;

    constructor() {
        this.variables = {
            appName: 'TestApp',
            displayName: 'John Doe',
            domain: 'example.com',
            verificationLink: 'https://example.com/__/auth/action?mode=verifyEmail&oobCode=abc123',
        };
    }

    withAppName(appName: string): this {
        this.variables.appName = appName;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.variables.displayName = displayName;
        return this;
    }

    withDomain(domain: string): this {
        this.variables.domain = domain;
        return this;
    }

    withVerificationLink(verificationLink: string): this {
        this.variables.verificationLink = verificationLink;
        return this;
    }

    build(): EmailVerificationEmailVariables {
        return { ...this.variables };
    }
}
