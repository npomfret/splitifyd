import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { navigationService } from '@/services/navigation.service';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthForm } from '../components/auth/AuthForm';
import { EmailInput } from '../components/auth/EmailInput';
import { SubmitButton } from '../components/auth/SubmitButton';
import { useAuthRequired } from '../app/hooks/useAuthRequired';

const emailSignal = signal('');

export function ResetPasswordPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [emailSent, setEmailSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Clear any previous errors when component mounts
    useEffect(() => {
        authStore.clearError();
        setError(null);
    }, []);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const email = emailSignal.value.trim();
        if (!email) return;

        setIsLoading(true);
        setError(null);

        try {
            await authStore.resetPassword(email);
            setEmailSent(true);
        } catch (error) {
            setError(authStore.error || t('pages.resetPasswordPage.failedToSendReset'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleTryAgain = () => {
        setEmailSent(false);
        emailSignal.value = '';
        setError(null);
    };

    if (emailSent) {
        return (
            <AuthLayout title={t('pages.resetPasswordPage.checkYourEmail')} description={t('pages.resetPasswordPage.resetInstructionsSent')}>
                <div class="text-center space-y-6">
                    <div class="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                        </svg>
                    </div>

                    <div class="space-y-2">
                        <h2 class="text-lg font-medium text-gray-900">{t('pages.resetPasswordPage.emailSentSuccessfully')}</h2>
                        <p class="text-gray-600">{t('pages.resetPasswordPage.sentInstructionsTo')}</p>
                        <p class="font-medium text-gray-900">{emailSignal.value}</p>
                    </div>

                    <div class="bg-blue-50 border border-blue-200 rounded-md p-4 text-left">
                        <h3 class="text-sm font-medium text-blue-800 mb-1">{t('pages.resetPasswordPage.whatsNext')}</h3>
                        <ul class="text-sm text-blue-700 space-y-1">
                            <li>{t('pages.resetPasswordPage.checkEmailInbox')}</li>
                            <li>{t('pages.resetPasswordPage.clickResetLink')}</li>
                            <li>{t('pages.resetPasswordPage.createNewPassword')}</li>
                            <li>{t('pages.resetPasswordPage.signInWithNewPassword')}</li>
                        </ul>
                    </div>

                    <div class="space-y-3">
                        <button
                            onClick={handleTryAgain}
                            class="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            {t('pages.resetPasswordPage.sendToDifferentEmail')}
                        </button>

                        <div class="text-center">
                            <button type="button" onClick={() => navigationService.goToLogin()} class="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                                {t('pages.resetPasswordPage.backToSignIn')}
                            </button>
                        </div>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title={t('pages.resetPasswordPage.resetPassword')} description={t('pages.resetPasswordPage.enterEmailForReset')}>
            <AuthForm onSubmit={handleSubmit} error={error} disabled={isLoading}>
                <div class="space-y-4">
                    <p class="text-sm text-gray-600">{t('pages.resetPasswordPage.enterEmailDescription')}</p>

                    <EmailInput value={emailSignal.value} onInput={(value) => (emailSignal.value = value)} placeholder={t('pages.resetPasswordPage.emailPlaceholder')} autoFocus disabled={isLoading} />
                </div>

                <SubmitButton loading={isLoading} disabled={!emailSignal.value.trim()}>
                    {t('pages.resetPasswordPage.sendResetInstructions')}
                </SubmitButton>

                <div class="text-center">
                    <button type="button" onClick={() => navigationService.goToLogin()} class="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                        {t('pages.resetPasswordPage.backToSignIn')}
                    </button>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
