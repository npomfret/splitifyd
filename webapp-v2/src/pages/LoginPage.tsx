import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { navigationService } from '@/services/navigation.service';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthForm } from '../components/auth/AuthForm';
import { EmailInput } from '../components/auth/EmailInput';
import { PasswordInput } from '../components/auth/PasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { DefaultLoginButton } from '../components/auth/DefaultLoginButton';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { logError } from '../utils/browser-logger';

export function LoginPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    // Component state with sessionStorage persistence
    const [email, setEmail] = useState(() => sessionStorage.getItem('login-email') || '');
    const [password, setPassword] = useState(() => sessionStorage.getItem('login-password') || '');

    // Persist to sessionStorage on changes
    useEffect(() => {
        sessionStorage.setItem('login-email', email);
    }, [email]);

    useEffect(() => {
        sessionStorage.setItem('login-password', password);
    }, [password]);

    // Clear any previous errors when component mounts
    useEffect(() => {
        authStore.clearError();
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
            await authStore.login(trimmedEmail, password);
            // Redirect will happen via useEffect when user state updates
        } catch (error) {
            logError('Login attempt failed', error, { email: trimmedEmail });
        }
    };

    const handleFillForm = (defaultEmail: string, defaultPassword: string) => {
        setEmail(defaultEmail);
        setPassword(defaultPassword);
    };

    const isFormValid = email.trim() && password;
    const isSubmitting = authStore.loading;

    return (
        <AuthLayout title={t('loginPage.title')} description={t('loginPage.description')}>
            <AuthForm onSubmit={handleSubmit} error={authStore.error} disabled={isSubmitting}>
                <EmailInput value={email} onInput={setEmail} autoFocus disabled={isSubmitting} />

                <PasswordInput value={password} onInput={setPassword} disabled={isSubmitting} autoComplete="current-password" />

                <div class="flex items-center justify-between">
                    <label class="flex items-center">
                        <input type="checkbox" data-testid="remember-me-checkbox" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" disabled={isSubmitting} />
                        <span class="ml-2 block text-sm text-gray-700">{t('loginPage.rememberMe')}</span>
                    </label>

                    <button type="button" onClick={() => navigationService.goToResetPassword()} class="text-sm text-blue-600 hover:text-blue-500 transition-colors">
                        {t('loginPage.forgotPassword')}
                    </button>
                </div>

                <SubmitButton loading={isSubmitting} disabled={!isFormValid}>
                    {t('loginPage.submitButton')}
                </SubmitButton>

                <DefaultLoginButton onFillForm={handleFillForm} onSubmit={() => handleSubmit(new Event('submit'))} disabled={isSubmitting} />

                <div class="text-center">
                    <p class="text-sm text-gray-600">
                        {t('loginPage.noAccount')}{' '}
                        <button
                            type="button"
                            data-testid="loginpage-signup-button"
                            onClick={() => {
                                const buildTime = '__ULTRA_FRESH_BUILD_' + Date.now() + '_NEW_HASH__';
                                console.log('🚀🚀🚀 COMPLETELY NEW LOGIN CODE EXECUTING!!! BUILD:', buildTime);
                                console.log('🚀🚀🚀 BUTTON CLICKED - NEW MODULE HASH - TIMESTAMP:', Date.now());
                                // Preserve returnUrl when navigating to register
                                const urlParams = new URLSearchParams(window.location.search);
                                const returnUrl = urlParams.get('returnUrl');
                                console.log('🚀🚀🚀 LOGIN PAGE URL PARAMS:', window.location.search);
                                console.log('🚀🚀🚀 LOGIN PAGE RETURN URL:', returnUrl);
                                if (returnUrl) {
                                    const targetUrl = `/register?returnUrl=${encodeURIComponent(returnUrl)}`;
                                    console.log('🔥🔥🔥 NEW HASH - Navigating to:', targetUrl);
                                    navigationService.navigateTo(targetUrl);
                                } else {
                                    console.log('🔥🔥🔥 NEW HASH - No returnUrl, going to register default');
                                    navigationService.goToRegister();
                                }
                            }}
                            class="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                        >
                            {t('loginPage.signUp')}
                        </button>
                    </p>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
