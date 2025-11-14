import { STORAGE_KEYS } from '@/constants.ts';
import { Input } from '@/components/ui';
import { navigationService } from '@/services/navigation.service';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { AuthForm } from '../components/auth/AuthForm';
import { AuthLayout } from '../components/auth/AuthLayout';
import { EmailInput } from '../components/auth/EmailInput';
import { PasswordInput } from '../components/auth/PasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { logError } from '../utils/browser-logger';

export function RegisterPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    // Local form state - properly encapsulated within component
    // Initialize from sessionStorage to persist across potential remounts
    const [name, setName] = useState(() => {
        try {
            return sessionStorage.getItem(STORAGE_KEYS.REGISTER_NAME) || '';
        } catch {
            return '';
        }
    });
    const [email, setEmail] = useState(() => {
        try {
            return sessionStorage.getItem(STORAGE_KEYS.REGISTER_EMAIL) || '';
        } catch {
            return '';
        }
    });
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreeToTerms, setAgreeToTerms] = useState(() => {
        try {
            return sessionStorage.getItem(STORAGE_KEYS.REGISTER_AGREE_TERMS) === 'true';
        } catch {
            return false;
        }
    });
    const [agreeToCookies, setAgreeToCookies] = useState(() => {
        try {
            return sessionStorage.getItem(STORAGE_KEYS.REGISTER_AGREE_COOKIES) === 'true';
        } catch {
            return false;
        }
    });
    const [agreeToPrivacy, setAgreeToPrivacy] = useState(() => {
        try {
            return sessionStorage.getItem(STORAGE_KEYS.REGISTER_AGREE_PRIVACY) === 'true';
        } catch {
            return false;
        }
    });
    const [localError, setLocalError] = useState<string | null>(null);

    // Clear any previous errors when component mounts and remove legacy password cache entries
    useEffect(() => {
        setLocalError(null);
        try {
            sessionStorage.removeItem(STORAGE_KEYS.REGISTER_PASSWORD);
            sessionStorage.removeItem(STORAGE_KEYS.REGISTER_CONFIRM_PASSWORD);
        } catch {
            // Ignore storage access errors
        }
    }, []);

    // Redirect if already logged in
    useEffect(() => {
        if (authStore.user) {
            // Check for returnUrl in query parameters
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('returnUrl');

            if (returnUrl) {
                // Decode and navigate to the return URL
                const decodedReturnUrl = decodeURIComponent(returnUrl);
                navigationService.navigateTo(decodedReturnUrl);
            } else {
                // Default to dashboard if no return URL
                navigationService.goToDashboard();
            }
        }
    }, [authStore.user]);

    const validateForm = (): string | null => {
        if (!name.trim()) {
            return t('registerPage.validation.nameRequired');
        }
        if (!email.trim()) {
            return t('registerPage.validation.emailRequired');
        }
        if (!password) {
            return t('registerPage.validation.passwordRequired');
        }
        if (password.length < 12) {
            return t('registerPage.validation.passwordTooShort');
        }
        if (password !== confirmPassword) {
            return t('registerPage.validation.passwordsNoMatch');
        }
        if (!agreeToTerms) {
            return t('registerPage.validation.termsRequired');
        }
        if (!agreeToCookies) {
            return t('registerPage.validation.cookiesRequired');
        }
        if (!agreeToPrivacy) {
            return t('registerPage.validation.privacyRequired');
        }
        return null;
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            // Validation error is already displayed to the user
            setLocalError(validationError);
            return;
        }

        setLocalError(null);

        try {
            await authStore.register(email.trim(), password, name.trim(), agreeToTerms, agreeToCookies, agreeToPrivacy);
            // Clear form data from sessionStorage on successful registration
            try {
                sessionStorage.removeItem(STORAGE_KEYS.REGISTER_NAME);
                sessionStorage.removeItem(STORAGE_KEYS.REGISTER_EMAIL);
                sessionStorage.removeItem(STORAGE_KEYS.REGISTER_AGREE_TERMS);
                sessionStorage.removeItem(STORAGE_KEYS.REGISTER_AGREE_COOKIES);
                sessionStorage.removeItem(STORAGE_KEYS.REGISTER_AGREE_PRIVACY);
            } catch {
                // Ignore cleanup errors
            }
            // Redirect will happen via useEffect when user state updates
        } catch (error) {
            logError('Registration attempt failed', error, { email: email.trim(), displayName: name.trim() });
        }
    };

    const isFormValid = name.trim() && email.trim() && password && confirmPassword && agreeToTerms && agreeToCookies && agreeToPrivacy;
    const isSubmitting = authStore.loading;
    const displayError = authStore.error || localError;

    return (
        <AuthLayout title={t('registerPage.title')} description={t('registerPage.description')}>
            <AuthForm onSubmit={handleSubmit} error={displayError} disabled={isSubmitting}>
                <Input
                    id='fullname-input'
                    label={t('registerPage.fullNameLabel')}
                    value={name}
                    onChange={(value) => {
                        setName(value);
                        try {
                            sessionStorage.setItem(STORAGE_KEYS.REGISTER_NAME, value);
                        } catch {
                            // Ignore sessionStorage errors
                        }
                    }}
                    placeholder={t('registerPage.fullNamePlaceholder')}
                    required
                    disabled={isSubmitting}
                    autoComplete='off'
                />

                <EmailInput
                    value={email}
                    onInput={(value) => {
                        setEmail(value);
                        try {
                            sessionStorage.setItem(STORAGE_KEYS.REGISTER_EMAIL, value);
                        } catch {
                            // Ignore sessionStorage errors
                        }
                        // Clear email-related errors when user changes email field
                        if (authStore.error && authStore.error.toLowerCase().includes('email')) {
                            authStore.clearError();
                        }
                    }}
                    disabled={isSubmitting}
                />

                <PasswordInput
                    id='password-input'
                    value={password}
                    onInput={(value) => {
                        setPassword(value);
                    }}
                    label={t('registerPage.passwordLabel')}
                    placeholder={t('registerPage.passwordPlaceholder')}
                    disabled={isSubmitting}
                    showStrength
                />

                <PasswordInput
                    id='confirm-password-input'
                    value={confirmPassword}
                    onInput={(value) => {
                        setConfirmPassword(value);
                    }}
                    label={t('registerPage.confirmPasswordLabel')}
                    placeholder={t('registerPage.confirmPasswordPlaceholder')}
                    disabled={isSubmitting}
                />

                <div class='space-y-3'>
                    <label class='flex items-start gap-3 text-text-primary'>
                        <input
                            type='checkbox'
                            data-testid='terms-checkbox'
                            checked={agreeToTerms}
                            onChange={(e) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                setAgreeToTerms(checked);
                                try {
                                    sessionStorage.setItem(STORAGE_KEYS.REGISTER_AGREE_TERMS, checked.toString());
                                } catch {
                                    // Ignore sessionStorage errors
                                }
                            }}
                            class='h-4 w-4 rounded border border-border-default text-interactive-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base mt-1 flex-shrink-0 transition-colors'
                            disabled={isSubmitting}
                            required
                            autoComplete='off'
                        />
                        <span class='text-sm text-text-primary'>
                            {t('registerPage.acceptTerms')}{' '}
                            <a href='/terms' target='_blank' class='font-semibold text-interactive-primary hover:opacity-80 transition-opacity'>
                                {t('registerPage.termsOfService')}
                            </a>
                        </span>
                    </label>

                    <label class='flex items-start gap-3 text-text-primary'>
                        <input
                            type='checkbox'
                            data-testid='cookies-checkbox'
                            checked={agreeToCookies}
                            onChange={(e) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                setAgreeToCookies(checked);
                                try {
                                    sessionStorage.setItem(STORAGE_KEYS.REGISTER_AGREE_COOKIES, checked.toString());
                                } catch {
                                    // Ignore sessionStorage errors
                                }
                            }}
                            class='h-4 w-4 rounded border border-border-default text-interactive-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base mt-1 flex-shrink-0 transition-colors'
                            disabled={isSubmitting}
                            required
                            autoComplete='off'
                        />
                        <span class='text-sm text-text-primary'>
                            {t('registerPage.acceptTerms')}{' '}
                            <a href='/cookies' target='_blank' class='font-semibold text-interactive-primary hover:opacity-80 transition-opacity'>
                                {t('registerPage.cookiePolicy')}
                            </a>
                        </span>
                    </label>

                    <label class='flex items-start gap-3 text-text-primary'>
                        <input
                            type='checkbox'
                            data-testid='privacy-checkbox'
                            checked={agreeToPrivacy}
                            onChange={(e) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                setAgreeToPrivacy(checked);
                                try {
                                    sessionStorage.setItem(STORAGE_KEYS.REGISTER_AGREE_PRIVACY, checked.toString());
                                } catch {
                                    // Ignore sessionStorage errors
                                }
                            }}
                            class='h-4 w-4 rounded border border-border-default text-interactive-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base mt-1 flex-shrink-0 transition-colors'
                            disabled={isSubmitting}
                            required
                            autoComplete='off'
                        />
                        <span class='text-sm text-text-primary'>
                            {t('registerPage.acceptTerms')}{' '}
                            <a href='/privacy-policy' target='_blank' class='font-semibold text-interactive-primary hover:opacity-80 transition-opacity'>
                                {t('registerPage.privacyPolicy')}
                            </a>
                        </span>
                    </label>
                </div>

                <SubmitButton loading={isSubmitting} disabled={!isFormValid}>
                    {t('registerPage.submitButton')}
                </SubmitButton>

                <div class='text-center'>
                    <p class='text-sm text-text-muted'>
                        {t('registerPage.hasAccount')}{' '}
                        <button
                            type='button'
                            onClick={() => navigationService.goToLogin()}
                            class='font-semibold text-interactive-primary hover:opacity-80 transition-opacity'
                        >
                            {t('registerPage.signIn')}
                        </button>
                    </p>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
