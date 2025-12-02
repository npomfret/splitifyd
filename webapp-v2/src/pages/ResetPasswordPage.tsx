import { Button, Card, Stack, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { navigationService } from '@/services/navigation.service';
import { EmailSchema, toEmail } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { AuthForm } from '../components/auth/AuthForm';
import { AuthLayout } from '../components/auth/AuthLayout';
import { EmailInput } from '../components/auth/EmailInput';
import { SubmitButton } from '../components/auth/SubmitButton';

export function ResetPasswordPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [emailSignal] = useState(() => signal(''));
    const [emailSentSignal] = useState(() => signal(false));
    const [isLoadingSignal] = useState(() => signal(false));
    const [errorSignal] = useState(() => signal<string | null>(null));

    // Clear any previous errors when component mounts
    useEffect(() => {
        authStore.clearError();
        errorSignal.value = null;
    }, []);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        // Validate email using shared schema
        const emailResult = EmailSchema.safeParse(emailSignal.value);
        if (!emailResult.success) return;

        isLoadingSignal.value = true;
        errorSignal.value = null;

        try {
            await authStore.resetPassword(toEmail(emailResult.data));
            emailSentSignal.value = true;
        } catch (error) {
            errorSignal.value = authStore.error || t('pages.resetPasswordPage.failedToSendReset');
        } finally {
            isLoadingSignal.value = false;
        }
    };

    const handleTryAgain = () => {
        emailSentSignal.value = false;
        emailSignal.value = '';
        errorSignal.value = null;
    };

    if (emailSentSignal.value) {
        return (
            <AuthLayout title={t('pages.resetPasswordPage.checkYourEmail')} description={t('pages.resetPasswordPage.resetInstructionsSent')}>
                <Stack spacing='lg' className='text-center'>
                    <div class='mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-semantic-success/10 text-semantic-success'>
                        <svg class='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                            <path
                                stroke-linecap='round'
                                stroke-linejoin='round'
                                stroke-width='2'
                                d='M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                            />
                        </svg>
                    </div>

                    <div class='space-y-2'>
                        <Typography variant='heading'>{t('pages.resetPasswordPage.emailSentSuccessfully')}</Typography>
                        <Typography variant='body' className='text-text-muted'>
                            {t('pages.resetPasswordPage.sentInstructionsTo')}
                        </Typography>
                        <Typography variant='bodyStrong'>{emailSignal.value}</Typography>
                    </div>

                    <Card padding='md' className='text-left bg-surface-warning/60 border-border-warning'>
                        <Typography variant='caption' className='uppercase tracking-wide text-semantic-warning'>
                            {t('pages.resetPasswordPage.whatsNext')}
                        </Typography>
                        <ul class='mt-3 text-sm text-text-primary space-y-1 list-disc list-inside'>
                            <li>{t('pages.resetPasswordPage.checkEmailInbox')}</li>
                            <li>{t('pages.resetPasswordPage.clickResetLink')}</li>
                            <li>{t('pages.resetPasswordPage.createNewPassword')}</li>
                            <li>{t('pages.resetPasswordPage.signInWithNewPassword')}</li>
                        </ul>
                    </Card>

                    <Stack spacing='sm'>
                        <Button variant='secondary' fullWidth onClick={handleTryAgain}>
                            {t('pages.resetPasswordPage.sendToDifferentEmail')}
                        </Button>

                        <Button variant='ghost' fullWidth onClick={() => navigationService.goToLogin()}>
                            {t('pages.resetPasswordPage.backToSignIn')}
                        </Button>
                    </Stack>
                </Stack>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title={t('pages.resetPasswordPage.resetPassword')} description={t('pages.resetPasswordPage.enterEmailForReset')}>
            <AuthForm onSubmit={handleSubmit} error={errorSignal.value} disabled={isLoadingSignal.value}>
                <div class='space-y-4'>
                    <p class='text-sm text-text-muted'>{t('pages.resetPasswordPage.enterEmailDescription')}</p>

                    <EmailInput
                        value={emailSignal.value}
                        onInput={(value) => (emailSignal.value = value)}
                        placeholder={t('pages.resetPasswordPage.emailPlaceholder')}
                        autoFocus
                        disabled={isLoadingSignal.value}
                    />
                </div>

                <SubmitButton loading={isLoadingSignal.value} disabled={!EmailSchema.safeParse(emailSignal.value).success}>
                    {t('pages.resetPasswordPage.sendResetInstructions')}
                </SubmitButton>

                <div class='text-center'>
                    <Clickable
                        as='button'
                        type='button'
                        onClick={() => navigationService.goToLogin()}
                        className='text-sm text-text-muted hover:text-text-primary transition-colors'
                        aria-label='Back to sign in'
                        eventName='reset_password_back_to_login'
                    >
                        {t('pages.resetPasswordPage.backToSignIn')}
                    </Clickable>
                </div>
            </AuthForm>
        </AuthLayout>
    );
}
