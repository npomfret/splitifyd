import { Button, Checkbox } from '@/components/ui';
import { navigationService } from '@/services/navigation.service';
import { EmailSchema, toEmail, toPassword } from '@billsplit-wl/shared';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '@/app/hooks';
import { useLocalSignal } from '@/app/hooks';
import { AuthForm } from '../components/auth/AuthForm';
import { AuthLayout } from '../components/auth/AuthLayout';
import { DefaultLoginButton } from '../components/auth/DefaultLoginButton';
import { EmailInput } from '../components/auth/EmailInput';
import { FloatingPasswordInput } from '../components/auth/FloatingPasswordInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { logError } from '../utils/browser-logger';

export function LoginPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    const emailSignal = useLocalSignal('');
    const passwordSignal = useLocalSignal('');
    const rememberMeSignal = useLocalSignal(false);

    // Extract signal values for use in render
    const email = emailSignal.value;
    const password = passwordSignal.value;
    const rememberMe = rememberMeSignal.value;

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

        // Validate email using shared schema
        const emailResult = EmailSchema.safeParse(email);
        if (!emailResult.success || !password) {
            // Validation errors prevent form submission
            // Detailed errors are shown by the backend if needed
            return;
        }

        const validEmail = emailResult.data;

        try {
            await authStore.login(toEmail(validEmail), toPassword(password), rememberMe);
            // Redirect will happen via useEffect when user state updates
        } catch (error) {
            logError('Login attempt failed', error, { email: validEmail });
            // Error is already set in authStore.errorSignal by the login() method
        }
    };

    const handleFillForm = (defaultEmail: string, defaultPassword: string): void => {
        emailSignal.value = defaultEmail;
        passwordSignal.value = defaultPassword;
    };

    const handleQuickLogin = async (defaultEmail: string, defaultPassword: string): Promise<void> => {
        await authStore.login(toEmail(defaultEmail), toPassword(defaultPassword), false);
    };

    const isFormValid = EmailSchema.safeParse(email).success && password;

    const errorValue = authStore.errorSignal.value;
    const loadingValue = authStore.loadingSignal.value;

    return (
        <AuthLayout title={t('loginPage.title')} description={t('loginPage.description')}>
            <AuthForm onSubmit={handleSubmit} error={errorValue} disabled={loadingValue}>
                <EmailInput
                    value={email}
                    onInput={(value) => {
                        emailSignal.value = value;
                    }}
                    autoFocus
                    disabled={loadingValue}
                />

                <FloatingPasswordInput
                    value={password}
                    onInput={(value) => {
                        passwordSignal.value = value;
                    }}
                    disabled={loadingValue}
                    autoComplete='off'
                />

                <div className='flex items-center justify-between'>
                    <Checkbox
                        label={t('loginPage.rememberMe')}
                        checked={rememberMe}
                        onChange={(checked) => {
                            rememberMeSignal.value = checked;
                        }}
                        disabled={loadingValue}
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

                <DefaultLoginButton onFillForm={handleFillForm} onLogin={handleQuickLogin} disabled={loadingValue} />

                <div className='text-center'>
                    <p className='help-text'>
                        {t('loginPage.noAccount')}{' '}
                        <Button
                            type='button'
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
