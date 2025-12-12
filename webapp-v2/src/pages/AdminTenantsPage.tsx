import { TenantEditorModal } from '@/components/admin/TenantEditorModal';
import { Alert, Button, Card, LoadingSpinner } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import type { TenantFullRecord } from '@billsplit-wl/shared';
import { SystemUserRoles } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../app/apiClient';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { AdminLayout } from '../components/layout/AdminLayout';
import { configStore } from '../stores/config-store';

export function AdminTenantsPage() {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [tenants, setTenants] = useState<TenantFullRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedTenant, setSelectedTenant] = useState<TenantFullRecord | null>(null);

    const user = authStore.user;
    const isSystemAdmin = user?.role === SystemUserRoles.SYSTEM_ADMIN;
    // Wait for both auth initialization AND role to be loaded (role will be undefined initially)
    const isAuthLoading = authStore.loading || !authStore.initialized || (user !== null && user.role === undefined);

    // Get current tenant ID from config
    const currentTenantId = configStore.config?.tenant?.tenantId;

    useEffect(() => {
        // Wait for auth to finish loading AND role to be loaded before checking access
        if (isAuthLoading) {
            return;
        }

        // Redirect if not system admin
        if (!isSystemAdmin) {
            navigationService.goToDashboard();
            return;
        }

        loadTenants();
    }, [isSystemAdmin, isAuthLoading]);

    const loadTenants = async (): Promise<TenantFullRecord[]> => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await apiClient.listAllTenants();
            setTenants(response.tenants);
            return response.tenants;
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.tenants.errors.load'));
            logError('Failed to load tenants', err);
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwitchTenant = (domain: string) => {
        // Navigate to the tenant's domain
        window.location.href = `${window.location.protocol}//${domain}`;
    };

    const handleCreateTenant = () => {
        setModalMode('create');
        setSelectedTenant(null);
        setIsModalOpen(true);
    };

    const handleEditTenant = (tenant: TenantFullRecord) => {
        setModalMode('edit');
        setSelectedTenant(tenant);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedTenant(null);
    };

    const handleModalSave = async () => {
        const tenantIdBeforeSave = selectedTenant?.tenant.tenantId;

        // Refresh tenant list after save
        const refreshedTenants = await loadTenants();

        // CRITICAL: Update selectedTenant reference to point to the refreshed tenant data from the reloaded list
        // Without this, the modal would show stale data if reopened because React state holds old object reference
        if (tenantIdBeforeSave) {
            const updatedTenant = refreshedTenants.find(t => t.tenant.tenantId === tenantIdBeforeSave);
            if (updatedTenant) {
                setSelectedTenant(updatedTenant);
            }
        }
    };

    if (!isSystemAdmin) {
        return null; // Will redirect in useEffect
    }

    return (
        <AdminLayout>
            <div className='max-w-7xl mx-auto px-4 py-8 bg-slate-900 min-h-screen'>
                <div className='mb-6'>
                    <h1 className='text-3xl font-bold text-white'>{t('admin.tenants.pageTitle')}</h1>
                    <p className='mt-2 text-slate-300'>{t('admin.tenants.pageDescription')}</p>
                </div>

                {error && <Alert type='error' message={error} />}

                {isLoading
                    ? (
                        <div className='flex items-center justify-center py-12'>
                            <LoadingSpinner size='lg' testId='tenants-loading-spinner' />
                        </div>
                    )
                    : (
                        <>
                            <div className='mb-4 flex items-center justify-between'>
                                <p className='text-sm text-slate-300'>
                                    {t('admin.tenants.summary.total')} <span className='font-semibold text-white'>{tenants.length}</span>
                                </p>
                                <div className='flex gap-2'>
                                    <Button onClick={handleCreateTenant} variant='primary' size='sm' data-testid='create-tenant-button'>
                                        {t('admin.tenants.actions.create')}
                                    </Button>
                                    <Button onClick={loadTenants} variant='secondary' size='sm'>
                                        {t('common.refresh')}
                                    </Button>
                                </div>
                            </div>

                            <div className='space-y-4'>
                                {tenants.map((tenant) => {
                                    const isCurrentTenant = tenant.tenant.tenantId === currentTenantId;
                                    return (
                                        <Card
                                            key={tenant.tenant.tenantId}
                                            data-testid='tenant-card'
                                            className={`p-6 bg-slate-800 border border-slate-700 ${isCurrentTenant ? 'ring-2 ring-blue-500 bg-blue-900/20' : ''}`}
                                        >
                                            <div className='flex items-start justify-between'>
                                                <div className='flex-1'>
                                                    <div className='flex items-center gap-3 mb-2'>
                                                        <h3 className='text-lg font-semibold text-white'>
                                                            {tenant.tenant.brandingTokens.tokens.legal.appName}
                                                        </h3>
                                                        {isCurrentTenant && (
                                                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400'>
                                                                {t('admin.tenants.status.active')}
                                                            </span>
                                                        )}
                                                        {tenant.isDefault && (
                                                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400'>
                                                                {t('admin.tenants.status.default')}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className='space-y-2 text-sm'>
                                                        <div>
                                                            <span className='text-slate-400'>{t('admin.tenants.details.tenantId')}</span>{' '}
                                                            <span className='font-mono text-slate-200'>{tenant.tenant.tenantId}</span>
                                                        </div>

                                                        <div>
                                                            <span className='text-slate-400'>{t('admin.tenants.details.primaryDomain')}</span>{' '}
                                                            <span className='font-mono text-slate-200'>{tenant.domains[0] || t('common.none')}</span>
                                                        </div>

                                                        {tenant.domains.length > 0 && (
                                                            <div>
                                                                <span className='text-slate-400'>{t('admin.tenants.details.allDomains')}</span>{' '}
                                                                <span className='font-mono text-slate-200'>
                                                                    {tenant.domains.map((domain, idx) => (
                                                                        <>
                                                                            {idx > 0 && ', '}
                                                                            <Clickable
                                                                                onClick={() => handleSwitchTenant(domain)}
                                                                                className='text-blue-400 hover:text-blue-300 hover:underline cursor-pointer'
                                                                                title={t('admin.tenants.actions.switchTenant')}
                                                                                aria-label={`Switch to tenant ${domain}`}
                                                                                eventName='admin_switch_tenant'
                                                                                eventProps={{ domain }}
                                                                            >
                                                                                {domain}
                                                                            </Clickable>
                                                                        </>
                                                                    ))}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className='pt-2 text-xs text-slate-400'>
                                                            <div>{t('common.created')}: {new Date(tenant.tenant.createdAt).toLocaleDateString()}</div>
                                                            <div>{t('common.updated')}: {new Date(tenant.tenant.updatedAt).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className='ml-4'>
                                                    <Button
                                                        onClick={() => handleEditTenant(tenant)}
                                                        variant='secondary'
                                                        size='sm'
                                                        data-testid={`edit-tenant-${tenant.tenant.tenantId}`}
                                                    >
                                                        {t('common.edit')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>

                            {tenants.length === 0 && (
                                <Card className='p-12 text-center bg-slate-800 border border-slate-700'>
                                    <p className='text-slate-400'>{t('admin.tenants.emptyState')}</p>
                                </Card>
                            )}
                        </>
                    )}
            </div>

            {/* Tenant Editor Modal */}
            <TenantEditorModal
                open={isModalOpen}
                onClose={handleModalClose}
                onSave={handleModalSave}
                tenant={selectedTenant || undefined}
                mode={modalMode}
            />
        </AdminLayout>
    );
}
