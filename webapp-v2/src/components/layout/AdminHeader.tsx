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
                <nav class='flex items-center justify-between h-16'>
                    {/* Logo/Title Section */}
                    <div class='flex items-center gap-3'>
                        <div class='flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20'>
                            <svg class='w-6 h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='2'
                                    d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                                />
                                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                            </svg>
                        </div>
                        <span class='text-xl font-bold text-gray-900'>
                            System Admin
                        </span>
                    </div>

                    {/* Right Section - Logout Button */}
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
