import { apiClient } from '@/app/apiClient.ts';
import { TenantEditorModal } from '@/components/admin/TenantEditorModal';
import { Alert, Button, Card, LoadingSpinner } from '@/components/ui';
import { configStore } from '@/stores/config-store.ts';
import { logError } from '@/utils/browser-logger';
import type { TenantBrowserRecord } from '@billsplit-wl/shared';

type Tenant = TenantBrowserRecord;
import { useEffect, useState } from 'preact/hooks';

// Extended tenant type with computed fields from the backend
export function AdminTenantsTab() {
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
            setError(err instanceof Error ? err.message : 'Failed to load tenants');
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

    const handleEditTenant = (tenant: TenantBrowserRecord) => {
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
        return <Alert type='error' message={error} />;
    }

    if (isLoading) {
        return (
            <div class='flex items-center justify-center py-12'>
                <LoadingSpinner size='lg' testId='tenants-loading-spinner' />
            </div>
        );
    }

    return (
        <>
            <div class='mb-6 flex items-center justify-between bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-indigo-200'>
                <div class='flex items-center gap-3'>
                    <div class='w-2 h-2 rounded-full bg-amber-500 animate-pulse'></div>
                    <p class='text-sm text-gray-700'>
                        Total tenants: <span class='font-bold text-amber-700'>{tenants.length}</span>
                    </p>
                </div>
                <div class='flex gap-2'>
                    <Button onClick={handleCreateTenant} variant='primary' size='sm' data-testid='create-tenant-button'>
                        Create New Tenant
                    </Button>
                    <Button onClick={loadTenants} variant='secondary' size='sm' className='!bg-white !text-gray-800 !border-gray-300 hover:!bg-gray-50'>
                        Refresh
                    </Button>
                </div>
            </div>

            <div class='space-y-4'>
                {tenants.map((tenant) => {
                    const isCurrentTenant = tenant.tenant.tenantId === currentTenantId;
                    return (
                        <Card
                            key={tenant.tenant.tenantId}
                            className={`p-6 bg-white/70 backdrop-blur-sm border border-indigo-200 hover:border-indigo-300 transition-all ${
                                isCurrentTenant ? 'ring-2 ring-amber-400 bg-amber-50/50 border-amber-300' : ''
                            }`}
                        >
                            <div class='flex items-start justify-between'>
                                <div class='flex-1'>
                                    <div class='flex items-center gap-3 mb-3'>
                                        <h3 class='text-lg font-semibold text-amber-700'>
                                            {tenant.tenant.branding.appName}
                                        </h3>
                                        {isCurrentTenant && (
                                            <span class='inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-300'>
                                                Active
                                            </span>
                                        )}
                                        {tenant.isDefault && (
                                            <span class='inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300'>
                                                Default
                                            </span>
                                        )}
                                    </div>

                                    <div class='space-y-2 text-sm'>
                                        <div>
                                            <span class='text-indigo-600'>Tenant ID:</span> <span class='font-mono text-gray-800'>{tenant.tenant.tenantId}</span>
                                        </div>

                                        {tenant.domains.length > 0 && (
                                            <div>
                                                <span class='text-indigo-600'>Domains:</span>{' '}
                                                <span class='font-mono text-gray-800'>
                                                    {tenant.domains.map((domain, idx) => (
                                                        <>
                                                            {idx > 0 && ', '}
                                                            <button
                                                                onClick={() => handleSwitchTenant(domain)}
                                                                class='text-amber-700 hover:text-amber-600 hover:underline cursor-pointer transition-colors'
                                                                title='Click to switch to this tenant'
                                                            >
                                                                {domain}
                                                            </button>
                                                        </>
                                                    ))}
                                                </span>
                                            </div>
                                        )}

                                        <div class='pt-3 text-xs text-indigo-600 flex gap-4'>
                                            <div>
                                                Created: <span class='text-gray-700'>{new Date(tenant.tenant.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div>
                                                Updated: <span class='text-gray-700'>{new Date(tenant.tenant.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class='ml-4'>
                                    <Button
                                        onClick={() => handleEditTenant(tenant)}
                                        variant='secondary'
                                        size='sm'
                                        className='!bg-white !text-gray-800 !border-gray-300 hover:!bg-gray-50'
                                        data-testid={`edit-tenant-${tenant.tenant.tenantId}`}
                                    >
                                        Edit
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {tenants.length === 0 && (
                <Card className='p-12 text-center bg-white/70 backdrop-blur-sm border border-indigo-200'>
                    <div class='inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4'>
                        <svg class='w-8 h-8 text-indigo-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path
                                stroke-linecap='round'
                                stroke-linejoin='round'
                                stroke-width='2'
                                d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                            />
                        </svg>
                    </div>
                    <p class='text-indigo-700 text-lg'>No tenants found</p>
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
