/**
 * Builder for creating password change request objects for testing
 * Used for testing password change operations
 */
export class PasswordChangeBuilder {
    private changeData: {
        currentPassword?: string;
        newPassword?: string;
    } = {};

    withCurrentPassword(currentPassword: string): PasswordChangeBuilder {
        this.changeData.currentPassword = currentPassword;
        return this;
    }

    withNewPassword(newPassword: string): PasswordChangeBuilder {
        this.changeData.newPassword = newPassword;
        return this;
    }

    build(): {
        currentPassword?: string;
        newPassword?: string;
    } {
        return { ...this.changeData };
    }
}