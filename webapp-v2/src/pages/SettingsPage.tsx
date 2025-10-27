import { Alert, Avatar, Button, Card, Form, Input } from '@/components/ui';
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
    const resolvedDisplayName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
    const profileInitials = resolvedDisplayName
        ? resolvedDisplayName
              .split(' ')
              .map((part) => part.charAt(0))
              .join('')
              .slice(0, 2)
              .toUpperCase()
        : '';

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

        if (passwordData.newPassword.length < 12) {
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
            <div class='mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8'>
                <div class='space-y-8'>
                    <div class='flex flex-col gap-2'>
                        <span class='text-xs font-medium uppercase tracking-wide text-indigo-600'>
                            {t('settingsPage.heroLabel')}
                        </span>
                        <div class='flex flex-col gap-2'>
                            <h1 class='text-3xl font-semibold text-slate-900' data-testid='account-settings-header'>
                                {t('settingsPage.accountSettingsHeader')}
                            </h1>
                            <p class='max-w-2xl text-sm text-slate-600 sm:text-base'>{t('settingsPage.accountSettingsSubheader')}</p>
                        </div>
                    </div>

                    {(successMessage || errorMessage) && (
                        <div class='space-y-3'>
                            {successMessage && <Alert type='success' message={successMessage} />}
                            {errorMessage && <Alert type='error' message={errorMessage} />}
                        </div>
                    )}

                    <div class='grid gap-6 lg:grid-cols-[320px,1fr] lg:gap-8 xl:grid-cols-[360px,1fr]'>
                        <Card padding='lg' className='shadow-md lg:sticky lg:top-24'>
                            <div class='space-y-6'>
                                <div class='flex items-start gap-4'>
                                    {(user.themeColor || user.photoURL)
                                        ? (
                                            <Avatar
                                                displayName={resolvedDisplayName}
                                                userId={user.uid}
                                                themeColor={user.themeColor}
                                                photoURL={user.photoURL}
                                                size='lg'
                                            />
                                        )
                                        : (
                                            <div class='flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-lg font-semibold uppercase text-white shadow-inner'>
                                                {profileInitials}
                                            </div>
                                        )}

                                    <div class='space-y-1'>
                                        <p class='text-sm font-semibold uppercase tracking-wide text-slate-500'>
                                            {t('settingsPage.profileSummaryTitle')}
                                        </p>
                                        <div class='text-2xl font-semibold text-slate-900' data-testid='profile-display-name'>
                                            {resolvedDisplayName}
                                        </div>
                                        <p class='text-sm text-slate-500'>{t('settingsPage.profileSummaryDescription')}</p>
                                    </div>
                                </div>

                                <div class='space-y-3 text-sm'>
                                    <div class='rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3'>
                                        <span class='text-slate-500'>{t('settingsPage.currentDisplayName')}</span>
                                        <div class='font-medium text-slate-900'>{resolvedDisplayName}</div>
                                    </div>
                                    <div class='rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3'>
                                        <span class='text-slate-500'>{t('settingsPage.email')}</span>
                                        <div class='font-medium text-slate-900 break-words' data-testid='profile-email'>
                                            {user.email}
                                        </div>
                                    </div>
                                    <div class='rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3'>
                                        <span class='text-slate-500'>{t('settingsPage.profileSummaryRoleLabel')}</span>
                                        <div class='font-medium text-slate-900'>
                                            {user.role ? t(`settingsPage.profileSummaryRole.${user.role}`, { defaultValue: t('settingsPage.profileSummaryRoleFallback') }) : t('settingsPage.profileSummaryRoleFallback')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div class='space-y-6'>
                            <Card padding='lg' data-testid='profile-information-section'>
                                <div class='space-y-6'>
                                    <div class='space-y-2'>
                                        <h2 class='text-xl font-semibold text-slate-900'>{t('settingsPage.profileInformationHeader')}</h2>
                                        <p class='text-sm text-slate-600'>{t('settingsPage.profileInformationSubheader')}</p>
                                    </div>

                                    <Form
                                        onSubmit={() => {
                                            if (!hasDisplayNameChanged || authStore.isUpdatingProfile || isDisplayNameEmpty || isDisplayNameTooLong) {
                                                return;
                                            }
                                            return handleDisplayNameUpdate();
                                        }}
                                        className='space-y-5'
                                    >
                                        <div class='space-y-2'>
                                            <Input
                                                label={t('settingsPage.displayNameLabel')}
                                                value={displayName}
                                                onChange={setDisplayName}
                                                placeholder={t('settingsPage.displayNamePlaceholder')}
                                                disabled={authStore.isUpdatingProfile}
                                                error={isDisplayNameEmpty ? t('settingsPage.errorMessages.displayNameEmpty') : isDisplayNameTooLong ? t('settingsPage.errorMessages.displayNameTooLong') : undefined}
                                                data-testid='display-name-input'
                                            />
                                            <p class='text-xs text-slate-500'>{t('settingsPage.displayNameHelper')}</p>
                                        </div>

                                        <Button
                                            type='submit'
                                            disabled={!hasDisplayNameChanged || authStore.isUpdatingProfile || isDisplayNameEmpty || isDisplayNameTooLong}
                                            loading={authStore.isUpdatingProfile}
                                            data-testid='save-changes-button'
                                        >
                                            {t('settingsPage.saveChangesButton')}
                                        </Button>
                                    </Form>
                                </div>
                            </Card>

                            <Card padding='lg' data-testid='password-section'>
                                <div class='space-y-6'>
                                    <div class='space-y-2'>
                                        <h2 class='text-xl font-semibold text-slate-900'>{t('settingsPage.passwordHeader')}</h2>
                                        <p class='text-sm text-slate-600'>{t('settingsPage.passwordIntro')}</p>
                                    </div>

                                    <div class='rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-4 text-sm text-indigo-800'>
                                        <div class='font-semibold'>{t('settingsPage.passwordRequirementsHeading')}</div>
                                        <ul class='mt-2 space-y-2'>
                                            <li class='flex gap-2'>
                                                <span class='mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500' aria-hidden='true' />
                                                <span>{t('settingsPage.passwordRequirements.length')}</span>
                                            </li>
                                            <li class='flex gap-2'>
                                                <span class='mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500' aria-hidden='true' />
                                                <span>{t('settingsPage.passwordRequirements.mix')}</span>
                                            </li>
                                            <li class='flex gap-2'>
                                                <span class='mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500' aria-hidden='true' />
                                                <span>{t('settingsPage.passwordRequirements.reuse')}</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {!showPasswordForm ? (
                                        <Button onClick={() => setShowPasswordForm(true)} data-testid='change-password-button'>
                                            {t('settingsPage.changePasswordButton')}
                                        </Button>
                                    ) : (
                                        <div data-testid='password-form'>
                                            <Form
                                                onSubmit={() => {
                                                    if (!isLoading) {
                                                        return handlePasswordChange();
                                                    }
                                                }}
                                                className='space-y-5'
                                            >
                                                <Input
                                                    label={t('settingsPage.currentPasswordLabel')}
                                                    type='password'
                                                    name='currentPassword'
                                                    value={passwordData.currentPassword}
                                                    onChange={(value) => setPasswordData((prev) => ({ ...prev, currentPassword: value }))}
                                                    disabled={isLoading}
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
                                                    id='confirm-password-input'
                                                    data-testid='confirm-password-input'
                                                />

                                                <div class='flex flex-col gap-3 sm:flex-row'>
                                                    <Button type='submit' disabled={isLoading} loading={isLoading} data-testid='update-password-button'>
                                                        {t('settingsPage.updatePasswordButton')}
                                                    </Button>
                                                    <Button type='button' variant='secondary' onClick={handleCancelPasswordChange} disabled={isLoading} data-testid='cancel-password-button'>
                                                        {t('settingsPage.cancelButton')}
                                                    </Button>
                                                </div>
                                            </Form>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </BaseLayout>
    );
}
