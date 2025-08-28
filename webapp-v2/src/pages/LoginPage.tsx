import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthForm } from '../components/auth/AuthForm';
import { EmailInput } from '../components/auth/EmailInput';
import { PasswordInput } from '../components/auth/PasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { firebaseConfigManager } from '../app/firebase-config';
import { logError } from '../utils/browser-logger';

const emailSignal = signal('');
const passwordSignal = signal('');
const formDefaultsLoadedSignal = signal(false);

export function LoginPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    // Clear any previous errors when component mounts and load form defaults
    useEffect(() => {
        authStore.clearError();

        // Load form defaults from config
        firebaseConfigManager
            .getConfig()
            .then((config) => {
                if (config.formDefaults) {
                    emailSignal.value = config.formDefaults.email || '';
                    passwordSignal.value = config.formDefaults.password || '';
                }
                formDefaultsLoadedSignal.value = true;
            })
            .catch((error) => {
                logError('Failed to load form defaults', error);
                formDefaultsLoadedSignal.value = true;
            });
    }, []);

    // Redirect if already logged in
    useEffect(() => {
        if (authStore.user) {
            route('/dashboard', true);
        }
    }, [authStore.user]);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const email = emailSignal.value.trim();
        const password = passwordSignal.value;

        if (!email || !password) {
            const errors = [];
            if (!email) errors.push(t('loginPage.validation.emailRequired'));
            if (!password) errors.push(t('loginPage.validation.passwordRequired'));
            // Validation errors are handled by the form UI
            return;
        }

        try {
            await authStore.login(email, password);
            // Redirect will happen via useEffect when user state updates
        } catch (error) {
            logError('Login attempt failed', error, { email });
        }
    };

    const isFormValid = emailSignal.value.trim() && passwordSignal.value;
    const isSubmitting = authStore.loading;

    return (
        <AuthLayout title={t('loginPage.title')} description={t('loginPage.description')}>
            <AuthForm onSubmit={handleSubmit} error={authStore.error} disabled={isSubmitting}>
                <EmailInput value={emailSignal.value} onInput={(value) => (emailSignal.value = value)} autoFocus disabled={isSubmitting} />

                <PasswordInput value={passwordSignal.value} onInput={(value) => (passwordSignal.value = value)} disabled={isSubmitting} autoComplete="current-password" />

                <div class="flex items-center justify-between">
                    <label class="flex items-center">
                        <input type="checkbox" data-testid="remember-me-checkbox" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" disabled={isSubmitting} />
                        <span class="ml-2 block text-sm text-gray-700">{t('loginPage.rememberMe')}</span>
                    </label>

                    <a href="/reset-password" class="text-sm text-blue-600 hover:text-blue-500 transition-colors">
                        {t('loginPage.forgotPassword')}
                    </a>
                </div>

                <SubmitButton loading={isSubmitting} disabled={!isFormValid}>
                    {t('loginPage.submitButton')}
                </SubmitButton>

                <div class="text-center">
                    <p class="text-sm text-gray-600">
                        {t('loginPage.noAccount')}{' '}
                        <a href="/register" class="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                            {t('loginPage.signUp')}
                        </a>
                    </p>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
