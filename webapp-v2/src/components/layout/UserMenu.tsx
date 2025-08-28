import { useState, useRef, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { useTranslation } from 'react-i18next';

interface UserMenuProps {
    user: {
        uid: string;
        email: string;
        displayName?: string;
    };
}

export function UserMenu({ user }: UserMenuProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            // Use capture phase and add delay to prevent race conditions
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside, true);
            }, 0);
            return () => document.removeEventListener('click', handleClickOutside, true);
        }
    }, [isOpen]);

    const userInitial = user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();

    const userName = user.displayName || user.email.split('@')[0];

    return (
        <div class="relative" ref={menuRef}>
            <button
                data-testid="user-menu-button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                class="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-controls="user-dropdown-menu"
            >
                <div class="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center">
                    <span class="text-sm font-medium">{userInitial}</span>
                </div>
                <div class="hidden sm:block text-left">
                    <p class="text-sm font-medium text-gray-700">{userName}</p>
                    <p class="text-xs text-gray-500">{user.email}</p>
                </div>
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div 
                    id="user-dropdown-menu"
                    data-testid="user-dropdown-menu" 
                    class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                >
                <div class="px-4 py-2 border-b border-gray-100">
                    <p class="text-sm font-medium text-gray-900">{userName}</p>
                    <p class="text-xs text-gray-500">{user.email}</p>
                </div>

                <a href="/dashboard" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors" data-testid="user-menu-dashboard-link" role="menuitem">
                    {t('userMenu.dashboard')}
                </a>

                <a href="/settings" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors" data-testid="user-menu-settings-link" role="menuitem">
                    {t('userMenu.settings')}
                </a>

                <hr class="my-1 border-gray-100" />

                <button
                    data-testid="sign-out-button"
                    onClick={async (e) => {
                        e.stopPropagation();
                        try {
                            await authStore.logout();
                            // Force immediate redirect to login
                            route('/login', true);
                        } catch (error) {
                            // Error is already handled in authStore
                            console.error('Logout failed:', error);
                        }
                    }}
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    disabled={authStore.loading}
                    role="menuitem"
                >
                    {authStore.loading ? t('userMenu.signingOut') : t('userMenu.signOut')}
                </button>
            </div>
            )}
        </div>
    );
}
