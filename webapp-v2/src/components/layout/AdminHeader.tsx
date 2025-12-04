/**
 * AdminHeader - Minimal header for admin pages
 *
 * This component is completely isolated from tenant theming.
 * It provides only essential navigation: logo/title and logout button.
 *
 * Key differences from regular Header:
 * - No tenant theme variables
 * - No magnetic hover effects
 * - Fixed indigo/amber styling via admin.css
 * - Minimal navigation (no user menu dropdown)
 */

import { useAuth } from '@/app/hooks/useAuth.ts';
import { Clickable } from '@/components/ui/Clickable';
import { useConfig } from '@/hooks/useConfig.ts';
import { useNavigation } from '@/hooks/useNavigation';
import { navigationService } from '@/services/navigation.service';
import { useTranslation } from 'react-i18next';

export function AdminHeader() {
    const { t } = useTranslation();
    const authStore = useAuth();
    const config = useConfig();
    const navigation = useNavigation();
    const branding = config?.tenant?.branding ?? null;
    const logoUrl = branding?.logoUrl ?? null;
    const appName = branding?.appName ?? t('header.logoAlt');
    const showAppName = branding?.showAppNameInHeader !== false;

    const handleLogout = async () => {
        if (!authStore) return;

        try {
            await authStore.logout();
            navigationService.goToLogin();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <header class='admin-header'>
            <div class='max-w-7xl mx-auto px-4'>
                <nav class='flex items-center justify-between h-16'>
                    {/* Left Section - Logo link to Dashboard + App Name */}
                    <div class='flex items-center gap-3'>
                        <Clickable
                            onClick={() => navigation.goToDashboard()}
                            className='cursor-pointer'
                            data-testid='header-logo-link'
                            aria-label={t('header.goToDashboard')}
                            title={t('header.goToDashboard')}
                            eventName='admin_header_logo_click'
                            eventProps={{ destination: 'dashboard' }}
                        >
                            {logoUrl ? (
                                <img src={logoUrl} alt={appName} class='h-8' />
                            ) : (
                                <svg class='h-8 w-8 text-gray-900' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                        stroke-linecap='round'
                                        stroke-linejoin='round'
                                        stroke-width='2'
                                        d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
                                    />
                                </svg>
                            )}
                        </Clickable>
                        {showAppName && (
                            <span class='text-gray-900 font-semibold leading-6 whitespace-nowrap'>
                                {appName}
                            </span>
                        )}
                    </div>

                    {/* Right Section - User Info and Logout Button */}
                    <div class='flex items-center gap-4'>
                        {authStore?.user && (
                            <span class='text-sm text-gray-600'>
                                {authStore.user.displayName || authStore.user.email}
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            class='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors'
                            data-testid='admin-logout-button'
                        >
                            <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='2'
                                    d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
                                />
                            </svg>
                            Logout
                        </button>
                    </div>
                </nav>
            </div>
        </header>
    );
}
