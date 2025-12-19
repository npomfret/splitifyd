import { Button, Checkbox } from '@/components/ui';
import { FloatingInput } from '@/components/ui/FloatingInput';
import { navigationService } from '@/services/navigation.service';
import { RegisterRequestSchema, toDisplayName, toEmail, toPassword } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { AuthForm } from '../components/auth/AuthForm';
import { AuthLayout } from '../components/auth/AuthLayout';
import { EmailInput } from '../components/auth/EmailInput';
import { FloatingPasswordInput } from '../components/auth/FloatingPasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { logError } from '../utils/browser-logger';

export function RegisterPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [nameSignal] = useState(() => signal(''));
    const [emailSignal] = useState(() => signal(''));
    const [passwordSignal] = useState(() => signal(''));
    const [confirmPasswordSignal] = useState(() => signal(''));
    const [agreeToTermsSignal] = useState(() => signal(false));
    const [agreeToCookiesSignal] = useState(() => signal(false));
    const [agreeToPrivacySignal] = useState(() => signal(false));
    const [localErrorSignal] = useState(() => signal<string | null>(null));

    // Clear any previous errors when component mounts
    useEffect(() => {
        localErrorSignal.value = null;
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

    // Extract signal values for use in render
    const name = nameSignal.value;
    const email = emailSignal.value;
    const password = passwordSignal.value;
    const confirmPassword = confirmPasswordSignal.value;
    const agreeToTerms = agreeToTermsSignal.value;
    const agreeToCookies = agreeToCookiesSignal.value;
    const agreeToPrivacy = agreeToPrivacySignal.value;
    const localError = localErrorSignal.value;

    const validateForm = (): string | null => {
        // Check confirmPassword match first (not in schema)
        if (password !== confirmPassword) {
            return t('registerPage.validation.passwordsNoMatch');
        }

        // Validate using shared schema
        const result = RegisterRequestSchema.safeParse({
            email,
            password,
            displayName: name,
            termsAccepted: agreeToTerms,
            cookiePolicyAccepted: agreeToCookies,
            privacyPolicyAccepted: agreeToPrivacy,
            signupHostname: window.location.hostname, // Added for tenant tracking
        });

        if (!result.success) {
            // Map schema error paths to user-friendly messages
            const firstError = result.error.issues[0];
            const path = firstError.path[0];

            switch (path) {
                case 'displayName':
                    return t('registerPage.validation.nameRequired');
                case 'email':
                    return t('registerPage.validation.emailRequired');
                case 'password':
                    return firstError.message.includes('12')
                        ? t('registerPage.validation.passwordTooShort')
                        : t('registerPage.validation.passwordRequired');
                case 'termsAccepted':
                    return t('registerPage.validation.termsRequired');
                case 'cookiePolicyAccepted':
                    return t('registerPage.validation.cookiesRequired');
                case 'privacyPolicyAccepted':
                    return t('registerPage.validation.privacyRequired');
                default:
                    return firstError.message;
            }
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
            await authStore.register(toEmail(email.trim()), toPassword(password), toDisplayName(name.trim()), agreeToTerms, agreeToCookies, agreeToPrivacy);
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
                <FloatingInput
                    id='fullname-input'
                    label={t('registerPage.fullNameLabel')}
                    value={name}
                    onChange={(value) => {
                        nameSignal.value = value;
                    }}
                    placeholder={t('registerPage.fullNamePlaceholder')}
                    required
                    disabled={isSubmitting}
                    autoComplete='off'
                />

                <EmailInput
                    value={email}
                    onInput={(value) => {
                        emailSignal.value = value;
                        // Clear email-related errors when user changes email field
                        if (authStore.error && authStore.error.toLowerCase().includes('email')) {
                            authStore.clearError();
                        }
                    }}
                    disabled={isSubmitting}
                />

                <FloatingPasswordInput
                    id='password-input'
                    value={password}
                    onInput={(value) => {
                        passwordSignal.value = value;
                    }}
                    label={t('registerPage.passwordLabel')}
                    placeholder={t('registerPage.passwordPlaceholder')}
                    disabled={isSubmitting}
                    showStrength
                />

                <FloatingPasswordInput
                    id='confirm-password-input'
                    value={confirmPassword}
                    onInput={(value) => {
                        confirmPasswordSignal.value = value;
                    }}
                    label={t('registerPage.confirmPasswordLabel')}
                    placeholder={t('registerPage.confirmPasswordPlaceholder')}
                    disabled={isSubmitting}
                />

                <div className='space-y-3'>
                    <Checkbox
                        label={
                            <span className='text-sm text-text-primary'>
                                {t('registerPage.acceptTerms')}{' '}
                                <a href='/terms' target='_blank' className='font-semibold text-interactive-primary hover:opacity-80 transition-opacity'>
                                    {t('registerPage.termsOfService')}
                                </a>
                            </span>
                        }
                        checked={agreeToTerms}
                        onChange={(checked) => {
                            agreeToTermsSignal.value = checked;
                        }}
                        disabled={isSubmitting}
                    />

                    <Checkbox
                        label={
                            <span className='text-sm text-text-primary'>
                                {t('registerPage.acceptTerms')}{' '}
                                <a href='/cookies' target='_blank' className='font-semibold text-interactive-primary hover:opacity-80 transition-opacity'>
                                    {t('registerPage.cookiePolicy')}
                                </a>
                            </span>
                        }
                        checked={agreeToCookies}
                        onChange={(checked) => {
                            agreeToCookiesSignal.value = checked;
                        }}
                        disabled={isSubmitting}
                    />

                    <Checkbox
                        label={
                            <span className='text-sm text-text-primary'>
                                {t('registerPage.acceptTerms')}{' '}
                                <a href='/privacy-policy' target='_blank' className='font-semibold text-interactive-primary hover:opacity-80 transition-opacity'>
                                    {t('registerPage.privacyPolicy')}
                                </a>
                            </span>
                        }
                        checked={agreeToPrivacy}
                        onChange={(checked) => {
                            agreeToPrivacySignal.value = checked;
                        }}
                        disabled={isSubmitting}
                    />
                </div>

                <SubmitButton loading={isSubmitting} disabled={!isFormValid}>
                    {t('registerPage.submitButton')}
                </SubmitButton>

                <div className='text-center'>
                    <p className='help-text'>
                        {t('registerPage.hasAccount')}{' '}
                        <Button
                            type='button'
                            onClick={() => navigationService.goToLogin()}
                            variant='ghost'
                            size='sm'
                            className='font-semibold text-interactive-primary inline'
                        >
                            {t('registerPage.signIn')}
                        </Button>
                    </p>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
