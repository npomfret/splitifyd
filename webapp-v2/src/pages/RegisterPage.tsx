import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { navigationService } from '@/services/navigation.service';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthForm } from '../components/auth/AuthForm';
import { EmailInput } from '../components/auth/EmailInput';
import { PasswordInput } from '../components/auth/PasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { firebaseConfigManager } from '../app/firebase-config';
import { logError } from '../utils/browser-logger';

export function RegisterPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    // Local form state - properly encapsulated within component
    // Initialize from sessionStorage to persist across potential remounts
    const [name, setName] = useState(() => {
        try {
            return sessionStorage.getItem('register-form-name') || '';
        } catch {
            return '';
        }
    });
    const [email, setEmail] = useState(() => {
        try {
            return sessionStorage.getItem('register-form-email') || '';
        } catch {
            return '';
        }
    });
    const [password, setPassword] = useState(() => {
        try {
            return sessionStorage.getItem('register-form-password') || '';
        } catch {
            return '';
        }
    });
    const [confirmPassword, setConfirmPassword] = useState(() => {
        try {
            return sessionStorage.getItem('register-form-confirmPassword') || '';
        } catch {
            return '';
        }
    });
    const [agreeToTerms, setAgreeToTerms] = useState(() => {
        try {
            return sessionStorage.getItem('register-form-agreeToTerms') === 'true';
        } catch {
            return false;
        }
    });
    const [agreeToCookies, setAgreeToCookies] = useState(() => {
        try {
            return sessionStorage.getItem('register-form-agreeToCookies') === 'true';
        } catch {
            return false;
        }
    });
    const [localError, setLocalError] = useState<string | null>(null);

    // Clear any previous errors when component mounts and load form defaults
    useEffect(() => {
        setLocalError(null);
        let isMounted = true;

        const loadDefaults = async () => {
            try {
                const config = await firebaseConfigManager.getConfig();
                
                if (isMounted && config.formDefaults) {
                    // Check if this is the first visit to register page in this session
                    // This prevents defaults from overriding form values during tests or user navigation
                    const defaultsAppliedKey = 'splitifyd-register-defaults-applied';
                    const defaultsAlreadyApplied = sessionStorage.getItem(defaultsAppliedKey);
                    
                    if (defaultsAlreadyApplied) {
                        // Don't apply defaults on subsequent visits in the same session
                        return;
                    }
                    
                    // Add small delay to let any immediate automation complete
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Re-check if still mounted after delay
                    if (!isMounted) return;
                    
                                    // Use functional updates to check current state right when we're about to apply defaults
                    // This ensures we get the most up-to-date values, even if they were set during the delay
                    setName(currentName => {
                        // Only apply default if current name is still empty
                        if (!currentName.trim() && config.formDefaults.displayName) {
                            try {
                                sessionStorage.setItem('register-form-name', config.formDefaults.displayName);
                            } catch {
                                // Ignore sessionStorage errors
                            }
                            return config.formDefaults.displayName;
                        }
                        return currentName;
                    });
                    
                    setEmail(currentEmail => {
                        // Only apply default if current email is still empty  
                        if (!currentEmail.trim() && config.formDefaults.email) {
                            try {
                                sessionStorage.setItem('register-form-email', config.formDefaults.email);
                            } catch {
                                // Ignore sessionStorage errors
                            }
                            return config.formDefaults.email;
                        }
                        return currentEmail;
                    });
                    
                    setPassword(currentPassword => {
                        // Only apply default if current password is still empty
                        if (!currentPassword && config.formDefaults.password) {
                            try {
                                sessionStorage.setItem('register-form-password', config.formDefaults.password);
                                sessionStorage.setItem('register-form-confirmPassword', config.formDefaults.password);
                            } catch {
                                // Ignore sessionStorage errors
                            }
                            setConfirmPassword(config.formDefaults.password);
                            return config.formDefaults.password;
                        }
                        return currentPassword;
                    });
                    
                    // Mark that defaults have been applied for this session
                    sessionStorage.setItem(defaultsAppliedKey, 'true');
                }
            } catch (error) {
                logError('Failed to load form defaults', error);
            }
        };

        loadDefaults();

        return () => {
            isMounted = false;
        };
    }, []); // Run only once on mount

    // Redirect if already logged in
    useEffect(() => {
        if (authStore.user) {
            navigationService.goToDashboard();
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
        if (password.length < 6) {
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
            await authStore.register(email.trim(), password, name.trim(), agreeToTerms, agreeToCookies);
            // Clear form data from sessionStorage on successful registration
            try {
                sessionStorage.removeItem('register-form-name');
                sessionStorage.removeItem('register-form-email');
                sessionStorage.removeItem('register-form-password');
                sessionStorage.removeItem('register-form-confirmPassword');
                sessionStorage.removeItem('register-form-agreeToTerms');
                sessionStorage.removeItem('register-form-agreeToCookies');
            } catch {
                // Ignore cleanup errors
            }
            // Redirect will happen via useEffect when user state updates
        } catch (error) {
            logError('Registration attempt failed', error, { email: email.trim(), displayName: name.trim() });
        }
    };

    const isFormValid = name.trim() && email.trim() && password && confirmPassword && agreeToTerms && agreeToCookies;
    const isSubmitting = authStore.loading;
    const displayError = authStore.error || localError;

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
                        value={name}
                        onInput={(e) => {
                            const value = (e.target as HTMLInputElement).value;
                            setName(value);
                            try {
                                sessionStorage.setItem('register-form-name', value);
                            } catch {
                                // Ignore sessionStorage errors
                            }
                        }}
                        placeholder={t('registerPage.fullNamePlaceholder')}
                        required
                        disabled={isSubmitting}
                        autoComplete="name"
                        aria-label={t('registerPage.fullNameLabel')}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                </div>

                <EmailInput
                    value={email}
                    onInput={(value) => {
                        setEmail(value);
                        try {
                            sessionStorage.setItem('register-form-email', value);
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
                    id="password-input"
                    value={password}
                    onInput={(value) => {
                        setPassword(value);
                        try {
                            sessionStorage.setItem('register-form-password', value);
                        } catch {
                            // Ignore sessionStorage errors
                        }
                    }}
                    label={t('registerPage.passwordLabel')}
                    placeholder={t('registerPage.passwordPlaceholder')}
                    disabled={isSubmitting}
                    showStrength
                    autoComplete="new-password"
                />

                <PasswordInput
                    id="confirm-password-input"
                    value={confirmPassword}
                    onInput={(value) => {
                        setConfirmPassword(value);
                        try {
                            sessionStorage.setItem('register-form-confirmPassword', value);
                        } catch {
                            // Ignore sessionStorage errors
                        }
                    }}
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
                            checked={agreeToTerms}
                            onChange={(e) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                setAgreeToTerms(checked);
                                try {
                                    sessionStorage.setItem('register-form-agreeToTerms', checked.toString());
                                } catch {
                                    // Ignore sessionStorage errors
                                }
                            }}
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
                            checked={agreeToCookies}
                            onChange={(e) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                setAgreeToCookies(checked);
                                try {
                                    sessionStorage.setItem('register-form-agreeToCookies', checked.toString());
                                } catch {
                                    // Ignore sessionStorage errors
                                }
                            }}
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
                        <button type="button" onClick={() => navigationService.goToLogin()} class="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                            {t('registerPage.signIn')}
                        </button>
                    </p>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
