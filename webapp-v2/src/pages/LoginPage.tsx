import { STORAGE_KEYS } from '@/constants.ts';
import { navigationService } from '@/services/navigation.service';
import { toPassword } from '@billsplit-wl/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { AuthForm } from '../components/auth/AuthForm';
import { AuthLayout } from '../components/auth/AuthLayout';
import { DefaultLoginButton } from '../components/auth/DefaultLoginButton';
import { EmailInput } from '../components/auth/EmailInput';
import { PasswordInput } from '../components/auth/PasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { Button, Checkbox } from '../components/ui';
import { logError } from '../utils/browser-logger';

export function LoginPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    // Access signal values directly in JSX for reactivity (Preact signals auto-subscribe)
    // Note: Do NOT use useComputed here - it breaks reactivity when passed to child components

    // Component state with sessionStorage persistence
    const [email, setEmail] = useState(() => {
        if (typeof window === 'undefined') {
            return '';
        }
        try {
            return sessionStorage.getItem(STORAGE_KEYS.LOGIN_EMAIL) || '';
        } catch {
            return '';
        }
    });
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    // Persist to sessionStorage on changes
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        try {
            sessionStorage.setItem(STORAGE_KEYS.LOGIN_EMAIL, email);
        } catch {
            // Ignore storage failures (private browsing, disabled storage, etc.)
        }
    }, [email]);

    useEffect(() => {
        try {
            sessionStorage.removeItem(STORAGE_KEYS.LOGIN_PASSWORD);
        } catch {
            // Ignore storage access errors
        }
    }, []);

    // Note: Error clearing is handled by auth-store.login() which clears errors before attempting login

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

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const trimmedEmail = email.trim();

        if (!trimmedEmail || !password) {
            const errors = [];
            if (!trimmedEmail) errors.push(t('loginPage.validation.emailRequired'));
            if (!password) errors.push(t('loginPage.validation.passwordRequired'));
            // Validation errors are handled by the form UI
            return;
        }

        try {
            await authStore.login(trimmedEmail, toPassword(password), rememberMe);
            // Redirect will happen via useEffect when user state updates
        } catch (error) {
            logError('Login attempt failed', error, { email: trimmedEmail });
            // Error is already set in authStore.errorSignal by the login() method
        }
    };

    const fillFormResolver = useRef<(() => void) | null>(null);

    const handleFillForm = async (defaultEmail: string, defaultPassword: string): Promise<void> => {
        return new Promise((resolve) => {
            fillFormResolver.current = resolve;
            setEmail(defaultEmail);
            setPassword(defaultPassword);
        });
    };

    // Effect to resolve the promise when state has updated
    useEffect(() => {
        if (fillFormResolver.current) {
            fillFormResolver.current();
            fillFormResolver.current = null;
        }
    }, [email, password]);

    const isFormValid = email.trim() && password;

    const errorValue = authStore.errorSignal.value;
    const loadingValue = authStore.loadingSignal.value;

    return (
        <AuthLayout title={t('loginPage.title')} description={t('loginPage.description')}>
            <AuthForm onSubmit={handleSubmit} error={errorValue} disabled={loadingValue}>
                <EmailInput value={email} onInput={setEmail} autoFocus disabled={loadingValue} />

                <PasswordInput value={password} onInput={setPassword} disabled={loadingValue} autoComplete='off' />

                <div class='flex items-center justify-between'>
                    <Checkbox
                        label={t('loginPage.rememberMe')}
                        checked={rememberMe}
                        onChange={setRememberMe}
                        disabled={loadingValue}
                        data-testid='remember-me-checkbox'
                    />

                    <Button
                        type='button'
                        onClick={() => navigationService.goToResetPassword()}
                        variant='ghost'
                        size='sm'
                        className='text-interactive-primary'
                    >
                        {t('loginPage.forgotPassword')}
                    </Button>
                </div>

                <SubmitButton loading={loadingValue} disabled={!isFormValid}>
                    {t('loginPage.submitButton')}
                </SubmitButton>

                <DefaultLoginButton onFillForm={handleFillForm} onSubmit={() => handleSubmit(new Event('submit'))} disabled={loadingValue} />

                <div class='text-center'>
                    <p class='text-sm text-text-muted'>
                        {t('loginPage.noAccount')}{' '}
                        <Button
                            type='button'
                            data-testid='loginpage-signup-button'
                            onClick={() => {
                                // Preserve returnUrl when navigating to register
                                const urlParams = new URLSearchParams(window.location.search);
                                const returnUrl = urlParams.get('returnUrl');
                                if (returnUrl) {
                                    const targetUrl = `/register?returnUrl=${encodeURIComponent(returnUrl)}`;
                                    navigationService.navigateTo(targetUrl);
                                } else {
                                    navigationService.goToRegister();
                                }
                            }}
                            variant='ghost'
                            size='sm'
                            className='font-semibold text-interactive-primary inline'
                        >
                            {t('loginPage.signUp')}
                        </Button>
                    </p>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
