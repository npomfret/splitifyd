import type { Password, UserRegistration } from '@billsplit-wl/shared';
import { DisplayName, toDisplayName, toEmail, toPassword } from '@billsplit-wl/shared';
import type { Email } from '@billsplit-wl/shared';
import { randomBoolean, randomChoice, randomEmail, randomString } from '../test-helpers';

export class RegisterRequestBuilder {
    private request: UserRegistration = {
        email: randomEmail(),
        password: toPassword(`passwordpass`),
        displayName: toDisplayName(`${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(6)}`),
        termsAccepted: randomBoolean(),
        cookiePolicyAccepted: randomBoolean(),
        privacyPolicyAccepted: randomBoolean(),
        signupHostname: 'localhost',
    };

    withEmail(email: Email | string): this {
        this.request.email = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    withPassword(password: Password | string): this {
        this.request.password = typeof password === 'string' ? toPassword(password) : password;
        return this;
    }

    withDisplayName(displayName: DisplayName | string): this {
        this.request.displayName = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
        return this;
    }

    withoutDisplayName(): this {
        delete (this.request as any).displayName;
        return this;
    }

    withTermsAccepted(accepted: boolean): this {
        this.request.termsAccepted = accepted;
        return this;
    }

    withoutTermsAccepted(): this {
        delete (this.request as any).termsAccepted;
        return this;
    }

    withCookiePolicyAccepted(accepted: boolean): this {
        this.request.cookiePolicyAccepted = accepted;
        return this;
    }

    withoutCookiePolicyAccepted(): this {
        delete (this.request as any).cookiePolicyAccepted;
        return this;
    }

    withPrivacyPolicyAccepted(accepted: boolean): this {
        this.request.privacyPolicyAccepted = accepted;
        return this;
    }

    withoutPrivacyPolicyAccepted(): this {
        delete (this.request as any).privacyPolicyAccepted;
        return this;
    }

    withSignupHostname(hostname: string): this {
        this.request.signupHostname = hostname;
        return this;
    }

    withoutSignupHostname(): this {
        delete (this.request as any).signupHostname;
        return this;
    }

    build(): UserRegistration {
        return { ...this.request };
    }
}
