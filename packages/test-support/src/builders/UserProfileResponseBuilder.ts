import type { ClientUser, DisplayName, Email, SystemUserRole, UserProfileResponse } from '@billsplit-wl/shared';
import { SystemUserRoles, toDisplayName, toEmail } from '@billsplit-wl/shared';
import { randomChoice, randomString } from '../test-helpers';

/**
 * Builder for creating UserProfileResponse objects for testing
 * This is the API response type returned by GET /api/user/profile
 */
export class UserProfileResponseBuilder {
    private response: UserProfileResponse;

    constructor() {
        this.response = {
            displayName: toDisplayName(`${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana'])} ${randomString(4)}`),
            email: toEmail(`${randomString(6).toLowerCase()}@example.com`),
            emailVerified: true,
            role: SystemUserRoles.SYSTEM_USER,
        };
    }

    withDisplayName(displayName: DisplayName | string): this {
        this.response.displayName = typeof displayName === 'string' ? toDisplayName(displayName) : displayName;
        return this;
    }

    withEmail(email: Email | string): this {
        this.response.email = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    withEmailVerified(verified: boolean): this {
        this.response.emailVerified = verified;
        return this;
    }

    withRole(role: SystemUserRole): this {
        this.response.role = role;
        return this;
    }

    build(): UserProfileResponse {
        return { ...this.response };
    }

    /**
     * Create a UserProfileResponse from an existing ClientUser
     * Useful when tests already have a user fixture and need to mock the profile API
     */
    static fromClientUser(user: ClientUser): UserProfileResponseBuilder {
        return new UserProfileResponseBuilder()
            .withDisplayName(user.displayName)
            .withEmail(user.email)
            .withEmailVerified(user.emailVerified ?? true)
            .withRole(user.role ?? SystemUserRoles.SYSTEM_USER);
    }
}
