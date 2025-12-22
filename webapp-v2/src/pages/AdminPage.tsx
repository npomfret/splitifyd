import { translateAdminTab } from '@/app/i18n/dynamic-translations';
import { LoadingState } from '@/components/ui';
import { navigationService } from '@/services/navigation.service';
import { SystemUserRoles } from '@billsplit-wl/shared';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '@/app/hooks';
import { AdminDiagnosticsTab } from '../components/admin/AdminDiagnosticsTab';
import { AdminTenantConfigTab } from '../components/admin/AdminTenantConfigTab';
import { AdminTenantsTab } from '../components/admin/AdminTenantsTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminLayout } from '@/components/layout';

type AdminTab = 'tenants' | 'diagnostics' | 'tenant-config' | 'users';

interface AdminPageProps {
    tab?: AdminTab;
}

export function AdminPage({ tab: initialTab }: AdminPageProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const user = authStore.user;
    const isSystemAdmin = user?.role === SystemUserRoles.SYSTEM_ADMIN;
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
        return <LoadingState fullPage message={t('admin.loading')} />;
    }

    if (!isSystemAdmin) {
        return null; // Will redirect in useEffect once role is known
    }

    const tabs: { id: AdminTab; labelKey: 'tenants' | 'diagnostics' | 'tenantConfig' | 'users'; icon: string; }[] = [
        {
            id: 'tenants',
            labelKey: 'tenants',
            icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        },
        {
            id: 'diagnostics',
            labelKey: 'diagnostics',
            icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
        },
        {
            id: 'tenant-config',
            labelKey: 'tenantConfig',
            icon:
                'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
        },
        {
            id: 'users',
            labelKey: 'users',
            icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
        },
    ];

    return (
        <AdminLayout>
            {/* Admin-specific background with grid pattern */}
            <div className='relative min-h-screen admin-gradient-mixed'>
                {/* Decorative grid overlay */}
                <div className='absolute inset-0 admin-grid-pattern'></div>

                {/* Content */}
                <div className='relative max-w-7xl mx-auto px-4 py-8'>
                    {/* Tabs with admin styling */}
                    <div className='mb-8'>
                        <nav className='flex space-x-2 bg-white/70 backdrop-blur-xs rounded-lg p-1.5 border border-indigo-200' aria-label={t('admin.tabs.ariaLabel')}>
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                const isDisabled = false; // All tabs are now implemented

                                const tabClassName = `flex items-center gap-2 py-3 px-4 rounded-md font-medium text-sm transition-all ${
                                    isActive
                                        ? 'bg-linear-to-r from-amber-50 to-orange-50 text-amber-700 shadow-lg shadow-amber-500/10 border border-amber-300'
                                        : isDisabled
                                        ? 'text-gray-400 cursor-not-allowed'
                                        : 'text-indigo-600 hover:text-amber-600 hover:bg-indigo-50'
                                }`;

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => !isDisabled && handleTabChange(tab.id)}
                                        disabled={isDisabled}
                                        className={tabClassName}
                                    >
                                        <svg
                                            className='w-5 h-5'
                                            fill='none'
                                            stroke='currentColor'
                                            viewBox='0 0 24 24'
                                            aria-hidden='true'
                                        >
                                            <path
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                                strokeWidth='2'
                                                d={tab.icon}
                                            />
                                        </svg>
                                        {translateAdminTab(tab.labelKey, t)}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className='mt-6'>
                        {activeTab === 'tenants' && <AdminTenantsTab />}
                        {activeTab === 'diagnostics' && <AdminDiagnosticsTab />}
                        {activeTab === 'tenant-config' && <AdminTenantConfigTab />}
                        {activeTab === 'users' && <AdminUsersTab />}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
