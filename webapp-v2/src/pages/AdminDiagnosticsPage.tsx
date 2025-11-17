import { useEffect, useMemo, useState } from 'preact/hooks';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';
import { Alert, Button, Card, Stack, Typography } from '@/components/ui';
import { SystemUserRoles } from '@splitifyd/shared';
import { useConfig } from '@/hooks/useConfig.ts';
import { logError } from '@/utils/browser-logger';
import { getThemeStorageKey } from '@/utils/theme-bootstrap';

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

export function AdminDiagnosticsPage() {
    const authStore = useAuthRequired();
    const config = useConfig();
    const user = authStore.user;
    const hasAdminAccess = user?.role === SystemUserRoles.SYSTEM_ADMIN || user?.role === SystemUserRoles.TENANT_ADMIN;
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

    if (!user) {
        return null;
    }

    if (!hasAdminAccess) {
        return (
            <BaseLayout title='Admin Diagnostics' headerVariant='dashboard'>
                <div class='mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8'>
                    <Alert type='error' message='You do not have permission to view diagnostics. Tenant or system admin access is required.' />
                </div>
            </BaseLayout>
        );
    }

    const tenantBranding = config?.tenant?.branding;

    return (
        <BaseLayout title='Admin Diagnostics' description='Inspect tenant branding and theme artifacts' headerVariant='dashboard'>
            <div class='mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6'>
                {actionMessage && <Alert type={actionMessage.type} message={actionMessage.text} />}

                <Card padding='lg' data-testid='tenant-overview-card'>
                    <Stack spacing='sm'>
                        <Typography variant='heading'>Tenant Overview</Typography>
                        <div class='grid gap-4 md:grid-cols-3 text-sm text-text-primary'>
                            <div>
                                <p class='text-text-muted'>Tenant ID</p>
                                <p class='font-mono'>{config?.tenant?.tenantId ?? 'unknown'}</p>
                            </div>
                            <div>
                                <p class='text-text-muted'>App Name</p>
                                <p>{tenantBranding?.appName ?? 'Not configured'}</p>
                            </div>
                            <div>
                                <p class='text-text-muted'>Last Updated</p>
                                <p>{config?.tenant?.updatedAt ?? '—'}</p>
                            </div>
                        </div>
                    </Stack>
                </Card>

                <Card padding='lg' data-testid='theme-artifact-card'>
                    <Stack spacing='md'>
                        <div class='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
                            <div>
                                <Typography variant='heading'>Theme Artifact</Typography>
                                <Typography variant='caption' className='text-text-muted'>Hash + CSS delivery helpers</Typography>
                            </div>
                            <div class='flex flex-wrap gap-3'>
                                <Button variant='secondary' size='sm' onClick={handleCopyThemeLink} data-testid='copy-theme-link-button'>
                                    Copy Theme Link
                                </Button>
                                <Button variant='ghost' size='sm' onClick={handleForceReload} data-testid='force-reload-theme-button'>
                                    Force Reload Theme
                                </Button>
                            </div>
                        </div>
                        <div class='grid gap-4 text-sm text-text-primary md:grid-cols-3'>
                            <div>
                                <p class='text-text-muted'>Active Hash</p>
                                <p class='font-mono'>{config?.theme?.hash ?? 'not published'}</p>
                            </div>
                            <div>
                                <p class='text-text-muted'>Generated At</p>
                                <p>{config?.theme?.generatedAtEpochMs ? new Date(config.theme.generatedAtEpochMs).toISOString() : '—'}</p>
                            </div>
                            <div>
                                <p class='text-text-muted'>Link</p>
                                <p class='font-mono break-all'>{themeLink}</p>
                            </div>
                        </div>
                    </Stack>
                </Card>

                {tenantBranding && (
                    <Card padding='lg' data-testid='branding-tokens-card'>
                        <Stack spacing='md'>
                            <Typography variant='heading'>Branding Tokens</Typography>
                            <pre class='bg-surface-muted rounded-md p-4 text-sm overflow-x-auto border border-border-default'>{JSON.stringify(tenantBranding, null, 2)}</pre>
                        </Stack>
                    </Card>
                )}

                <Card padding='lg' data-testid='computed-vars-card'>
                    <Stack spacing='md'>
                        <Typography variant='heading'>Computed CSS Variables</Typography>
                        <div class='grid gap-3 md:grid-cols-2'>
                            {Object.entries(computedVars).map(([variable, value]) => (
                                <div key={variable} class='rounded-md border border-border-default bg-surface-base px-4 py-3'>
                                    <p class='text-xs uppercase text-text-muted'>{variable}</p>
                                    <p class='font-mono text-sm'>{value || 'not set'}</p>
                                </div>
                            ))}
                        </div>
                    </Stack>
                </Card>
            </div>
        </BaseLayout>
    );
}
