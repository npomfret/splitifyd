import { useAuth } from '@/app/hooks/useAuth';
import { apiClient } from '@/app/apiClient';
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { WarningIcon, CheckCircleIcon } from './icons';

type BannerState = 'idle' | 'sending' | 'success' | 'error';

export function EmailVerificationBanner() {
    const { t } = useTranslation();
    const authStore = useAuth();
    // Component-local signals - initialized within useState to avoid stale state across instances
    const [stateSignal] = useState(() => signal<BannerState>('idle'));

    // Don't show banner if user is not logged in or email is already verified
    if (!authStore?.user || authStore.user.emailVerified) {
        return null;
    }

    const handleResend = async () => {
        stateSignal.value = 'sending';
        try {
            await apiClient.sendEmailVerification({ email: authStore.user!.email });
            stateSignal.value = 'success';
            // Reset to idle after 5 seconds
            setTimeout(() => {
                stateSignal.value = 'idle';
            }, 5000);
        } catch {
            stateSignal.value = 'error';
            // Reset to idle after 5 seconds
            setTimeout(() => {
                stateSignal.value = 'idle';
            }, 5000);
        }
    };

    const state = stateSignal.value;

    return (
        <>
            {/* Fixed banner at top of viewport */}
            <div
                className='fixed top-0 left-0 right-0 z-[9999] bg-surface-warning border-b border-border-warning py-3 px-4'
                role='alert'
                aria-live='polite'
            >
                <div className='max-w-7xl mx-auto flex items-center justify-center gap-4 flex-wrap'>
                    <div className='flex items-center gap-2'>
                        {state === 'success' ? (
                            <CheckCircleIcon size={20} className='text-semantic-success shrink-0' />
                        ) : (
                            <WarningIcon size={20} className='text-semantic-warning shrink-0' />
                        )}
                        <span className='text-sm font-medium text-text-primary'>
                            {state === 'success'
                                ? t('emailVerification.banner.resendSuccess')
                                : state === 'error'
                                  ? t('emailVerification.banner.resendError')
                                  : t('emailVerification.banner.message')}
                        </span>
                    </div>
                    {state !== 'success' && (
                        <Button
                            variant='secondary'
                            size='sm'
                            onClick={handleResend}
                            loading={state === 'sending'}
                            disabled={state === 'sending'}
                        >
                            {t('emailVerification.banner.resendButton')}
                        </Button>
                    )}
                </div>
            </div>
            {/* Spacer to push page content down so it's not hidden behind the fixed banner */}
            <div className='h-12' aria-hidden='true' />
        </>
    );
}
