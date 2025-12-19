import { toEmail, toPassword, UserRegistration } from '@billsplit-wl/shared';
import { DisplayName, toDisplayName } from '@billsplit-wl/shared';
import type { Email, Password } from '@billsplit-wl/shared';
import { generateNewUserDetails } from '../test-helpers';

export class UserRegistrationBuilder {
    private userRegistration: UserRegistration;

    constructor() {
        const baseUser = generateNewUserDetails();
        this.userRegistration = {
            ...baseUser,
            displayName: toDisplayName(baseUser.displayName),
            termsAccepted: true,
            cookiePolicyAccepted: true,
            privacyPolicyAccepted: true,
            signupHostname: 'localhost',
        };
    }

    /** Create an empty builder for testing incomplete/invalid registration data */
    static empty(): EmptyUserRegistrationBuilder {
        return new EmptyUserRegistrationBuilder();
    }

    withEmail(email: Email | string): this {
        this.userRegistration.email = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    withPassword(password: Password | string): this {
        this.userRegistration.password = typeof password === 'string' ? toPassword(password) : password;
        return this;
    }

    withDisplayName(displayName: DisplayName | string): this {
        this.userRegistration.displayName = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
        return this;
    }

    withName(name: DisplayName | string): this {
        this.userRegistration.displayName = typeof name === 'string' ? toDisplayName(name) : name;
        return this;
    }

    withTermsAccepted(accepted: boolean): this {
        this.userRegistration.termsAccepted = accepted;
        return this;
    }

    withCookiePolicyAccepted(accepted: boolean): this {
        this.userRegistration.cookiePolicyAccepted = accepted;
        return this;
    }

    withPrivacyPolicyAccepted(accepted: boolean): this {
        this.userRegistration.privacyPolicyAccepted = accepted;
        return this;
    }

    /** For testing password validation - sets a password that's too weak */
    withInvalidPassword(password: string): this {
        (this.userRegistration as any).password = toPassword(password);
        return this;
    }

    withSignupHostname(hostname: string): this {
        this.userRegistration.signupHostname = hostname;
        return this;
    }

    from(data: UserRegistration): this {
        this.userRegistration = { ...data };
        return this;
    }

    build(): UserRegistration {
        return { ...this.userRegistration };
    }
}

/** Builder for creating empty/partial registration requests for validation testing */
class EmptyUserRegistrationBuilder {
    private data: Partial<UserRegistration> = {};

    withEmail(email: Email | string): this {
        this.data.email = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    withPassword(password: Password | string): this {
        this.data.password = typeof password === 'string' ? toPassword(password) : password;
        return this;
    }

    withDisplayName(displayName: DisplayName | string): this {
        this.data.displayName = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
        return this;
    }

    withTermsAccepted(accepted: boolean): this {
        this.data.termsAccepted = accepted;
        return this;
    }

    withCookiePolicyAccepted(accepted: boolean): this {
        this.data.cookiePolicyAccepted = accepted;
        return this;
    }

    withPrivacyPolicyAccepted(accepted: boolean): this {
        this.data.privacyPolicyAccepted = accepted;
        return this;
    }

    build(): Partial<UserRegistration> {
        return { ...this.data };
    }
}
