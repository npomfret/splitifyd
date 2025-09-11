import { generateNewUserDetails } from '../test-helpers';
import { UserRegistration } from '@splitifyd/shared';

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

    withEmail(email: string): this {
        this.userRegistration.email = email;
        return this;
    }

    withPassword(password: string): this {
        this.userRegistration.password = password;
        return this;
    }

    withDisplayName(displayName: string): this {
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

    build(): UserRegistration {
        return { ...this.userRegistration };
    }
}
