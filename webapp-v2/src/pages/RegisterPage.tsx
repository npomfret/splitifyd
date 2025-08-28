import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthForm } from '../components/auth/AuthForm';
import { EmailInput } from '../components/auth/EmailInput';
import { PasswordInput } from '../components/auth/PasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { firebaseConfigManager } from '../app/firebase-config';
import { logError } from '../utils/browser-logger';

const nameSignal = signal('');
const emailSignal = signal('');
const passwordSignal = signal('');
const confirmPasswordSignal = signal('');
const agreeToTermsSignal = signal(false);
const agreeToCookiesSignal = signal(false);
const localErrorSignal = signal<string | null>(null);

export function RegisterPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    // Clear any previous errors when component mounts and load form defaults
    useEffect(() => {
        // Only clear errors if this is not a registration-related error
        // This prevents clearing errors immediately after a failed registration attempt
        if (!authStore.error || !authStore.error.toLowerCase().includes('email')) {
            authStore.clearError();
        }
        localErrorSignal.value = null;

        // Load form defaults from config, but only if the fields are empty
        firebaseConfigManager
            .getConfig()
            .then((config) => {
                if (config.formDefaults) {
                    if (!nameSignal.value && config.formDefaults.displayName) {
                        nameSignal.value = config.formDefaults.displayName;
                    }
                    if (!emailSignal.value && config.formDefaults.email) {
                        emailSignal.value = config.formDefaults.email;
                    }
                    if (!passwordSignal.value && config.formDefaults.password) {
                        passwordSignal.value = config.formDefaults.password;
                        confirmPasswordSignal.value = config.formDefaults.password;
                    }
                }
            })
            .catch((error) => {
                logError('Failed to load form defaults', error);
            });
    }, []);

    // Redirect if already logged in
    useEffect(() => {
        if (authStore.user) {
            route(ROUTES.DASHBOARD, true);
        }
    }, [authStore.user]);

    const validateForm = (): string | null => {
        if (!nameSignal.value.trim()) {
            return t('registerPage.validation.nameRequired');
        }
        if (!emailSignal.value.trim()) {
            return t('registerPage.validation.emailRequired');
        }
        if (!passwordSignal.value) {
            return t('registerPage.validation.passwordRequired');
        }
        if (passwordSignal.value.length < 6) {
            return t('registerPage.validation.passwordTooShort');
        }
        if (passwordSignal.value !== confirmPasswordSignal.value) {
            return t('registerPage.validation.passwordsNoMatch');
        }
        if (!agreeToTermsSignal.value) {
            return t('registerPage.validation.termsRequired');
        }
        if (!agreeToCookiesSignal.value) {
            return t('registerPage.validation.cookiesRequired');
        }
        return null;
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            // Validation error is already displayed to the user
            localErrorSignal.value = validationError;
            return;
        }

        localErrorSignal.value = null;

        try {
            await authStore.register(emailSignal.value.trim(), passwordSignal.value, nameSignal.value.trim(), agreeToTermsSignal.value, agreeToCookiesSignal.value);
            // Redirect will happen via useEffect when user state updates
        } catch (error) {
            logError('Registration attempt failed', error, { email: emailSignal.value.trim(), displayName: nameSignal.value.trim() });
        }
    };

    const isFormValid = nameSignal.value.trim() && emailSignal.value.trim() && passwordSignal.value && confirmPasswordSignal.value && agreeToTermsSignal.value && agreeToCookiesSignal.value;
    const isSubmitting = authStore.loading;
    const displayError = authStore.error || localErrorSignal.value;

    return (
        <AuthLayout title={t('registerPage.title')} description={t('registerPage.description')}>
            <AuthForm onSubmit={handleSubmit} error={displayError} disabled={isSubmitting}>
                <div class="space-y-1">
                    <label for="fullname-input" class="block text-sm font-medium text-gray-700">
                        {t('registerPage.fullNameLabel')} <span class="text-red-500">*</span>
                    </label>
                    <input
                        id="fullname-input"
                        type="text"
                        value={nameSignal.value}
                        onInput={(e) => (nameSignal.value = (e.target as HTMLInputElement).value)}
                        placeholder={t('registerPage.fullNamePlaceholder')}
                        required
                        disabled={isSubmitting}
                        autoComplete="name"
                        aria-label={t('registerPage.fullNameLabel')}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                </div>

                <EmailInput value={emailSignal.value} onInput={(value) => (emailSignal.value = value)} disabled={isSubmitting} />

                <PasswordInput
                    id="password-input"
                    value={passwordSignal.value}
                    onInput={(value) => (passwordSignal.value = value)}
                    label={t('registerPage.passwordLabel')}
                    placeholder={t('registerPage.passwordPlaceholder')}
                    disabled={isSubmitting}
                    showStrength
                    autoComplete="new-password"
                />

                <PasswordInput
                    id="confirm-password-input"
                    value={confirmPasswordSignal.value}
                    onInput={(value) => (confirmPasswordSignal.value = value)}
                    label={t('registerPage.confirmPasswordLabel')}
                    placeholder={t('registerPage.confirmPasswordPlaceholder')}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                />

                <div class="space-y-3">
                    <label class="flex items-start">
                        <input
                            type="checkbox"
                            data-testid="terms-checkbox"
                            checked={agreeToTermsSignal.value}
                            onChange={(e) => (agreeToTermsSignal.value = (e.target as HTMLInputElement).checked)}
                            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 flex-shrink-0"
                            disabled={isSubmitting}
                            required
                        />
                        <span class="ml-2 block text-sm text-gray-700">
                            {t('registerPage.acceptTerms')}{' '}
                            <a href="/terms" target="_blank" class="text-blue-600 hover:text-blue-500 transition-colors">
                                {t('registerPage.termsOfService')}
                            </a>
                        </span>
                    </label>

                    <label class="flex items-start">
                        <input
                            type="checkbox"
                            data-testid="cookies-checkbox"
                            checked={agreeToCookiesSignal.value}
                            onChange={(e) => (agreeToCookiesSignal.value = (e.target as HTMLInputElement).checked)}
                            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 flex-shrink-0"
                            disabled={isSubmitting}
                            required
                        />
                        <span class="ml-2 block text-sm text-gray-700">
                            {t('registerPage.acceptTerms')}{' '}
                            <a href="/cookies" target="_blank" class="text-blue-600 hover:text-blue-500 transition-colors">
                                {t('registerPage.cookiePolicy')}
                            </a>
                        </span>
                    </label>
                </div>

                <SubmitButton loading={isSubmitting} disabled={!isFormValid}>
                    {t('registerPage.submitButton')}
                </SubmitButton>

                <div class="text-center">
                    <p class="text-sm text-gray-600">
                        {t('registerPage.hasAccount')}{' '}
                        <button
                            type="button"
                            onClick={() => route(ROUTES.LOGIN)}
                            class="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                        >
                            {t('registerPage.signIn')}
                        </button>
                    </p>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
