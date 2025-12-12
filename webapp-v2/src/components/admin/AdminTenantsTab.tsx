import { apiClient } from '@/app/apiClient.ts';
import { TenantEditorModal } from '@/components/admin/TenantEditorModal';
import { Alert, Button, Card, LoadingSpinner } from '@/components/ui';
import { BuildingIcon } from '@/components/ui/icons';
import { configStore } from '@/stores/config-store.ts';
import { logError } from '@/utils/browser-logger';
import type { TenantFullRecord } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

type Tenant = TenantFullRecord;

// Extended tenant type with computed fields from the backend
export function AdminTenantsTab() {
    const { t } = useTranslation();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

    // Get current tenant ID from config
    const currentTenantId = configStore.config?.tenant?.tenantId;

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await apiClient.listAllTenants();
            setTenants(response.tenants);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.tenants.errors.load'));
            logError('Failed to load tenants', err);
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

    const handleModalSave = () => {
        // Refresh tenant list after save
        loadTenants();
    };

    if (error) {
        return (
            <>
                <Alert type='error' message={error} />
                {/* Keep modal mounted even during error state */}
                <TenantEditorModal
                    open={isModalOpen}
                    onClose={handleModalClose}
                    onSave={handleModalSave}
                    tenant={selectedTenant || undefined}
                    mode={modalMode}
                />
            </>
        );
    }

    if (isLoading && tenants.length === 0) {
        return (
            <>
                <div className='flex items-center justify-center py-12'>
                    <LoadingSpinner size='lg' testId='tenants-loading-spinner' />
                </div>
                {/* Keep modal mounted during initial load */}
                <TenantEditorModal
                    open={isModalOpen}
                    onClose={handleModalClose}
                    onSave={handleModalSave}
                    tenant={selectedTenant || undefined}
                    mode={modalMode}
                />
            </>
        );
    }

    return (
        <>
            <div className='mb-6 flex items-center justify-between bg-white/70 backdrop-blur-xs rounded-lg p-4 border border-indigo-200'>
                <div className='flex items-center gap-3'>
                    <div className='w-2 h-2 rounded-full bg-amber-500 animate-pulse'></div>
                    <p className='text-sm text-gray-700'>
                        {t('admin.tenants.summary.total')} <span className='font-bold text-amber-700'>{tenants.length}</span>
                    </p>
                </div>
                <div className='flex gap-2'>
                    <Button onClick={handleCreateTenant} variant='primary' size='sm' dataTestId='create-tenant-button'>
                        {t('admin.tenants.actions.create')}
                    </Button>
                    <Button onClick={loadTenants} variant='secondary' size='sm' className='bg-white! text-gray-800! border-gray-300! hover:bg-gray-50!'>
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
                            dataTestId='tenant-card'
                            className={`p-6 bg-white/70 backdrop-blur-xs border border-indigo-200 hover:border-indigo-300 transition-all ${
                                isCurrentTenant ? 'ring-2 ring-amber-400 bg-amber-50/50 border-amber-300' : ''
                            }`}
                        >
                            <div className='flex items-start justify-between'>
                                <div className='flex-1'>
                                    <div className='flex items-center gap-3 mb-3'>
                                        <h3 className='text-lg font-semibold text-amber-700'>
                                            {tenant.tenant.brandingTokens.tokens.legal.appName}
                                        </h3>
                                        {isCurrentTenant && (
                                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-300'>
                                                {t('admin.tenants.status.active')}
                                            </span>
                                        )}
                                        {tenant.isDefault && (
                                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300'>
                                                {t('admin.tenants.status.default')}
                                            </span>
                                        )}
                                    </div>

                                    <div className='space-y-2 text-sm'>
                                        <div>
                                            <span className='text-indigo-600'>{t('admin.tenants.details.tenantId')}</span> <span className='font-mono text-gray-800'>{tenant.tenant.tenantId}</span>
                                        </div>

                                        {tenant.domains.length > 0 && (
                                            <div>
                                                <span className='text-indigo-600'>{t('admin.tenants.details.domains')}</span>{' '}
                                                <span className='font-mono text-gray-800'>
                                                    {tenant.domains.map((domain, idx) => (
                                                        <>
                                                            {idx > 0 && ', '}
                                                            <button
                                                                onClick={() => handleSwitchTenant(domain)}
                                                                className='text-amber-700 hover:text-amber-600 hover:underline cursor-pointer transition-colors'
                                                                title={t('admin.tenants.actions.switchTenant')}
                                                            >
                                                                {domain}
                                                            </button>
                                                        </>
                                                    ))}
                                                </span>
                                            </div>
                                        )}

                                        <div className='pt-3 text-xs text-indigo-600 flex gap-4'>
                                            <div>
                                                {t('common.created')}: <span className='text-gray-700'>{new Date(tenant.tenant.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div>
                                                {t('common.updated')}: <span className='text-gray-700'>{new Date(tenant.tenant.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className='ml-4'>
                                    <Button
                                        onClick={() => handleEditTenant(tenant)}
                                        variant='secondary'
                                        size='sm'
                                        dataTestId={`edit-tenant-${tenant.tenant.tenantId}`}
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
                <Card className='p-12 text-center bg-white/70 backdrop-blur-xs border border-indigo-200'>
                    <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4'>
                        <BuildingIcon size={32} className='text-indigo-600' />
                    </div>
                    <p className='text-indigo-700 text-lg'>{t('admin.tenants.emptyState')}</p>
                </Card>
            )}

            {/* Tenant Editor Modal */}
            <TenantEditorModal
                open={isModalOpen}
                onClose={handleModalClose}
                onSave={handleModalSave}
                tenant={selectedTenant || undefined}
                mode={modalMode}
            />
        </>
    );
}
