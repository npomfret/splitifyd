import { translateProfileRole } from '@/app/i18n/dynamic-translations';
import { themeStore } from '@/app/stores/theme-store.ts';
import { Alert, Avatar, Button, Card, Checkbox, Form, Input, Stack, Typography } from '@/components/ui';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { logError } from '@/utils/browser-logger';
import { SystemUserRoles, toEmail, toPassword } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../app/apiClient';
import { useAuthRequired } from '@/app/hooks';
import { BaseLayout, FormSection, PageHeader, TwoColumnLayout } from '@/components/layout';

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

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [displayNameSignal] = useState(() => signal(''));
    const [originalDisplayNameSignal] = useState(() => signal(''));
    const [isLoadingSignal] = useState(() => signal(false));
    const [showPasswordFormSignal] = useState(() => signal(false));
    const [passwordDataSignal] = useState(() =>
        signal<PasswordChangeData>({
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: '',
        })
    );
    const [successMessageSignal] = useState(() => signal(''));
    const [errorMessageSignal] = useState(() => signal(''));
    const [originalEmailSignal] = useState(() => signal(''));
    const [showEmailFormSignal] = useState(() => signal(false));
    const [emailDataSignal] = useState(() =>
        signal<EmailChangeData>({
            newEmail: '',
            currentPassword: '',
        })
    );
    const [isEmailLoadingSignal] = useState(() => signal(false));
    const [marketingEmailsSignal] = useState(() => signal(false));
    const [isUpdatingEmailPrefsSignal] = useState(() => signal(false));

    const user = authStore.user;
    const resolvedDisplayName = toDisplayName(user?.displayName?.trim() || user?.email?.split('@')[0] || '');
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
            displayNameSignal.value = user.displayName || '';
            originalDisplayNameSignal.value = user.displayName || '';
            const userEmail = user.email || '';
            originalEmailSignal.value = userEmail;
            emailDataSignal.value = {
                newEmail: userEmail,
                currentPassword: '',
            };
            // Sync marketing emails preference from user profile
            marketingEmailsSignal.value = Boolean(user.marketingEmailsAcceptedAt);
        }
    }, [user]);

    // Clear messages after 5 seconds
    useEffect(() => {
        if (successMessageSignal.value || errorMessageSignal.value) {
            const timer = setTimeout(() => {
                successMessageSignal.value = '';
                errorMessageSignal.value = '';
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessageSignal.value, errorMessageSignal.value]);

    const handleDisplayNameUpdate = async () => {
        if (!user || authStore.isUpdatingProfile) return;

        errorMessageSignal.value = '';
        successMessageSignal.value = '';

        try {
            // Use the auth store's updateUserProfile method for real-time updates
            await authStore.updateUserProfile({ displayName: toDisplayName(displayNameSignal.value.trim()) });
            originalDisplayNameSignal.value = displayNameSignal.value.trim();
            successMessageSignal.value = t('settingsPage.successMessages.profileUpdated');
            // No need for token refresh or page reload - UI updates automatically via signals
        } catch (error) {
            errorMessageSignal.value = t('settingsPage.errorMessages.profileUpdateFailed');
            logError('settingsPage.profileUpdateFailed', error, {
                userId: user?.uid,
            });
        }
    };

    const handlePasswordChange = async () => {
        if (!user || isLoadingSignal.value) return;

        const passwordData = passwordDataSignal.value;

        // Validation
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
            errorMessageSignal.value = t('settingsPage.errorMessages.passwordAndNewRequired');
            return;
        }

        if (passwordData.newPassword.length < 12) {
            errorMessageSignal.value = t('settingsPage.errorMessages.passwordTooShort');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmNewPassword) {
            errorMessageSignal.value = t('settingsPage.errorMessages.passwordsNoMatch');
            return;
        }

        if (passwordData.currentPassword === passwordData.newPassword) {
            errorMessageSignal.value = t('settingsPage.errorMessages.passwordSameAsCurrent');
            return;
        }

        isLoadingSignal.value = true;
        errorMessageSignal.value = '';
        successMessageSignal.value = '';

        try {
            await apiClient.changePassword({
                currentPassword: toPassword(passwordData.currentPassword),
                newPassword: toPassword(passwordData.newPassword),
            });

            successMessageSignal.value = t('settingsPage.successMessages.passwordChanged');
            showPasswordFormSignal.value = false;
            passwordDataSignal.value = {
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: '',
            };
        } catch (error: unknown) {
            const errorWithCode = error as { code?: string; message?: string; };
            if (errorWithCode.code === 'AUTH_INVALID' || errorWithCode.message?.includes('Current password is incorrect')) {
                errorMessageSignal.value = t('settingsPage.errorMessages.currentPasswordIncorrect');
            } else {
                errorMessageSignal.value = t('settingsPage.errorMessages.passwordChangeFailed');
            }
            logError('settingsPage.passwordChangeFailed', error, {
                userId: user?.uid,
            });
        } finally {
            isLoadingSignal.value = false;
        }
    };

    const handleStartEmailChange = () => {
        if (!user) return;

        errorMessageSignal.value = '';
        successMessageSignal.value = '';
        emailDataSignal.value = {
            newEmail: user.email || '',
            currentPassword: '',
        };
        showEmailFormSignal.value = true;
    };

    const handleEmailChange = async () => {
        if (!user || isEmailLoadingSignal.value) return;

        const emailData = emailDataSignal.value;
        const trimmedEmail = emailData.newEmail.trim().toLowerCase();
        const currentEmail = (originalEmailSignal.value || '').toLowerCase();

        if (!trimmedEmail) {
            errorMessageSignal.value = t('settingsPage.errorMessages.emailRequired');
            return;
        }

        if (!EMAIL_REGEX.test(trimmedEmail)) {
            errorMessageSignal.value = t('settingsPage.errorMessages.emailInvalid');
            return;
        }

        if (trimmedEmail === currentEmail) {
            errorMessageSignal.value = t('settingsPage.errorMessages.emailSameAsCurrent');
            return;
        }

        if (!emailData.currentPassword.trim()) {
            errorMessageSignal.value = t('settingsPage.errorMessages.emailPasswordRequired');
            return;
        }

        isEmailLoadingSignal.value = true;
        errorMessageSignal.value = '';
        successMessageSignal.value = '';

        try {
            await authStore.changeEmail({
                currentPassword: toPassword(emailData.currentPassword),
                newEmail: toEmail(trimmedEmail),
            });

            const updatedEmail = authStore.user?.email ?? trimmedEmail;
            originalEmailSignal.value = updatedEmail;
            successMessageSignal.value = t('settingsPage.successMessages.emailChanged');
            showEmailFormSignal.value = false;
            emailDataSignal.value = {
                newEmail: updatedEmail,
                currentPassword: '',
            };
        } catch (error: unknown) {
            const errorWithCode = error as { code?: string; message?: string; };
            const code = errorWithCode.code;
            const message = typeof errorWithCode.message === 'string' ? errorWithCode.message : '';

            if (code === 'AUTH_INVALID' || message.includes('Current password is incorrect')) {
                errorMessageSignal.value = t('settingsPage.errorMessages.currentPasswordIncorrect');
            } else if (code === 'ALREADY_EXISTS' || message.toLowerCase().includes('already exists')) {
                errorMessageSignal.value = t('settingsPage.errorMessages.emailInUse');
            } else if (code === 'VALIDATION_ERROR' || message.toLowerCase().includes('valid email')) {
                errorMessageSignal.value = t('settingsPage.errorMessages.emailInvalid');
            } else if (message.toLowerCase().includes('different from current email')) {
                errorMessageSignal.value = t('settingsPage.errorMessages.emailSameAsCurrent');
            } else {
                errorMessageSignal.value = t('settingsPage.errorMessages.emailChangeFailed');
            }
            logError('settingsPage.emailChangeFailed', error, {
                userId: user?.uid,
                attemptedEmail: trimmedEmail,
            });
        } finally {
            isEmailLoadingSignal.value = false;
        }
    };

    const handleCancelEmailChange = () => {
        showEmailFormSignal.value = false;
        emailDataSignal.value = {
            newEmail: user?.email || '',
            currentPassword: '',
        };
        isEmailLoadingSignal.value = false;
        errorMessageSignal.value = '';
    };

    const handleCancelPasswordChange = () => {
        showPasswordFormSignal.value = false;
        passwordDataSignal.value = {
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: '',
        };
        errorMessageSignal.value = '';
    };

    const handleMarketingEmailsToggle = async (checked: boolean) => {
        if (!user || isUpdatingEmailPrefsSignal.value) return;

        isUpdatingEmailPrefsSignal.value = true;
        errorMessageSignal.value = '';
        successMessageSignal.value = '';

        try {
            await authStore.updateUserProfile({ marketingEmailsAccepted: checked });
            marketingEmailsSignal.value = checked;
            successMessageSignal.value = t('settingsPage.successMessages.emailPreferencesUpdated');
        } catch (error) {
            errorMessageSignal.value = t('settingsPage.errorMessages.emailPreferencesUpdateFailed');
            logError('settingsPage.emailPreferencesUpdateFailed', error, { userId: user.uid });
        } finally {
            isUpdatingEmailPrefsSignal.value = false;
        }
    };

    if (!user) {
        return null;
    }

    const displayName = displayNameSignal.value;
    const originalDisplayName = originalDisplayNameSignal.value;
    const isLoading = isLoadingSignal.value;
    const showPasswordForm = showPasswordFormSignal.value;
    const passwordData = passwordDataSignal.value;
    const successMessage = successMessageSignal.value;
    const errorMessage = errorMessageSignal.value;
    const originalEmail = originalEmailSignal.value;
    const showEmailForm = showEmailFormSignal.value;
    const emailData = emailDataSignal.value;
    const isEmailLoading = isEmailLoadingSignal.value;
    const marketingEmails = marketingEmailsSignal.value;
    const isUpdatingEmailPrefs = isUpdatingEmailPrefsSignal.value;

    const hasDisplayNameChanged = displayName.trim() !== originalDisplayName;
    const isDisplayNameEmpty = displayName.trim().length === 0;
    const isDisplayNameTooLong = displayName.trim().length > 100;
    const trimmedNewEmail = emailData.newEmail.trim().toLowerCase();
    const hasEmailChanged = trimmedNewEmail !== (originalEmail || '').toLowerCase();
    const shouldShowEmailFormatError = emailData.newEmail.length > 0 && !EMAIL_REGEX.test(trimmedNewEmail);

    return (
        <BaseLayout title={t('settingsPage.title')} description={t('settingsPage.description')} headerVariant='dashboard'>
            <div className='mx-auto max-w-(--breakpoint-xl) px-4 py-10 sm:px-6 lg:px-8'>
                <Stack spacing='lg'>
                    <PageHeader
                        label={t('settingsPage.heroLabel')}
                        title={t('settingsPage.accountSettingsHeader')}
                        description={t('settingsPage.accountSettingsSubheader')}
                    />

                    {(successMessage || errorMessage) && (
                        <Stack spacing='sm'>
                            {successMessage && <Alert type='success' message={successMessage} />}
                            {errorMessage && <Alert type='error' message={errorMessage} />}
                        </Stack>
                    )}

                    <TwoColumnLayout
                        sidebarWidth='medium'
                        stickyHeader
                        sidebar={
                            <Card padding='lg' className='shadow-md'>
                                <Stack spacing='lg'>
                                    <div className='flex items-start gap-4'>
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
                                                <div className='flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-interactive-secondary via-interactive-secondary to-semantic-error text-lg font-semibold uppercase text-text-inverted shadow-inner'>
                                                    {profileInitials}
                                                </div>
                                            )}

                                        <Stack spacing='xs'>
                                            <p className='text-sm font-semibold uppercase tracking-wide text-text-muted'>
                                                {t('settingsPage.profileSummaryTitle')}
                                            </p>
                                            <div className='text-2xl font-semibold text-text-primary'>
                                                {resolvedDisplayName}
                                            </div>
                                            <p className='help-text'>{t('settingsPage.profileSummaryDescription')}</p>
                                        </Stack>
                                    </div>

                                    <Stack spacing='sm' className='text-sm'>
                                        <div className='rounded-lg border border-border-default bg-surface-subtle px-4 py-3'>
                                            <span className='text-text-muted'>{t('settingsPage.currentDisplayName')}</span>
                                            <div className='font-medium text-text-primary' aria-label={t('settingsPage.displayNameValue')}>{resolvedDisplayName}</div>
                                        </div>
                                        <div className='rounded-lg border border-border-default bg-surface-subtle px-4 py-3'>
                                            <span className='text-text-muted'>{t('settingsPage.email')}</span>
                                            <div className='font-medium text-text-primary wrap-break-word' aria-label={t('settingsPage.emailValue')}>
                                                {user.email}
                                            </div>
                                        </div>
                                        {/* Only show account role to system admins - it's not meaningful to regular users */}
                                        {user.role === SystemUserRoles.SYSTEM_ADMIN && (
                                            <div className='rounded-lg border border-border-default bg-surface-subtle px-4 py-3'>
                                                <span className='text-text-muted'>{t('settingsPage.profileSummaryRoleLabel')}</span>
                                                <div className='font-medium text-text-primary'>
                                                    {user.role
                                                        ? translateProfileRole(user.role, t) || t('settingsPage.profileSummaryRoleFallback')
                                                        : t('settingsPage.profileSummaryRoleFallback')}
                                                </div>
                                            </div>
                                        )}
                                    </Stack>
                                </Stack>
                            </Card>
                        }
                    >
                        <FormSection
                            title={t('settingsPage.profileInformationHeader')}
                            description={t('settingsPage.profileInformationSubheader')}
                            moreInfoLabel={t('common.moreInfo')}
                        >
                            <Form
                                onSubmit={() => {
                                    if (!hasDisplayNameChanged || authStore.isUpdatingProfile || isDisplayNameEmpty || isDisplayNameTooLong) {
                                        return;
                                    }
                                    return handleDisplayNameUpdate();
                                }}
                            >
                                <Stack spacing='md'>
                                    <Input
                                        id='settings-display-name'
                                        label={t('settingsPage.displayNameLabel')}
                                        value={displayName}
                                        onChange={(value) => {
                                            displayNameSignal.value = value;
                                        }}
                                        placeholder={t('settingsPage.displayNamePlaceholder')}
                                        disabled={authStore.isUpdatingProfile}
                                        error={isDisplayNameEmpty
                                            ? t('settingsPage.errorMessages.displayNameEmpty')
                                            : isDisplayNameTooLong
                                            ? t('settingsPage.errorMessages.displayNameTooLong')
                                            : undefined}
                                    />

                                    <Button
                                        type='submit'
                                        disabled={!hasDisplayNameChanged || authStore.isUpdatingProfile || isDisplayNameEmpty || isDisplayNameTooLong}
                                        loading={authStore.isUpdatingProfile}
                                    >
                                        {t('settingsPage.saveChangesButton')}
                                    </Button>
                                </Stack>
                            </Form>
                        </FormSection>

                        <FormSection
                            title={t('settingsPage.emailSectionTitle')}
                            description={t('settingsPage.emailSectionDescription')}
                            moreInfoLabel={t('common.moreInfo')}
                        >
                            {!showEmailForm
                                ? (
                                    <div className='flex flex-col gap-3 rounded-lg border border-border-default bg-surface-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
                                        <div>
                                            <p className='text-xs font-semibold uppercase text-text-muted'>
                                                {t('settingsPage.currentEmailLabel')}
                                            </p>
                                            <p className='font-medium text-text-primary wrap-break-word'>{originalEmail}</p>
                                        </div>
                                        <Button variant='secondary' onClick={handleStartEmailChange}>
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
                                    >
                                        <Stack spacing='md'>
                                            <Input
                                                label={t('settingsPage.newEmailLabel')}
                                                type='email'
                                                value={emailData.newEmail}
                                                onChange={(value) => {
                                                    emailDataSignal.value = { ...emailDataSignal.value, newEmail: value };
                                                }}
                                                placeholder={t('settingsPage.newEmailPlaceholder')}
                                                disabled={isEmailLoading}
                                                error={shouldShowEmailFormatError ? t('settingsPage.errorMessages.emailInvalid') : undefined}
                                                id='new-email-input'
                                            />

                                            <Input
                                                label={t('settingsPage.emailPasswordLabel')}
                                                type='password'
                                                value={emailData.currentPassword}
                                                onChange={(value) => {
                                                    emailDataSignal.value = { ...emailDataSignal.value, currentPassword: value };
                                                }}
                                                disabled={isEmailLoading}
                                                id='email-password-input'
                                            />

                                            <div className='flex flex-col gap-3 sm:flex-row'>
                                                <Button
                                                    type='submit'
                                                    disabled={isEmailLoading
                                                        || !hasEmailChanged
                                                        || shouldShowEmailFormatError
                                                        || emailData.currentPassword.trim().length === 0}
                                                    loading={isEmailLoading}
                                                >
                                                    {t('settingsPage.updateEmailButton')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='secondary'
                                                    onClick={handleCancelEmailChange}
                                                    disabled={isEmailLoading}
                                                >
                                                    {t('settingsPage.cancelButton')}
                                                </Button>
                                            </div>
                                        </Stack>
                                    </Form>
                                )}
                        </FormSection>

                        <FormSection
                            title={t('settingsPage.passwordHeader')}
                            description={t('settingsPage.passwordIntro')}
                            moreInfoLabel={t('common.moreInfo')}
                        >
                            <div className='rounded-xl border border-interactive-primary/20 bg-interactive-primary/10 px-4 py-4 text-sm text-interactive-primary'>
                                <div className='font-semibold'>{t('settingsPage.passwordRequirementsHeading')}</div>
                                <ul className='mt-2 space-y-2'>
                                    <li className='flex gap-2'>
                                        <span className='mt-1 h-2 w-2 shrink-0 rounded-full bg-interactive-primary' aria-hidden='true' />
                                        <span>{t('settingsPage.passwordRequirements.length')}</span>
                                    </li>
                                    <li className='flex gap-2'>
                                        <span className='mt-1 h-2 w-2 shrink-0 rounded-full bg-interactive-primary' aria-hidden='true' />
                                        <span>{t('settingsPage.passwordRequirements.mix')}</span>
                                    </li>
                                    <li className='flex gap-2'>
                                        <span className='mt-1 h-2 w-2 shrink-0 rounded-full bg-interactive-primary' aria-hidden='true' />
                                        <span>{t('settingsPage.passwordRequirements.reuse')}</span>
                                    </li>
                                </ul>
                            </div>

                            {!showPasswordForm
                                ? (
                                    <Button
                                        onClick={() => {
                                            showPasswordFormSignal.value = true;
                                        }}
                                    >
                                        {t('settingsPage.changePasswordButton')}
                                    </Button>
                                )
                                : (
                                    <Form
                                        onSubmit={() => {
                                            if (!isLoading) {
                                                return handlePasswordChange();
                                            }
                                        }}
                                    >
                                        <Stack spacing='md'>
                                            <Input
                                                label={t('settingsPage.currentPasswordLabel')}
                                                type='password'
                                                name='currentPassword'
                                                value={passwordData.currentPassword}
                                                onChange={(value) => {
                                                    passwordDataSignal.value = { ...passwordDataSignal.value, currentPassword: value };
                                                }}
                                                disabled={isLoading}
                                                id='current-password-input'
                                            />

                                            <Input
                                                label={t('settingsPage.newPasswordLabel')}
                                                type='password'
                                                name='newPassword'
                                                value={passwordData.newPassword}
                                                onChange={(value) => {
                                                    passwordDataSignal.value = { ...passwordDataSignal.value, newPassword: value };
                                                }}
                                                disabled={isLoading}
                                                id='new-password-input'
                                            />

                                            <Input
                                                label={t('settingsPage.confirmNewPasswordLabel')}
                                                type='password'
                                                name='confirmNewPassword'
                                                value={passwordData.confirmNewPassword}
                                                onChange={(value) => {
                                                    passwordDataSignal.value = { ...passwordDataSignal.value, confirmNewPassword: value };
                                                }}
                                                disabled={isLoading}
                                                id='confirm-password-input'
                                            />

                                            <div className='flex flex-col gap-3 sm:flex-row'>
                                                <Button type='submit' disabled={isLoading} loading={isLoading}>
                                                    {t('settingsPage.updatePasswordButton')}
                                                </Button>
                                                <Button type='button' variant='secondary' onClick={handleCancelPasswordChange} disabled={isLoading}>
                                                    {t('settingsPage.cancelButton')}
                                                </Button>
                                            </div>
                                        </Stack>
                                    </Form>
                                )}
                        </FormSection>

                        <FormSection
                            title={t('languageSelector.label')}
                            description={t('languageSelector.description')}
                            moreInfoLabel={t('common.moreInfo')}
                        >
                            <LanguageSwitcher variant='full' />
                        </FormSection>

                        <FormSection
                            title={t('settingsPage.emailPreferences.title')}
                            description={t('settingsPage.emailPreferences.description')}
                            moreInfoLabel={t('common.moreInfo')}
                        >
                            <Stack spacing='md'>
                                {/* Account notifications - display-only, accepted at registration */}
                                <div className='rounded-lg border border-border-default bg-surface-muted px-4 py-4'>
                                    <div className='flex items-start gap-3'>
                                        <div className='mt-0.5 h-5 w-5 shrink-0 rounded border border-interactive-primary bg-interactive-primary flex items-center justify-center'>
                                            <svg className='h-3 w-3 text-interactive-primary-foreground' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'>
                                                <path d='M10 3L4.5 8.5L2 6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                                            </svg>
                                        </div>
                                        <div>
                                            <Typography variant='body' className='font-medium text-text-primary'>
                                                {t('settingsPage.emailPreferences.adminEmails.label')}
                                            </Typography>
                                            <Typography variant='caption' className='text-text-muted mt-1'>
                                                {t('settingsPage.emailPreferences.adminEmails.description')}
                                            </Typography>
                                            {user.adminEmailsAcceptedAt && (
                                                <Typography variant='caption' className='text-text-muted mt-2'>
                                                    {t('settingsPage.emailPreferences.acceptedOn', {
                                                        date: new Date(user.adminEmailsAcceptedAt).toLocaleDateString(),
                                                    })}
                                                </Typography>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Marketing emails - toggleable */}
                                <Checkbox
                                    label={
                                        <span className='text-text-primary'>
                                            {t('settingsPage.emailPreferences.marketingEmails.label')}
                                        </span>
                                    }
                                    checked={marketingEmails}
                                    onChange={handleMarketingEmailsToggle}
                                    disabled={isUpdatingEmailPrefs}
                                />
                                <Typography variant='caption' className='text-text-muted -mt-2 ml-7'>
                                    {t('settingsPage.emailPreferences.marketingEmails.description')}
                                </Typography>
                            </Stack>
                        </FormSection>
                    </TwoColumnLayout>
                </Stack>
            </div>
        </BaseLayout>
    );
}
