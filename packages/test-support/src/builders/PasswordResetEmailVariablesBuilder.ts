import type { PasswordResetEmailVariables } from '@billsplit-wl/shared';

/**
 * Builder for creating password reset email variable objects for testing
 */
export class PasswordResetEmailVariablesBuilder {
    private variables: PasswordResetEmailVariables;

    constructor() {
        this.variables = {
            appName: 'TestApp',
            domain: 'example.com',
            resetLink: 'https://example.com/__/auth/action?mode=resetPassword&oobCode=abc123',
        };
    }

    withAppName(appName: string): this {
        this.variables.appName = appName;
        return this;
    }

    withDomain(domain: string): this {
        this.variables.domain = domain;
        return this;
    }

    withResetLink(resetLink: string): this {
        this.variables.resetLink = resetLink;
        return this;
    }

    build(): PasswordResetEmailVariables {
        return { ...this.variables };
    }
}
