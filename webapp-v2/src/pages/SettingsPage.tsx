import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { Alert } from '@/components/ui';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../app/apiClient';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';

interface PasswordChangeData {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}

export function SettingsPage() {
    const { t } = useTranslation();
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
            setSuccessMessage(t('settingsPage.successMessages.profileUpdated'));
            // No need for token refresh or page reload - UI updates automatically via signals
        } catch (error) {
            setErrorMessage(t('settingsPage.errorMessages.profileUpdateFailed'));
            console.error('Profile update error:', error);
        }
    };

    const handlePasswordChange = async () => {
        if (!user || isLoading) return;

        // Validation
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
            setErrorMessage(t('settingsPage.errorMessages.passwordAndNewRequired'));
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setErrorMessage(t('settingsPage.errorMessages.passwordTooShort'));
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmNewPassword) {
            setErrorMessage(t('settingsPage.errorMessages.passwordsNoMatch'));
            return;
        }

        if (passwordData.currentPassword === passwordData.newPassword) {
            setErrorMessage(t('settingsPage.errorMessages.passwordSameAsCurrent'));
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

            setSuccessMessage(t('settingsPage.successMessages.passwordChanged'));
            setShowPasswordForm(false);
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: '',
            });
        } catch (error: any) {
            if (error.message.includes('Current password is incorrect')) {
                setErrorMessage(t('settingsPage.errorMessages.currentPasswordIncorrect'));
            } else {
                setErrorMessage(t('settingsPage.errorMessages.passwordChangeFailed'));
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
        <BaseLayout title={t('settingsPage.title')} description={t('settingsPage.description')} headerVariant='dashboard'>
            <div class='max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
                <div class='bg-white rounded-lg shadow-sm border border-gray-200'>
                    <div class='px-6 py-4 border-b border-gray-200'>
                        <h1 class='text-xl font-semibold text-gray-900' data-testid='account-settings-header'>
                            {t('settingsPage.accountSettingsHeader')}
                        </h1>
                        <p class='text-sm text-gray-600'>{t('settingsPage.accountSettingsSubheader')}</p>
                    </div>

                    <div class='p-6 space-y-6'>
                        {/* Success/Error Messages */}
                        {successMessage && <Alert type='success' message={successMessage} />}
                        {errorMessage && <Alert type='error' message={errorMessage} />}

                        {/* Profile Information Section */}
                        <div class='space-y-4' data-testid='profile-information-section'>
                            <h2 class='text-lg font-medium text-gray-900'>{t('settingsPage.profileInformationHeader')}</h2>

                            {/* Display Name Display */}
                            <div class='text-sm'>
                                <span class='text-gray-600'>{t('settingsPage.currentDisplayName')}</span>
                                <span data-testid='profile-display-name' class='font-medium text-gray-900'>
                                    {user.displayName}
                                </span>
                            </div>

                            {/* Email Display */}
                            <div class='text-sm'>
                                <span class='text-gray-600'>{t('settingsPage.email')}</span>
                                <span data-testid='profile-email' class='font-medium text-gray-900'>
                                    {user.email}
                                </span>
                            </div>

                            {/* Display Name Input */}
                            <Input
                                label={t('settingsPage.displayNameLabel')}
                                value={displayName}
                                onChange={setDisplayName}
                                placeholder={t('settingsPage.displayNamePlaceholder')}
                                disabled={authStore.isUpdatingProfile}
                                error={isDisplayNameEmpty ? t('settingsPage.errorMessages.displayNameEmpty') : isDisplayNameTooLong ? t('settingsPage.errorMessages.displayNameTooLong') : undefined}
                                data-testid='display-name-input'
                            />

                            <Button
                                onClick={handleDisplayNameUpdate}
                                disabled={!hasDisplayNameChanged || authStore.isUpdatingProfile || isDisplayNameEmpty || isDisplayNameTooLong}
                                loading={authStore.isUpdatingProfile}
                                data-testid='save-changes-button'
                            >
                                {t('settingsPage.saveChangesButton')}
                            </Button>
                        </div>

                        {/* Password Section */}
                        <div class='border-t border-gray-200 pt-6 space-y-4' data-testid='password-section'>
                            <h2 class='text-lg font-medium text-gray-900'>{t('settingsPage.passwordHeader')}</h2>

                            {!showPasswordForm
                                ? (
                                    <Button variant='secondary' onClick={() => setShowPasswordForm(true)} data-testid='change-password-button'>
                                        {t('settingsPage.changePasswordButton')}
                                    </Button>
                                )
                                : (
                                    <div class='space-y-4' data-testid='password-form'>
                                        <Input
                                            label={t('settingsPage.currentPasswordLabel')}
                                            type='password'
                                            name='currentPassword'
                                            value={passwordData.currentPassword}
                                            onChange={(value) => setPasswordData((prev) => ({ ...prev, currentPassword: value }))}
                                            disabled={isLoading}
                                            autoComplete='current-password'
                                            id='current-password-input'
                                            data-testid='current-password-input'
                                        />

                                        <Input
                                            label={t('settingsPage.newPasswordLabel')}
                                            type='password'
                                            name='newPassword'
                                            value={passwordData.newPassword}
                                            onChange={(value) => setPasswordData((prev) => ({ ...prev, newPassword: value }))}
                                            disabled={isLoading}
                                            autoComplete='new-password'
                                            id='new-password-input'
                                            data-testid='new-password-input'
                                        />

                                        <Input
                                            label={t('settingsPage.confirmNewPasswordLabel')}
                                            type='password'
                                            name='confirmNewPassword'
                                            value={passwordData.confirmNewPassword}
                                            onChange={(value) => setPasswordData((prev) => ({ ...prev, confirmNewPassword: value }))}
                                            disabled={isLoading}
                                            autoComplete='new-password'
                                            id='confirm-password-input'
                                            data-testid='confirm-password-input'
                                        />

                                        <div class='flex space-x-3'>
                                            <Button onClick={handlePasswordChange} disabled={isLoading} loading={isLoading} data-testid='update-password-button'>
                                                {t('settingsPage.updatePasswordButton')}
                                            </Button>
                                            <Button variant='secondary' onClick={handleCancelPasswordChange} disabled={isLoading} data-testid='cancel-password-button'>
                                                {t('settingsPage.cancelButton')}
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
