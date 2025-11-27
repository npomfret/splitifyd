import { TenantEditorModal } from '@/components/admin/TenantEditorModal';
import { Alert, Button, Card, LoadingSpinner } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import type { TenantFullRecord } from '@billsplit-wl/shared';
import { SystemUserRoles } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';
import { apiClient } from '../app/apiClient';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { AdminLayout } from '../components/layout/AdminLayout';
import { configStore } from '../stores/config-store';

export function AdminTenantsPage() {
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
            setError(err instanceof Error ? err.message : 'Failed to load tenants');
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
            <div class='max-w-7xl mx-auto px-4 py-8 bg-slate-900 min-h-screen'>
                <div class='mb-6'>
                    <h1 class='text-3xl font-bold text-white'>Tenant Management</h1>
                    <p class='mt-2 text-slate-300'>View and manage all tenant configurations</p>
                </div>

                {error && <Alert type='error' message={error} />}

                {isLoading
                    ? (
                        <div class='flex items-center justify-center py-12'>
                            <LoadingSpinner size='lg' testId='tenants-loading-spinner' />
                        </div>
                    )
                    : (
                        <>
                            <div class='mb-4 flex items-center justify-between'>
                                <p class='text-sm text-slate-300'>
                                    Total tenants: <span class='font-semibold text-white'>{tenants.length}</span>
                                </p>
                                <div class='flex gap-2'>
                                    <Button onClick={handleCreateTenant} variant='primary' size='sm' data-testid='create-tenant-button'>
                                        Create New Tenant
                                    </Button>
                                    <Button onClick={loadTenants} variant='secondary' size='sm'>
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
                                            className={`p-6 bg-slate-800 border border-slate-700 ${isCurrentTenant ? 'ring-2 ring-blue-500 bg-blue-900/20' : ''}`}
                                        >
                                            <div class='flex items-start justify-between'>
                                                <div class='flex-1'>
                                                    <div class='flex items-center gap-3 mb-2'>
                                                        <h3 class='text-lg font-semibold text-white'>
                                                            {tenant.tenant.branding.appName}
                                                        </h3>
                                                        {isCurrentTenant && (
                                                            <span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400'>
                                                                Current
                                                            </span>
                                                        )}
                                                        {tenant.isDefault && (
                                                            <span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400'>
                                                                Default
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div class='space-y-2 text-sm'>
                                                        <div>
                                                            <span class='text-slate-400'>Tenant ID:</span> <span class='font-mono text-slate-200'>{tenant.tenant.tenantId}</span>
                                                        </div>

                                                        <div>
                                                            <span class='text-slate-400'>Primary Domain:</span> <span class='font-mono text-slate-200'>{tenant.domains[0] || 'None'}</span>
                                                        </div>

                                                        {tenant.domains.length > 0 && (
                                                            <div>
                                                                <span class='text-slate-400'>All Domains:</span>{' '}
                                                                <span class='font-mono text-slate-200'>
                                                                    {tenant.domains.map((domain, idx) => (
                                                                        <>
                                                                            {idx > 0 && ', '}
                                                                            <Clickable
                                                                                onClick={() => handleSwitchTenant(domain)}
                                                                                className='text-blue-400 hover:text-blue-300 hover:underline cursor-pointer'
                                                                                title='Click to switch to this tenant'
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

                                                        <div class='pt-2 text-xs text-slate-400'>
                                                            <div>Created: {new Date(tenant.tenant.createdAt).toLocaleDateString()}</div>
                                                            <div>Updated: {new Date(tenant.tenant.updatedAt).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class='ml-4'>
                                                    <Button
                                                        onClick={() => handleEditTenant(tenant)}
                                                        variant='secondary'
                                                        size='sm'
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
                                <Card className='p-12 text-center bg-slate-800 border border-slate-700'>
                                    <p class='text-slate-400'>No tenants found</p>
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
