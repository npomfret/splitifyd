import { UserRegistration } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import type { Email } from '@splitifyd/shared';
import { generateNewUserDetails } from '../test-helpers';

export class UserRegistrationBuilder {
    private userRegistration: UserRegistration;

    constructor() {
        const baseUser = generateNewUserDetails();
        this.userRegistration = {
            ...baseUser,
            termsAccepted: true,
            cookiePolicyAccepted: true,
        };
    }

    withEmail(email: Email): this {
        this.userRegistration.email = email;
        return this;
    }

    withPassword(password: string): this {
        this.userRegistration.password = password;
        return this;
    }

    withDisplayName(displayName: DisplayName): this {
        this.userRegistration.displayName = displayName;
        return this;
    }

    withName(name: string): this {
        this.userRegistration.displayName = name;
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

    from(data: UserRegistration): this {
        this.userRegistration = { ...data };
        return this;
    }

    build(): UserRegistration {
        return { ...this.userRegistration };
    }
}
