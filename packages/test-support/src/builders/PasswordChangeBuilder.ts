import type { PasswordChangeRequest } from '@splitifyd/shared';

/**
 * Builder for creating password change request objects for testing
 * Used for testing password change operations
 */
export class PasswordChangeBuilder {
    private changeData: Partial<PasswordChangeRequest> = {};

    withCurrentPassword(currentPassword: string): PasswordChangeBuilder {
        this.changeData.currentPassword = currentPassword;
        return this;
    }

    withNewPassword(newPassword: string): PasswordChangeBuilder {
        this.changeData.newPassword = newPassword;
        return this;
    }

    build(): Partial<PasswordChangeRequest> {
        return { ...this.changeData };
    }
}
