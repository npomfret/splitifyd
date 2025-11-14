import { themeStore } from '@/app/stores/theme-store.ts';
import { Alert, Avatar, Button, Card, Form, Input } from '@/components/ui';
import { SystemUserRoles } from '@splitifyd/shared';
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

interface EmailChangeData {
    newEmail: string;
    currentPassword: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const [originalEmail, setOriginalEmail] = useState('');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [emailData, setEmailData] = useState<EmailChangeData>({
        newEmail: '',
        currentPassword: '',
    });
    const [isEmailLoading, setIsEmailLoading] = useState(false);

    const user = authStore.user;
    const resolvedDisplayName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
    const membershipTheme = user ? themeStore.getThemeForUser(user.uid) : null;
    const shouldShowAvatar = Boolean(user && (user.photoURL || membershipTheme));
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
            const userEmail = user.email || '';
            setOriginalEmail(userEmail);
            setEmailData({
                newEmail: userEmail,
                currentPassword: '',
            });
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

    const handleStartEmailChange = () => {
        if (!user) return;

        setErrorMessage('');
        setSuccessMessage('');
        setEmailData({
            newEmail: user.email || '',
            currentPassword: '',
        });
        setShowEmailForm(true);
    };

    const handleEmailChange = async () => {
        if (!user || isEmailLoading) return;

        const trimmedEmail = emailData.newEmail.trim().toLowerCase();
        const currentEmail = (originalEmail || '').toLowerCase();

        if (!trimmedEmail) {
            setErrorMessage(t('settingsPage.errorMessages.emailRequired'));
            return;
        }

        if (!EMAIL_REGEX.test(trimmedEmail)) {
            setErrorMessage(t('settingsPage.errorMessages.emailInvalid'));
            return;
        }

        if (trimmedEmail === currentEmail) {
            setErrorMessage(t('settingsPage.errorMessages.emailSameAsCurrent'));
            return;
        }

        if (!emailData.currentPassword.trim()) {
            setErrorMessage(t('settingsPage.errorMessages.emailPasswordRequired'));
            return;
        }

        setIsEmailLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await authStore.changeEmail({
                currentPassword: emailData.currentPassword,
                newEmail: trimmedEmail,
            });

            const updatedEmail = authStore.user?.email ?? trimmedEmail;
            setOriginalEmail(updatedEmail);
            setSuccessMessage(t('settingsPage.successMessages.emailChanged'));
            setShowEmailForm(false);
            setEmailData({
                newEmail: updatedEmail,
                currentPassword: '',
            });
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '';
            if (message.includes('Current password is incorrect')) {
                setErrorMessage(t('settingsPage.errorMessages.currentPasswordIncorrect'));
            } else if (message.toLowerCase().includes('already exists')) {
                setErrorMessage(t('settingsPage.errorMessages.emailInUse'));
            } else if (message.toLowerCase().includes('valid email')) {
                setErrorMessage(t('settingsPage.errorMessages.emailInvalid'));
            } else if (message.toLowerCase().includes('different from current email')) {
                setErrorMessage(t('settingsPage.errorMessages.emailSameAsCurrent'));
            } else {
                setErrorMessage(t('settingsPage.errorMessages.emailChangeFailed'));
            }
            console.error('Email change error:', error);
        } finally {
            setIsEmailLoading(false);
        }
    };

    const handleCancelEmailChange = () => {
        setShowEmailForm(false);
        setEmailData({
            newEmail: user?.email || '',
            currentPassword: '',
        });
        setIsEmailLoading(false);
        setErrorMessage('');
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
    const trimmedNewEmail = emailData.newEmail.trim().toLowerCase();
    const hasEmailChanged = trimmedNewEmail !== (originalEmail || '').toLowerCase();
    const shouldShowEmailFormatError = emailData.newEmail.length > 0 && !EMAIL_REGEX.test(trimmedNewEmail);

    return (
        <BaseLayout title={t('settingsPage.title')} description={t('settingsPage.description')} headerVariant='dashboard'>
            <div class='mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8'>
                <div class='space-y-8'>
                    <div class='flex flex-col gap-2'>
                        <span class='text-xs font-medium uppercase tracking-wide text-interactive-primary'>
                            {t('settingsPage.heroLabel')}
                        </span>
                        <div class='flex flex-col gap-2'>
                            <h1 class='text-3xl font-semibold text-text-primary' data-testid='account-settings-header'>
                                {t('settingsPage.accountSettingsHeader')}
                            </h1>
                            <p class='max-w-2xl text-sm text-text-muted sm:text-base'>{t('settingsPage.accountSettingsSubheader')}</p>
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
                                    {user && shouldShowAvatar
                                        ? (
                                            <Avatar
                                                displayName={resolvedDisplayName}
                                                userId={user.uid}
                                                themeColor={membershipTheme || undefined}
                                                photoURL={user.photoURL}
                                                size='lg'
                                            />
                                        )
                                        : (
                                            <div class='flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-interactive-secondary via-interactive-secondary to-semantic-error text-lg font-semibold uppercase text-text-inverted shadow-inner'>
                                                {profileInitials}
                                            </div>
                                        )}

                                    <div class='space-y-1'>
                                        <p class='text-sm font-semibold uppercase tracking-wide text-text-muted'>
                                            {t('settingsPage.profileSummaryTitle')}
                                        </p>
                                        <div class='text-2xl font-semibold text-text-primary' data-testid='profile-display-name'>
                                            {resolvedDisplayName}
                                        </div>
                                        <p class='text-sm text-text-muted'>{t('settingsPage.profileSummaryDescription')}</p>
                                    </div>
                                </div>

                                <div class='space-y-3 text-sm'>
                                    <div class='rounded-lg border border-border-default bg-surface-muted/60 px-4 py-3'>
                                        <span class='text-text-muted'>{t('settingsPage.currentDisplayName')}</span>
                                        <div class='font-medium text-text-primary'>{resolvedDisplayName}</div>
                                    </div>
                                    <div class='rounded-lg border border-border-default bg-surface-muted/60 px-4 py-3'>
                                        <span class='text-text-muted'>{t('settingsPage.email')}</span>
                                        <div class='font-medium text-text-primary break-words' data-testid='profile-email'>
                                            {user.email}
                                        </div>
                                    </div>
                                    {/* Only show account role to system admins - it's not meaningful to regular users */}
                                    {user.role === SystemUserRoles.SYSTEM_ADMIN && (
                                        <div class='rounded-lg border border-border-default bg-surface-muted/60 px-4 py-3'>
                                            <span class='text-text-muted'>{t('settingsPage.profileSummaryRoleLabel')}</span>
                                            <div class='font-medium text-text-primary'>
                                                {user.role
                                                    ? t(`settingsPage.profileSummaryRole.${user.role}`, { defaultValue: t('settingsPage.profileSummaryRoleFallback') })
                                                    : t('settingsPage.profileSummaryRoleFallback')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <div class='space-y-6'>
                            <Card padding='lg' data-testid='profile-information-section'>
                                <div class='space-y-6'>
                                    <div class='space-y-2'>
                                        <h2 class='text-xl font-semibold text-text-primary'>{t('settingsPage.profileInformationHeader')}</h2>
                                        <p class='text-sm text-text-muted'>{t('settingsPage.profileInformationSubheader')}</p>
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
                                                error={isDisplayNameEmpty
                                                    ? t('settingsPage.errorMessages.displayNameEmpty')
                                                    : isDisplayNameTooLong
                                                    ? t('settingsPage.errorMessages.displayNameTooLong')
                                                    : undefined}
                                                data-testid='display-name-input'
                                            />
                                            <p class='text-xs text-text-muted'>{t('settingsPage.displayNameHelper')}</p>
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

                            <Card padding='lg' data-testid='email-section'>
                                <div class='space-y-6'>
                                    <div class='space-y-2'>
                                        <h2 class='text-xl font-semibold text-text-primary'>{t('settingsPage.emailSectionTitle')}</h2>
                                        <p class='text-sm text-text-muted'>{t('settingsPage.emailSectionDescription')}</p>
                                    </div>

                                    {!showEmailForm
                                        ? (
                                            <div class='flex flex-col gap-3 rounded-lg border border-border-default bg-surface-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
                                                <div>
                                                    <p class='text-xs font-semibold uppercase text-text-muted'>
                                                        {t('settingsPage.currentEmailLabel')}
                                                    </p>
                                                    <p class='font-medium text-text-primary break-words'>{originalEmail}</p>
                                                </div>
                                                <Button variant='secondary' onClick={handleStartEmailChange} data-testid='change-email-button'>
                                                    {t('settingsPage.changeEmailButton')}
                                                </Button>
                                            </div>
                                        )
                                        : (
                                            <Form
                                                onSubmit={() => {
                                                    if (!isEmailLoading) {
                                                        return handleEmailChange();
                                                    }
                                                }}
                                                className='space-y-5'
                                                data-testid='email-form'
                                            >
                                                <Input
                                                    label={t('settingsPage.newEmailLabel')}
                                                    type='email'
                                                    value={emailData.newEmail}
                                                    onChange={(value) => setEmailData((prev) => ({ ...prev, newEmail: value }))}
                                                    placeholder={t('settingsPage.newEmailPlaceholder')}
                                                    disabled={isEmailLoading}
                                                    error={shouldShowEmailFormatError ? t('settingsPage.errorMessages.emailInvalid') : undefined}
                                                    id='new-email-input'
                                                    data-testid='new-email-input'
                                                />

                                                <Input
                                                    label={t('settingsPage.emailPasswordLabel')}
                                                    type='password'
                                                    value={emailData.currentPassword}
                                                    onChange={(value) => setEmailData((prev) => ({ ...prev, currentPassword: value }))}
                                                    disabled={isEmailLoading}
                                                    id='email-password-input'
                                                    data-testid='email-password-input'
                                                />

                                                <div class='flex flex-col gap-3 sm:flex-row'>
                                                    <Button
                                                        type='submit'
                                                        disabled={isEmailLoading
                                                            || !hasEmailChanged
                                                            || shouldShowEmailFormatError
                                                            || emailData.currentPassword.trim().length === 0}
                                                        loading={isEmailLoading}
                                                        data-testid='update-email-button'
                                                    >
                                                        {t('settingsPage.updateEmailButton')}
                                                    </Button>
                                                    <Button
                                                        type='button'
                                                        variant='secondary'
                                                        onClick={handleCancelEmailChange}
                                                        disabled={isEmailLoading}
                                                        data-testid='cancel-email-button'
                                                    >
                                                        {t('settingsPage.cancelButton')}
                                                    </Button>
                                                </div>
                                            </Form>
                                        )}
                                </div>
                            </Card>

                            <Card padding='lg' data-testid='password-section'>
                                <div class='space-y-6'>
                                    <div class='space-y-2'>
                                        <h2 class='text-xl font-semibold text-text-primary'>{t('settingsPage.passwordHeader')}</h2>
                                        <p class='text-sm text-text-muted'>{t('settingsPage.passwordIntro')}</p>
                                    </div>

                                    <div class='rounded-xl border border-interactive-primary/20 bg-interactive-primary/10 px-4 py-4 text-sm text-interactive-primary'>
                                        <div class='font-semibold'>{t('settingsPage.passwordRequirementsHeading')}</div>
                                        <ul class='mt-2 space-y-2'>
                                            <li class='flex gap-2'>
                                                <span class='mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-interactive-primary' aria-hidden='true' />
                                                <span>{t('settingsPage.passwordRequirements.length')}</span>
                                            </li>
                                            <li class='flex gap-2'>
                                                <span class='mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-interactive-primary' aria-hidden='true' />
                                                <span>{t('settingsPage.passwordRequirements.mix')}</span>
                                            </li>
                                            <li class='flex gap-2'>
                                                <span class='mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-interactive-primary' aria-hidden='true' />
                                                <span>{t('settingsPage.passwordRequirements.reuse')}</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {!showPasswordForm
                                        ? (
                                            <Button onClick={() => setShowPasswordForm(true)} data-testid='change-password-button'>
                                                {t('settingsPage.changePasswordButton')}
                                            </Button>
                                        )
                                        : (
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
