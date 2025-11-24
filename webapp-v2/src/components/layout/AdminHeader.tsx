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
import { navigationService } from '@/services/navigation.service';

export function AdminHeader() {
    const authStore = useAuth();

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
                <nav class='flex items-center justify-end h-16'>
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
