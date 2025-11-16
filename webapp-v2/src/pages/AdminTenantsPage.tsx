import { useEffect, useState } from 'preact/hooks';
import { apiClient } from '../app/apiClient';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';
import { Alert, Button, Card, LoadingSpinner } from '@/components/ui';
import { SystemUserRoles } from '@splitifyd/shared';
import { navigationService } from '@/services/navigation.service';
import { configStore } from '../stores/config-store';
import { logError } from '@/utils/browser-logger';

interface TenantBranding {
    appName: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    marketingFlags?: {
        showLandingPage?: boolean;
        showMarketingContent?: boolean;
        showPricingPage?: boolean;
        showBlogPage?: boolean;
    };
}

interface TenantFeatures {
    enableAdvancedReporting?: boolean;
    enableMultiCurrency?: boolean;
    enableCustomFields?: boolean;
    maxGroupsPerUser?: number;
    maxUsersPerGroup?: number;
}

interface TenantConfig {
    tenantId: string;
    branding: TenantBranding;
    features: TenantFeatures;
    createdAt: string;
    updatedAt: string;
}

interface Tenant {
    tenant: TenantConfig;
    primaryDomain: string | null;
    domains: string[];
    isDefault: boolean;
}

interface TenantsResponse {
    tenants: Tenant[];
    count: number;
}

export function AdminTenantsPage() {
    const authStore = useAuthRequired();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const user = authStore.user;
    const isSystemAdmin = user?.role === SystemUserRoles.SYSTEM_ADMIN || user?.role === SystemUserRoles.SYSTEM_USER;

    // Get current tenant ID from config
    const currentTenantId = configStore.config?.tenant?.tenantId;

    useEffect(() => {
        // Redirect if not system admin
        if (!isSystemAdmin) {
            navigationService.goToDashboard();
            return;
        }

        loadTenants();
    }, [isSystemAdmin]);

    const loadTenants = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await apiClient.listAllTenants<TenantsResponse>();
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

    const handleEditTenant = (tenantId: string) => {
        // TODO: Implement tenant editing
        alert(`Tenant editing not yet implemented for: ${tenantId}`);
    };

    if (!isSystemAdmin) {
        return null; // Will redirect in useEffect
    }

    return (
        <BaseLayout title="System Admin - Tenants">
            <div class="max-w-7xl mx-auto px-4 py-8 bg-slate-900 min-h-screen">
                <div class="mb-6">
                    <h1 class="text-3xl font-bold text-white">Tenant Management</h1>
                    <p class="mt-2 text-slate-300">View and manage all tenant configurations</p>
                </div>

                {error && (
                    <Alert type="error" message={error} />
                )}

                {isLoading ? (
                    <div class="flex items-center justify-center py-12">
                        <LoadingSpinner size='lg' testId='tenants-loading-spinner' />
                    </div>
                ) : (
                    <>
                        <div class="mb-4 flex items-center justify-between">
                            <p class="text-sm text-slate-300">
                                Total tenants: <span class="font-semibold text-white">{tenants.length}</span>
                            </p>
                            <Button onClick={loadTenants} variant="secondary" size="sm">
                                Refresh
                            </Button>
                        </div>

                        <div class="space-y-4">
                            {tenants.map((tenant) => {
                                const isCurrentTenant = tenant.tenant.tenantId === currentTenantId;
                                return (
                                    <Card
                                        key={tenant.tenant.tenantId}
                                        className={`p-6 bg-slate-800 border border-slate-700 ${isCurrentTenant ? 'ring-2 ring-blue-500 bg-blue-900/20' : ''}`}
                                    >
                                        <div class="flex items-start justify-between">
                                            <div class="flex-1">
                                                <div class="flex items-center gap-3 mb-2">
                                                    <h3 class="text-lg font-semibold text-white">
                                                        {tenant.tenant.branding.appName}
                                                    </h3>
                                                    {isCurrentTenant && (
                                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                                                            Current
                                                        </span>
                                                    )}
                                                    {tenant.isDefault && (
                                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>

                                                <div class="space-y-2 text-sm">
                                                    <div>
                                                        <span class="text-slate-400">Tenant ID:</span>{' '}
                                                        <span class="font-mono text-slate-200">{tenant.tenant.tenantId}</span>
                                                    </div>

                                                    {tenant.primaryDomain && (
                                                        <div>
                                                            <span class="text-slate-400">Primary Domain:</span>{' '}
                                                            <button
                                                                onClick={() => handleSwitchTenant(tenant.primaryDomain!)}
                                                                class="font-mono text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                                                                title="Click to switch to this tenant"
                                                            >
                                                                {tenant.primaryDomain}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {tenant.domains.length > 0 && (
                                                        <div>
                                                            <span class="text-slate-400">All Domains:</span>{' '}
                                                            <span class="font-mono text-slate-200">
                                                                {tenant.domains.map((domain, idx) => (
                                                                    <>
                                                                        {idx > 0 && ', '}
                                                                        <button
                                                                            onClick={() => handleSwitchTenant(domain)}
                                                                            class="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                                                                            title="Click to switch to this tenant"
                                                                        >
                                                                            {domain}
                                                                        </button>
                                                                    </>
                                                                ))}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div class="pt-2 border-t border-slate-700 mt-3">
                                                        <p class="text-slate-400 mb-2">Features:</p>
                                                        <div class="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <span class="text-slate-400">Multi-Currency:</span>{' '}
                                                                <span class={tenant.tenant.features.enableMultiCurrency ? 'text-green-400' : 'text-slate-500'}>
                                                                    {tenant.tenant.features.enableMultiCurrency ? 'Enabled' : 'Disabled'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span class="text-slate-400">Advanced Reporting:</span>{' '}
                                                                <span class={tenant.tenant.features.enableAdvancedReporting ? 'text-green-400' : 'text-slate-500'}>
                                                                    {tenant.tenant.features.enableAdvancedReporting ? 'Enabled' : 'Disabled'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span class="text-slate-400">Max Groups:</span>{' '}
                                                                <span class="text-white">{tenant.tenant.features.maxGroupsPerUser || 'N/A'}</span>
                                                            </div>
                                                            <div>
                                                                <span class="text-slate-400">Max Users per Group:</span>{' '}
                                                                <span class="text-white">{tenant.tenant.features.maxUsersPerGroup || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div class="pt-2 text-xs text-slate-400">
                                                        <div>Created: {new Date(tenant.tenant.createdAt).toLocaleDateString()}</div>
                                                        <div>Updated: {new Date(tenant.tenant.updatedAt).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="ml-4">
                                                <Button
                                                    onClick={() => handleEditTenant(tenant.tenant.tenantId)}
                                                    variant="secondary"
                                                    size="sm"
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
                            <Card className="p-12 text-center bg-slate-800 border border-slate-700">
                                <p class="text-slate-400">No tenants found</p>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </BaseLayout>
    );
}
