import { Alert, Button, Card, LoadingState, Stack, Typography } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig.ts';
import { configStore } from '@/stores/config-store';
import { logError } from '@/utils/browser-logger';
import { getThemeStorageKey } from '@/utils/theme-bootstrap';
import { useComputed } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

const TRACKED_VARS = [
    '--surface-base-rgb',
    '--surface-muted-rgb',
    '--surface-raised-rgb',
    '--surface-warning-rgb',
    '--text-primary-rgb',
    '--text-muted-rgb',
    '--text-inverted-rgb',
    '--interactive-primary-rgb',
    '--interactive-primary-foreground-rgb',
    '--interactive-secondary-rgb',
    '--interactive-accent-rgb',
    '--semantic-success-rgb',
    '--semantic-warning-rgb',
    '--border-default-rgb',
    '--border-strong-rgb',
    '--border-warning-rgb',
];

type ActionMessage = { type: 'success' | 'error'; text: string; } | null;

export function AdminTenantConfigTab() {
    const { t } = useTranslation();
    const config = useConfig();
    const isLoading = useComputed(() => configStore.loadingSignal.value);
    const [computedVars, setComputedVars] = useState<Record<string, string>>({});
    const [actionMessage, setActionMessage] = useState<ActionMessage>(null);

    if (isLoading.value || !config) {
        return <LoadingState message={t('admin.tenantConfig.loading')} />;
    }

    const themeLink = useMemo(() => {
        if (config?.theme?.hash) {
            return `/api/theme.css?v=${encodeURIComponent(config.theme.hash)}`;
        }
        return '/api/theme.css';
    }, [config?.theme?.hash]);

    useEffect(() => {
        const styles = getComputedStyle(document.documentElement);
        const entries: Record<string, string> = {};
        TRACKED_VARS.forEach((variable) => {
            entries[variable] = styles.getPropertyValue(variable).trim();
        });
        setComputedVars(entries);
    }, [config?.theme?.hash]);

    const showMessage = (message: ActionMessage) => {
        setActionMessage(message);
        if (message) {
            setTimeout(() => setActionMessage(null), 4000);
        }
    };

    const handleCopyThemeLink = async () => {
        try {
            await navigator.clipboard.writeText(themeLink);
            showMessage({ type: 'success', text: t('admin.tenantConfig.theme.copySuccess') });
        } catch (error) {
            logError('Failed to copy theme link', error);
            showMessage({ type: 'error', text: t('admin.tenantConfig.theme.copyError') });
        }
    };

    const handleForceReload = () => {
        try {
            const storageKey = getThemeStorageKey();
            localStorage.removeItem(storageKey);
            if (window.__tenantTheme) {
                window.__tenantTheme.hash = null;
            }
        } catch {
            // Ignore storage errors (private browsing / quota issues)
        }
        window.location.reload();
    };

    const tenantBranding = config?.tenant?.branding;

    return (
        <div className='space-y-6'>
            {actionMessage && <Alert type={actionMessage.type} message={actionMessage.text} />}

            <Card padding='lg' data-testid='tenant-overview-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                <Stack spacing='sm'>
                    <div className='flex items-center gap-2 mb-2'>
                        <div className='w-1 h-6 bg-linear-to-b from-amber-500 to-orange-600 rounded-full'></div>
                        <Typography variant='heading' className='text-amber-700'>{t('admin.tenantConfig.overview.title')}</Typography>
                    </div>
                    <div className='grid gap-4 md:grid-cols-3 text-sm'>
                        <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p className='text-indigo-600 text-xs mb-1'>{t('admin.tenantConfig.overview.tenantId')}</p>
                            <p className='font-mono text-amber-700 font-medium'>{config?.tenant?.tenantId ?? t('common.unknown')}</p>
                        </div>
                        <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p className='text-indigo-600 text-xs mb-1'>{t('admin.tenantConfig.overview.appName')}</p>
                            <p className='text-gray-800 font-medium'>{config?.tenant?.brandingTokens?.tokens?.legal?.appName ?? t('common.notConfigured')}</p>
                        </div>
                        <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p className='text-indigo-600 text-xs mb-1'>{t('admin.tenantConfig.overview.lastUpdated')}</p>
                            <p className='text-gray-800 font-medium'>{config?.tenant?.updatedAt ?? '—'}</p>
                        </div>
                    </div>
                </Stack>
            </Card>

            <Card padding='lg' data-testid='theme-artifact-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                <Stack spacing='md'>
                    <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
                        <div>
                            <div className='flex items-center gap-2 mb-1'>
                                <div className='w-1 h-6 bg-linear-to-b from-amber-500 to-orange-600 rounded-full'></div>
                                <Typography variant='heading' className='text-amber-700'>{t('admin.tenantConfig.theme.title')}</Typography>
                            </div>
                            <Typography variant='caption' className='text-indigo-600 ml-3'>{t('admin.tenantConfig.theme.description')}</Typography>
                        </div>
                        <div className='flex flex-wrap gap-3'>
                            <Button
                                variant='secondary'
                                size='sm'
                                onClick={handleCopyThemeLink}
                                data-testid='copy-theme-link-button'
                            >
                                {t('admin.tenantConfig.theme.copyLink')}
                            </Button>
                            <Button variant='ghost' size='sm' onClick={handleForceReload} data-testid='force-reload-theme-button'>
                                {t('admin.tenantConfig.theme.forceReload')}
                            </Button>
                        </div>
                    </div>
                    <div className='grid gap-4 text-sm md:grid-cols-3'>
                        <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p className='text-indigo-600 text-xs mb-1'>{t('admin.tenantConfig.theme.activeHash')}</p>
                            <p className='font-mono text-amber-700 font-medium'>{config?.theme?.hash ?? t('admin.tenantConfig.theme.notPublished')}</p>
                        </div>
                        <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p className='text-indigo-600 text-xs mb-1'>{t('admin.tenantConfig.theme.generatedAt')}</p>
                            <p className='text-gray-800 text-xs'>{config?.theme?.generatedAtEpochMs ? new Date(config.theme.generatedAtEpochMs).toISOString() : '—'}</p>
                        </div>
                        <div className='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p className='text-indigo-600 text-xs mb-1'>{t('common.link')}</p>
                            <p className='font-mono text-amber-700 text-xs break-all'>{themeLink}</p>
                        </div>
                    </div>
                </Stack>
            </Card>

            {tenantBranding && (
                <Card padding='lg' data-testid='branding-tokens-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                    <Stack spacing='md'>
                        <div className='flex items-center gap-2 mb-2'>
                            <div className='w-1 h-6 bg-linear-to-b from-amber-500 to-orange-600 rounded-full'></div>
                            <Typography variant='heading' className='text-amber-700'>{t('admin.tenantConfig.brandingTokens.title')}</Typography>
                        </div>
                        <pre className='bg-indigo-50 rounded-md p-4 text-sm overflow-x-auto border border-indigo-200 text-gray-800'>{JSON.stringify(tenantBranding, null, 2)}</pre>
                    </Stack>
                </Card>
            )}

            <Card padding='lg' data-testid='computed-vars-card' className='bg-white/70 backdrop-blur-xs border border-indigo-200'>
                <Stack spacing='md'>
                    <div className='flex items-center gap-2 mb-2'>
                        <div className='w-1 h-6 bg-linear-to-b from-amber-500 to-orange-600 rounded-full'></div>
                        <Typography variant='heading' className='text-amber-700'>{t('admin.tenantConfig.computedCss.title')}</Typography>
                    </div>
                    <div className='grid gap-3 md:grid-cols-2'>
                        {Object.entries(computedVars).map(([variable, value]) => (
                            <div key={variable} className='rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3'>
                                <p className='text-xs uppercase text-indigo-600 mb-1'>{variable}</p>
                                <p className='font-mono text-sm text-amber-700'>{value || t('common.notSet')}</p>
                            </div>
                        ))}
                    </div>
                </Stack>
            </Card>
        </div>
    );
}
