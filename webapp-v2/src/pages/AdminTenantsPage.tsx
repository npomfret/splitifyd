import { useEffect, useState } from 'preact/hooks';
import { apiClient } from '../app/apiClient';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';
import { Alert, Button, Card } from '@/components/ui';
import { SystemUserRoles } from '@splitifyd/shared';
import { navigationService } from '@/services/navigation.service';

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
            console.error('Failed to load tenants:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isSystemAdmin) {
        return null; // Will redirect in useEffect
    }

    return (
        <BaseLayout title="System Admin - Tenants">
            <div class="max-w-7xl mx-auto px-4 py-8">
                <div class="mb-6">
                    <h1 class="text-3xl font-bold text-gray-900">Tenant Management</h1>
                    <p class="mt-2 text-gray-600">View and manage all tenant configurations</p>
                </div>

                {error && (
                    <Alert type="error" message={error} />
                )}

                {isLoading ? (
                    <div class="flex items-center justify-center py-12">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    </div>
                ) : (
                    <>
                        <div class="mb-4 flex items-center justify-between">
                            <p class="text-sm text-gray-600">
                                Total tenants: <span class="font-semibold">{tenants.length}</span>
                            </p>
                            <Button onClick={loadTenants} variant="secondary" size="sm">
                                Refresh
                            </Button>
                        </div>

                        <div class="space-y-4">
                            {tenants.map((tenant) => (
                                <Card key={tenant.tenant.tenantId} className="p-6">
                                    <div class="flex items-start justify-between">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-3 mb-2">
                                                <h3 class="text-lg font-semibold text-gray-900">
                                                    {tenant.tenant.branding.appName}
                                                </h3>
                                                {tenant.isDefault && (
                                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                        Default
                                                    </span>
                                                )}
                                            </div>

                                            <div class="space-y-2 text-sm">
                                                <div>
                                                    <span class="text-gray-500">Tenant ID:</span>{' '}
                                                    <span class="font-mono text-gray-900">{tenant.tenant.tenantId}</span>
                                                </div>

                                                {tenant.primaryDomain && (
                                                    <div>
                                                        <span class="text-gray-500">Primary Domain:</span>{' '}
                                                        <span class="font-mono text-gray-900">{tenant.primaryDomain}</span>
                                                    </div>
                                                )}

                                                {tenant.domains.length > 0 && (
                                                    <div>
                                                        <span class="text-gray-500">All Domains:</span>{' '}
                                                        <span class="font-mono text-gray-900">
                                                            {tenant.domains.join(', ')}
                                                        </span>
                                                    </div>
                                                )}

                                                <div class="pt-2 border-t border-gray-200 mt-3">
                                                    <p class="text-gray-500 mb-2">Features:</p>
                                                    <div class="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span class="text-gray-600">Multi-Currency:</span>{' '}
                                                            <span class={tenant.tenant.features.enableMultiCurrency ? 'text-green-600' : 'text-gray-400'}>
                                                                {tenant.tenant.features.enableMultiCurrency ? 'Enabled' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span class="text-gray-600">Advanced Reporting:</span>{' '}
                                                            <span class={tenant.tenant.features.enableAdvancedReporting ? 'text-green-600' : 'text-gray-400'}>
                                                                {tenant.tenant.features.enableAdvancedReporting ? 'Enabled' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span class="text-gray-600">Max Groups:</span>{' '}
                                                            <span class="text-gray-900">{tenant.tenant.features.maxGroupsPerUser || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                            <span class="text-gray-600">Max Users per Group:</span>{' '}
                                                            <span class="text-gray-900">{tenant.tenant.features.maxUsersPerGroup || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="pt-2 text-xs text-gray-500">
                                                    <div>Created: {new Date(tenant.tenant.createdAt).toLocaleDateString()}</div>
                                                    <div>Updated: {new Date(tenant.tenant.updatedAt).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {tenants.length === 0 && (
                            <Card className="p-12 text-center">
                                <p class="text-gray-500">No tenants found</p>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </BaseLayout>
    );
}
