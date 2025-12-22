import { Button, Card, Stack, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { EnvelopeIcon } from '@/components/ui/icons';
import { navigationService } from '@/services/navigation.service';
import { EmailSchema, toEmail } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '@/app/hooks';
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

    if (emailSentSignal.value) {
        return (
            <AuthLayout title={t('pages.resetPasswordPage.checkYourEmail')} description={t('pages.resetPasswordPage.resetInstructionsSent')}>
                <Stack spacing='lg' className='text-center'>
                    <div className='mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-semantic-success/10 text-semantic-success'>
                        <EnvelopeIcon size={32} />
                    </div>

                    <div className='space-y-2'>
                        <Typography variant='heading'>{t('pages.resetPasswordPage.emailSentSuccessfully')}</Typography>
                        <Typography variant='body' className='text-text-muted'>
                            {t('pages.resetPasswordPage.sentInstructionsTo')}
                        </Typography>
                        <Typography variant='bodyStrong'>{emailSignal.value}</Typography>
                        <Typography variant='caption' className='text-text-muted'>
                            {t('pages.resetPasswordPage.checkSpamFolder')}
                        </Typography>
                    </div>

                    <Card padding='md' className='text-start bg-surface-warning/60 border-border-warning'>
                        <Typography variant='caption' className='uppercase tracking-wide text-semantic-warning'>
                            {t('pages.resetPasswordPage.whatsNext')}
                        </Typography>
                        <ul className='mt-3 text-sm text-text-primary space-y-1 list-disc list-inside'>
                            <li>{t('pages.resetPasswordPage.checkEmailInbox')}</li>
                            <li>{t('pages.resetPasswordPage.clickResetLink')}</li>
                            <li>{t('pages.resetPasswordPage.createNewPassword')}</li>
                            <li>{t('pages.resetPasswordPage.signInWithNewPassword')}</li>
                        </ul>
                    </Card>

                    <Button variant='ghost' fullWidth onClick={() => navigationService.goToLogin()}>
                        {t('pages.resetPasswordPage.backToSignIn')}
                    </Button>
                </Stack>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title={t('pages.resetPasswordPage.resetPassword')} description={t('pages.resetPasswordPage.enterEmailForReset')}>
            <AuthForm onSubmit={handleSubmit} error={errorSignal.value} disabled={isLoadingSignal.value}>
                <div className='space-y-4'>
                    <p className='help-text'>{t('pages.resetPasswordPage.enterEmailDescription')}</p>

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

                <div className='text-center'>
                    <Clickable
                        as='button'
                        type='button'
                        onClick={() => navigationService.goToLogin()}
                        className='help-text hover:text-text-primary transition-colors'
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
