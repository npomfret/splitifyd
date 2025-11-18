import { Alert, Button, Card, Stack, Typography } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig.ts';
import { logError } from '@/utils/browser-logger';
import { getThemeStorageKey } from '@/utils/theme-bootstrap';
import { useEffect, useMemo, useState } from 'preact/hooks';

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

export function AdminDiagnosticsTab() {
    const config = useConfig();
    const [computedVars, setComputedVars] = useState<Record<string, string>>({});
    const [actionMessage, setActionMessage] = useState<ActionMessage>(null);

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
            showMessage({ type: 'success', text: 'Theme link copied to clipboard.' });
        } catch (error) {
            logError('Failed to copy theme link', error);
            showMessage({ type: 'error', text: 'Unable to copy theme link. Please copy manually.' });
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
        <div class='space-y-6'>
            {actionMessage && <Alert type={actionMessage.type} message={actionMessage.text} />}

            <Card padding='lg' data-testid='tenant-overview-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                <Stack spacing='sm'>
                    <div class='flex items-center gap-2 mb-2'>
                        <div class='w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full'></div>
                        <Typography variant='heading' className='text-amber-700'>Tenant Overview</Typography>
                    </div>
                    <div class='grid gap-4 md:grid-cols-3 text-sm'>
                        <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p class='text-indigo-600 text-xs mb-1'>Tenant ID</p>
                            <p class='font-mono text-amber-700 font-medium'>{config?.tenant?.tenantId ?? 'unknown'}</p>
                        </div>
                        <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p class='text-indigo-600 text-xs mb-1'>App Name</p>
                            <p class='text-gray-800 font-medium'>{tenantBranding?.appName ?? 'Not configured'}</p>
                        </div>
                        <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p class='text-indigo-600 text-xs mb-1'>Last Updated</p>
                            <p class='text-gray-800 font-medium'>{config?.tenant?.updatedAt ?? '—'}</p>
                        </div>
                    </div>
                </Stack>
            </Card>

            <Card padding='lg' data-testid='theme-artifact-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                <Stack spacing='md'>
                    <div class='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
                        <div>
                            <div class='flex items-center gap-2 mb-1'>
                                <div class='w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full'></div>
                                <Typography variant='heading' className='text-amber-700'>Theme Artifact</Typography>
                            </div>
                            <Typography variant='caption' className='text-indigo-600 ml-3'>Hash + CSS delivery helpers</Typography>
                        </div>
                        <div class='flex flex-wrap gap-3'>
                            <Button
                                variant='secondary'
                                size='sm'
                                onClick={handleCopyThemeLink}
                                data-testid='copy-theme-link-button'
                                className='!bg-white !text-gray-800 !border-gray-300 hover:!bg-gray-50'
                            >
                                Copy Theme Link
                            </Button>
                            <Button variant='ghost' size='sm' onClick={handleForceReload} data-testid='force-reload-theme-button' className='!text-gray-800 hover:!bg-gray-100'>
                                Force Reload Theme
                            </Button>
                        </div>
                    </div>
                    <div class='grid gap-4 text-sm md:grid-cols-3'>
                        <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p class='text-indigo-600 text-xs mb-1'>Active Hash</p>
                            <p class='font-mono text-amber-700 font-medium'>{config?.theme?.hash ?? 'not published'}</p>
                        </div>
                        <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p class='text-indigo-600 text-xs mb-1'>Generated At</p>
                            <p class='text-gray-800 text-xs'>{config?.theme?.generatedAtEpochMs ? new Date(config.theme.generatedAtEpochMs).toISOString() : '—'}</p>
                        </div>
                        <div class='bg-indigo-50 rounded-md p-3 border border-indigo-200'>
                            <p class='text-indigo-600 text-xs mb-1'>Link</p>
                            <p class='font-mono text-amber-700 text-xs break-all'>{themeLink}</p>
                        </div>
                    </div>
                </Stack>
            </Card>

            {tenantBranding && (
                <Card padding='lg' data-testid='branding-tokens-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                    <Stack spacing='md'>
                        <div class='flex items-center gap-2 mb-2'>
                            <div class='w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full'></div>
                            <Typography variant='heading' className='text-amber-700'>Branding Tokens</Typography>
                        </div>
                        <pre class='bg-indigo-50 rounded-md p-4 text-sm overflow-x-auto border border-indigo-200 text-gray-800'>{JSON.stringify(tenantBranding, null, 2)}</pre>
                    </Stack>
                </Card>
            )}

            <Card padding='lg' data-testid='computed-vars-card' className='bg-white/70 backdrop-blur-sm border border-indigo-200'>
                <Stack spacing='md'>
                    <div class='flex items-center gap-2 mb-2'>
                        <div class='w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full'></div>
                        <Typography variant='heading' className='text-amber-700'>Computed CSS Variables</Typography>
                    </div>
                    <div class='grid gap-3 md:grid-cols-2'>
                        {Object.entries(computedVars).map(([variable, value]) => (
                            <div key={variable} class='rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3'>
                                <p class='text-xs uppercase text-indigo-600 mb-1'>{variable}</p>
                                <p class='font-mono text-sm text-amber-700'>{value || 'not set'}</p>
                            </div>
                        ))}
                    </div>
                </Stack>
            </Card>
        </div>
    );
}
