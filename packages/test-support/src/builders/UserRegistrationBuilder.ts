import {toPassword, UserRegistration} from '@splitifyd/shared';
import { DisplayName, toDisplayName } from '@splitifyd/shared';
import type { Email, Password } from '@splitifyd/shared';
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
        };
    }

    withEmail(email: Email | string): this {
        this.userRegistration.email = email;
        return this;
    }

    withPassword(password: Password | string): this {
        this.userRegistration.password =  typeof  password === "string" ? toPassword(password) : password;
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

    from(data: UserRegistration): this {
        this.userRegistration = { ...data };
        return this;
    }

    build(): UserRegistration {
        return { ...this.userRegistration };
    }
}
