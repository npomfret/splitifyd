import type { UserRegistration } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import type { Email } from '@splitifyd/shared';
import { randomBoolean, randomChoice, randomEmail, randomString } from '../test-helpers';

export class RegisterRequestBuilder {
    private request: UserRegistration = {
        email: randomEmail(),
        password: `passwordpass`,
        displayName: `${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(6)}`,
        termsAccepted: randomBoolean(),
        cookiePolicyAccepted: randomBoolean(),
    };

    withEmail(email: Email): this {
        this.request.email = email;
        return this;
    }

    withPassword(password: string): this {
        this.request.password = password;
        return this;
    }

    withDisplayName(displayName: DisplayName): this {
        this.request.displayName = displayName;
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

    build(): UserRegistration {
        return { ...this.request };
    }
}
