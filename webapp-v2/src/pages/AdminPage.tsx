import { useEffect, useState } from 'preact/hooks';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { BaseLayout } from '../components/layout/BaseLayout';
import { Alert } from '@/components/ui';
import { SystemUserRoles } from '@splitifyd/shared';
import { navigationService } from '@/services/navigation.service';
import { LoadingState } from '@/components/ui';
import { AdminTenantsTab } from '../components/admin/AdminTenantsTab';
import { AdminDiagnosticsTab } from '../components/admin/AdminDiagnosticsTab';

type AdminTab = 'tenants' | 'diagnostics' | 'users';

interface AdminPageProps {
    tab?: AdminTab;
}

export function AdminPage({ tab: initialTab }: AdminPageProps) {
    const authStore = useAuthRequired();
    const user = authStore.user;
    const isSystemAdmin = user?.role === SystemUserRoles.SYSTEM_ADMIN || user?.role === SystemUserRoles.SYSTEM_USER;
    const hasResolvedRole = user?.role !== undefined && user?.role !== null;

    // Get tab from URL query parameter if not provided as prop
    const [activeTab, setActiveTab] = useState<AdminTab>(() => {
        if (initialTab) return initialTab;

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get('tab') as AdminTab | null;
            return tabParam || 'tenants';
        }

        return 'tenants';
    });

    useEffect(() => {
        // Redirect once role is known and user is not a system admin
        if (hasResolvedRole && !isSystemAdmin) {
            navigationService.goToDashboard();
            return;
        }
    }, [hasResolvedRole, isSystemAdmin]);

    // Update URL when tab changes
    const handleTabChange = (tab: AdminTab) => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.pushState({}, '', url.toString());
    };

    if (!hasResolvedRole) {
        return <LoadingState fullPage message='Loading admin...' />;
    }

    if (!isSystemAdmin) {
        return null; // Will redirect in useEffect once role is known
    }

    const tabs: { id: AdminTab; label: string; icon: string }[] = [
        {
            id: 'tenants',
            label: 'Tenants',
            icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
        },
        {
            id: 'diagnostics',
            label: 'Diagnostics',
            icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
        },
        {
            id: 'users',
            label: 'Users',
            icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
        }
    ];

    return (
        <BaseLayout title="System Admin">
            <div class="bg-slate-900 min-h-screen">
                <div class="max-w-7xl mx-auto px-4 py-8">
                    {/* Header */}
                    <div class="mb-8">
                        <h1 class="text-3xl font-bold text-white">System Administration</h1>
                        <p class="mt-2 text-slate-300">Manage tenants, diagnostics, and system settings</p>
                    </div>

                    {/* Tabs */}
                    <div class="border-b border-slate-700 mb-6">
                        <nav class="flex space-x-8" aria-label="Admin tabs">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const isDisabled = tab.id === 'users'; // Users tab not implemented yet

                                const tabClassName = `flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                    isActive
                                        ? 'border-blue-500 text-blue-400'
                                        : isDisabled
                                            ? 'border-transparent text-slate-600 cursor-not-allowed'
                                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-400'
                                }`;

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => !isDisabled && handleTabChange(tab.id)}
                                        disabled={isDisabled}
                                        class={tabClassName}
                                        data-testid={`admin-tab-${tab.id}`}
                                    >
                                        <svg
                                            class="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d={tab.icon}
                                            />
                                        </svg>
                                        {tab.label}
                                        {isDisabled && (
                                            <span class="ml-2 text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">
                                                Coming Soon
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div class="mt-6">
                        {activeTab === 'tenants' && <AdminTenantsTab />}
                        {activeTab === 'diagnostics' && <AdminDiagnosticsTab />}
                        {activeTab === 'users' && (
                            <div class="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
                                <p class="text-slate-400">User management coming soon</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </BaseLayout>
    );
}
