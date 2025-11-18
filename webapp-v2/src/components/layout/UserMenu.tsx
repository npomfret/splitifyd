import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import { type SystemUserRole, SystemUserRoles } from '@billsplit-wl/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface UserMenuProps {
    user: {
        uid: string;
        email: string;
        displayName?: string;
        role?: SystemUserRole;
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
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside, true);
            }, 0);
            return () => document.removeEventListener('click', handleClickOutside, true);
        }
    }, [isOpen]);

    const userInitial = user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();
    const userName = user.displayName || user.email.split('@')[0];
    const isSystemAdmin = user.role === SystemUserRoles.SYSTEM_ADMIN;

    return (
        <div class='relative z-50' ref={menuRef}>
            <button
                data-testid='user-menu-button'
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                class='flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-base border border-border-default/60 hover:border-interactive-primary/50 hover:bg-surface-raised transition-all duration-200 group shadow-md'
                aria-expanded={isOpen}
                aria-haspopup='true'
                aria-controls='user-dropdown-menu'
            >
                <div class='relative'>
                    <div class='w-9 h-9 bg-[image:var(--gradient-primary)] rounded-full flex items-center justify-center shadow-lg ring-2 ring-border-default/50 group-hover:ring-interactive-primary/40 transition-all'>
                        <span class='text-sm font-bold text-white'>{userInitial}</span>
                    </div>
                    <div class='absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-semantic-success rounded-full border-2 border-surface-base'></div>
                </div>
                <div class='hidden md:block text-left'>
                    <p class='text-sm font-medium text-text-primary group-hover:text-interactive-primary transition-colors' data-testid='user-menu-display-name'>{userName}</p>
                    <p class='text-xs text-text-muted'>{user.email}</p>
                </div>
                <svg
                    class={`hidden md:block w-4 h-4 text-text-muted group-hover:text-interactive-primary transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                    focusable='false'
                >
                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' />
                </svg>
            </button>

            {isOpen && (
                <div
                    id='user-dropdown-menu'
                    data-testid='user-dropdown-menu'
                    class='absolute right-0 mt-2 w-72 bg-surface-raised border border-border-default rounded-xl shadow-2xl z-[9999]'
                    role='menu'
                    aria-orientation='vertical'
                    aria-labelledby='user-menu-button'
                >
                    <div class='px-4 py-3 border-b border-border-default'>
                        <p class='text-sm font-semibold text-text-primary'>{userName}</p>
                        <p class='text-xs text-text-muted mt-0.5'>{user.email}</p>
                    </div>

                    <div class='py-2'>
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigationService.goToDashboard();
                            }}
                            class='flex items-center w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-interactive-primary/10 hover:text-interactive-primary transition-colors'
                            data-testid='user-menu-dashboard-link'
                            role='menuitem'
                        >
                            <svg class='w-4 h-4 mr-3 text-text-muted' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='2'
                                    d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
                                />
                            </svg>
                            {t('userMenu.dashboard')}
                        </button>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigationService.goToSettings();
                            }}
                            class='flex items-center w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-interactive-primary/10 hover:text-interactive-primary transition-colors'
                            data-testid='user-menu-settings-link'
                            role='menuitem'
                        >
                            <svg class='w-4 h-4 mr-3 text-text-muted' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path
                                    stroke-linecap='round'
                                    stroke-linejoin='round'
                                    stroke-width='2'
                                    d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                                />
                                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                            </svg>
                            {t('userMenu.settings')}
                        </button>
                    </div>

                    {isSystemAdmin && (
                        <>
                            <hr class='my-1 border-border-default' />

                            <div class='px-4 py-2'>
                                <p class='text-xs font-bold text-interactive-primary uppercase tracking-wider'>System Admin</p>
                            </div>

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigationService.goToAdmin();
                                }}
                                class='flex items-center w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-interactive-primary/10 hover:text-interactive-primary transition-colors'
                                data-testid='user-menu-admin-link'
                                role='menuitem'
                            >
                                <svg class='w-4 h-4 mr-3 text-text-muted' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                        stroke-linecap='round'
                                        stroke-linejoin='round'
                                        stroke-width='2'
                                        d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                                    />
                                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                                </svg>
                                Admin
                            </button>
                        </>
                    )}

                    <hr class='my-1 border-border-default' />

                    <button
                        data-testid='sign-out-button'
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                await authStore.logout();
                                // Force immediate redirect to login
                                navigationService.goToLogin();
                            } catch (error) {
                                // Error is already handled in authStore; log for observability only
                                logError('userMenu.logoutFailed', error, { userId: user.uid });
                            }
                        }}
                        class='flex items-center w-full text-left px-4 py-2.5 text-sm text-semantic-error hover:bg-semantic-error/10 transition-colors rounded-b-xl'
                        disabled={authStore.loading}
                        role='menuitem'
                    >
                        <svg class='w-4 h-4 mr-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
                        </svg>
                        {authStore.loading ? t('userMenu.signingOut') : t('userMenu.signOut')}
                    </button>
                </div>
            )}
        </div>
    );
}
