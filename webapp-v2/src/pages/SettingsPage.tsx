import { useState, useEffect } from 'preact/hooks';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { apiClient } from '../app/apiClient';
import { BaseLayout } from '../components/layout/BaseLayout';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { Alert } from '@/components/ui';

interface PasswordChangeData {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}

export function SettingsPage() {
    const authStore = useAuthRequired();
    const [displayName, setDisplayName] = useState('');
    const [originalDisplayName, setOriginalDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordData, setPasswordData] = useState<PasswordChangeData>({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    });
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const user = authStore.user;

    // Load user profile on component mount
    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || '');
            setOriginalDisplayName(user.displayName || '');
        }
    }, [user]);

    // Clear messages after 5 seconds
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage('');
                setErrorMessage('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    const handleDisplayNameUpdate = async () => {
        if (!user || authStore.isUpdatingProfile) return;

        setErrorMessage('');
        setSuccessMessage('');

        try {
            // Use the auth store's updateUserProfile method for real-time updates
            await authStore.updateUserProfile({ displayName: displayName.trim() });
            setOriginalDisplayName(displayName.trim());
            setSuccessMessage('Profile updated successfully');
            // No need for token refresh or page reload - UI updates automatically via signals
        } catch (error) {
            setErrorMessage('Failed to update profile. Please try again.');
            console.error('Profile update error:', error);
        }
    };

    const handlePasswordChange = async () => {
        if (!user || isLoading) return;

        // Validation
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
            setErrorMessage('Current password and new password are required');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setErrorMessage('New password must be at least 6 characters long');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmNewPassword) {
            setErrorMessage('Passwords do not match');
            return;
        }

        if (passwordData.currentPassword === passwordData.newPassword) {
            setErrorMessage('New password must be different from current password');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await apiClient.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });

            setSuccessMessage('Password changed successfully');
            setShowPasswordForm(false);
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: '',
            });
        } catch (error: any) {
            if (error.message.includes('Current password is incorrect')) {
                setErrorMessage('Current password is incorrect');
            } else {
                setErrorMessage('Failed to change password. Please try again.');
            }
            console.error('Password change error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelPasswordChange = () => {
        setShowPasswordForm(false);
        setPasswordData({
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: '',
        });
        setErrorMessage('');
    };

    if (!user) {
        return null;
    }

    const hasDisplayNameChanged = displayName.trim() !== originalDisplayName;
    const isDisplayNameEmpty = displayName.trim().length === 0;
    const isDisplayNameTooLong = displayName.trim().length > 100;

    return (
        <BaseLayout title="Settings - Splitifyd" description="Manage your account settings" headerVariant="dashboard">
            <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div class="px-6 py-4 border-b border-gray-200">
                        <h1 class="text-xl font-semibold text-gray-900">Account Settings</h1>
                        <p class="text-sm text-gray-600">Manage your profile information and password</p>
                    </div>

                    <div class="p-6 space-y-6">
                        {/* Success/Error Messages */}
                        {successMessage && <Alert type="success" message={successMessage} />}
                        {errorMessage && <Alert type="error" message={errorMessage} />}

                        {/* Profile Information Section */}
                        <div class="space-y-4">
                            <h2 class="text-lg font-medium text-gray-900">Profile Information</h2>

                            {/* Display Name Display */}
                            <div class="text-sm">
                                <span class="text-gray-600">Current display name: </span>
                                <span data-testid="profile-display-name" class="font-medium text-gray-900">
                                    {user.displayName || user.email.split('@')[0]}
                                </span>
                            </div>

                            {/* Email Display */}
                            <div class="text-sm">
                                <span class="text-gray-600">Email: </span>
                                <span data-testid="profile-email" class="font-medium text-gray-900">
                                    {user.email}
                                </span>
                            </div>

                            {/* Display Name Input */}
                            <Input
                                label="Display Name"
                                value={displayName}
                                onChange={setDisplayName}
                                placeholder="Enter your display name"
                                disabled={authStore.isUpdatingProfile}
                                error={isDisplayNameEmpty ? 'Display name cannot be empty' : isDisplayNameTooLong ? 'Display name must be 100 characters or less' : undefined}
                            />

                            <Button
                                onClick={handleDisplayNameUpdate}
                                disabled={!hasDisplayNameChanged || authStore.isUpdatingProfile || isDisplayNameEmpty || isDisplayNameTooLong}
                                loading={authStore.isUpdatingProfile}
                            >
                                Save Changes
                            </Button>
                        </div>

                        {/* Password Section */}
                        <div class="border-t border-gray-200 pt-6 space-y-4">
                            <h2 class="text-lg font-medium text-gray-900">Password</h2>

                            {!showPasswordForm ? (
                                <Button variant="secondary" onClick={() => setShowPasswordForm(true)}>
                                    Change Password
                                </Button>
                            ) : (
                                <div class="space-y-4">
                                    <Input
                                        label="Current Password"
                                        type="password"
                                        name="currentPassword"
                                        value={passwordData.currentPassword}
                                        onChange={(value) => setPasswordData((prev) => ({ ...prev, currentPassword: value }))}
                                        disabled={isLoading}
                                        autoComplete="current-password"
                                        id="current-password-input"
                                    />

                                    <Input
                                        label="New Password"
                                        type="password"
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={(value) => setPasswordData((prev) => ({ ...prev, newPassword: value }))}
                                        disabled={isLoading}
                                        autoComplete="new-password"
                                        id="new-password-input"
                                    />

                                    <Input
                                        label="Confirm New Password"
                                        type="password"
                                        name="confirmNewPassword"
                                        value={passwordData.confirmNewPassword}
                                        onChange={(value) => setPasswordData((prev) => ({ ...prev, confirmNewPassword: value }))}
                                        disabled={isLoading}
                                        autoComplete="new-password"
                                        id="confirm-password-input"
                                    />

                                    <div class="flex space-x-3">
                                        <Button onClick={handlePasswordChange} disabled={isLoading} loading={isLoading}>
                                            Update Password
                                        </Button>
                                        <Button variant="secondary" onClick={handleCancelPasswordChange} disabled={isLoading}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </BaseLayout>
    );
}
