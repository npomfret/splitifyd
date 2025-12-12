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
import { HomeIcon, LogoutIcon } from '@/components/ui/icons';
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
    const brandingTokens = config?.tenant?.brandingTokens?.tokens;
    const logoUrl = brandingTokens?.assets?.logoUrl ?? null;
    const appName = brandingTokens?.legal?.appName ?? t('header.logoAlt');
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
        <header className='admin-header'>
            <div className='max-w-7xl mx-auto px-4'>
                <nav className='flex items-center justify-between h-16'>
                    {/* Left Section - Logo link to Dashboard + App Name */}
                    <div className='flex items-center gap-3'>
                        <Clickable
                            onClick={() => navigation.goToDashboard()}
                            className='cursor-pointer'
                            dataTestId='header-logo-link'
                            aria-label={t('header.goToDashboard')}
                            title={t('header.goToDashboard')}
                            eventName='admin_header_logo_click'
                            eventProps={{ destination: 'dashboard' }}
                        >
                            {logoUrl ? <img src={logoUrl} alt={appName} className='h-8' /> : <HomeIcon size={32} className='text-gray-900' />}
                        </Clickable>
                        {showAppName && (
                            <span className='text-gray-900 font-semibold leading-6 whitespace-nowrap'>
                                {appName}
                            </span>
                        )}
                    </div>

                    {/* Right Section - User Info and Logout Button */}
                    <div className='flex items-center gap-4'>
                        {authStore?.user && (
                            <span className='text-sm text-gray-600'>
                                {authStore.user.displayName || authStore.user.email}
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors'
                            data-testid='admin-logout-button'
                        >
                            <LogoutIcon size={16} />
                            {t('navigation.userMenu.logout')}
                        </button>
                    </div>
                </nav>
            </div>
        </header>
    );
}
