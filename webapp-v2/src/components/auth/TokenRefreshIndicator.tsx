import { useAuth } from '@/app/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui';
import { useComputed } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

export function TokenRefreshIndicator() {
    const authStore = useAuth();
    const { t } = useTranslation();
    const isRefreshing = useComputed(() => authStore?.refreshingTokenSignal.value ?? false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isRefreshing.value) {
            setVisible(true);
            return;
        }

        if (!visible) {
            return;
        }

        const timeout = window.setTimeout(() => setVisible(false), 1000);
        return () => window.clearTimeout(timeout);
    }, [isRefreshing.value, visible]);

    if (!visible) {
        return null;
    }

    return (
        <div
            class='fixed bottom-6 right-6 z-50 flex items-center space-x-3 rounded-md px-4 py-3 shadow-lg backdrop-blur-xs'
            style={{ backgroundColor: 'var(--surface-toast, rgba(var(--text-primary-rgb), 0.9))', color: 'var(--text-inverted)' }}
            role='status'
            aria-live='polite'
        >
            <LoadingSpinner size='sm' color='var(--text-inverted)' />
            <span class='text-sm font-medium'>{t('auth.refreshingSession')}</span>
        </div>
    );
}
