import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { SidebarCard } from '@/components/ui';
import { useComputed } from '@preact/signals';
import { useTranslation } from 'react-i18next';

export function DashboardStats() {
    const { t } = useTranslation();
    const groups = useComputed(() => enhancedGroupsStore.groups);
    const loading = useComputed(() => enhancedGroupsStore.loading);

    const stats = useComputed(() => {
        const groupsList = groups.value;
        const activeGroups = groupsList.length; // All groups are considered active

        return {
            totalGroups: groupsList.length,
            activeGroups,
        };
    });

    if (loading.value) {
        return (
            <SidebarCard title={t('dashboardStats.title')}>
                <div className='animate-pulse space-y-3'>
                    <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                    <div className='h-4 bg-gray-200 rounded w-1/2'></div>
                    <div className='h-4 bg-gray-200 rounded w-2/3'></div>
                </div>
            </SidebarCard>
        );
    }

    return (
        <SidebarCard title={t('dashboardStats.title')}>
            <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                    <span className='text-sm text-gray-600'>{t('dashboardStats.totalGroups')}</span>
                    <span className='text-lg font-semibold text-gray-900'>{stats.value.totalGroups}</span>
                </div>
                <div className='flex justify-between items-center'>
                    <span className='text-sm text-gray-600'>{t('dashboardStats.activeGroups')}</span>
                    <span className='text-lg font-semibold text-green-600'>{stats.value.activeGroups}</span>
                </div>
            </div>
        </SidebarCard>
    );
}
