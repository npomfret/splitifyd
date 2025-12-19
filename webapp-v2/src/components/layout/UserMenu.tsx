import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { useClickOutside } from '@/app/hooks/useClickOutside';
import { ChevronDownIcon, HomeIcon, LogoutIcon, SettingsIcon } from '@/components/ui/icons';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import { type SystemUserRole, SystemUserRoles } from '@billsplit-wl/shared';
import { useRef, useState } from 'preact/hooks';
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

    useClickOutside(menuRef, () => setIsOpen(false), { enabled: isOpen });

    const userInitial = user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();
    const userName = user.displayName || user.email.split('@')[0];
    const isSystemAdmin = user.role === SystemUserRoles.SYSTEM_ADMIN;

    return (
        <div className='relative z-50' ref={menuRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className='flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-base border border-border-default/60 hover:border-interactive-primary/50 hover:bg-surface-raised transition-all duration-200 group shadow-md'
                aria-label={t('navigation.userMenu.openUserMenu')}
                aria-expanded={isOpen}
                aria-haspopup='true'
                aria-controls='user-dropdown-menu'
            >
                <div className='relative'>
                    <div className='w-9 h-9 bg-(image:--gradient-primary) rounded-full flex items-center justify-center shadow-lg ring-2 ring-border-default/50 group-hover:ring-interactive-primary/40 transition-all'>
                        <span className='text-sm font-bold text-interactive-primary-foreground'>{userInitial}</span>
                    </div>
                    <div className='absolute -bottom-0.5 -end-0.5 w-3 h-3 bg-semantic-success rounded-full border-2 border-surface-base'></div>
                </div>
                <div className='hidden md:block text-start'>
                    <p className='text-sm font-medium text-text-primary group-hover:text-interactive-primary transition-colors' aria-label={t('navigation.userMenu.displayNameLabel')}>{userName}</p>
                    <p className='help-text-xs'>{user.email}</p>
                </div>
                <ChevronDownIcon
                    size={16}
                    className={`hidden md:block text-text-muted group-hover:text-interactive-primary transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div
                    id='user-dropdown-menu'
                    className='fixed inset-x-4 top-[4.5rem] sm:absolute sm:inset-x-auto sm:top-auto sm:end-0 sm:mt-2 sm:w-72 bg-surface-popover border border-border-default rounded-xl shadow-2xl z-9999'
                    role='menu'
                    aria-orientation='vertical'
                    aria-labelledby='user-menu-button'
                >
                    <div className='px-4 py-3 border-b border-border-default'>
                        <p className='text-sm font-semibold text-text-primary'>{userName}</p>
                        <p className='help-text-xs mt-0.5'>{user.email}</p>
                    </div>

                    <div className='py-2'>
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigationService.goToDashboard();
                            }}
                            className='flex items-center w-full text-start px-4 py-2.5 text-sm text-text-primary hover:bg-interactive-primary/10 hover:text-interactive-primary transition-colors'
                            role='menuitem'
                        >
                            <HomeIcon size={16} className='mr-3 text-text-muted' />
                            {t('userMenu.dashboard')}
                        </button>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigationService.goToSettings();
                            }}
                            className='flex items-center w-full text-start px-4 py-2.5 text-sm text-text-primary hover:bg-interactive-primary/10 hover:text-interactive-primary transition-colors'
                            role='menuitem'
                        >
                            <SettingsIcon size={16} className='mr-3 text-text-muted' />
                            {t('userMenu.settings')}
                        </button>
                    </div>

                    {isSystemAdmin && (
                        <>
                            <hr className='my-1 border-border-default' />

                            <div className='px-4 py-2'>
                                <p className='text-xs font-bold text-interactive-primary uppercase tracking-wider'>{t('userMenu.systemAdminLabel')}</p>
                            </div>

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigationService.goToAdmin();
                                }}
                                className='flex items-center w-full text-start px-4 py-2.5 text-sm text-text-primary hover:bg-interactive-primary/10 hover:text-interactive-primary transition-colors'
                                role='menuitem'
                            >
                                <SettingsIcon size={16} className='mr-3 text-text-muted' />
                                {t('userMenu.admin')}
                            </button>
                        </>
                    )}

                    <hr className='my-1 border-border-default' />

                    <button
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
                        className='flex items-center w-full text-start px-4 py-2.5 text-sm text-semantic-error hover:bg-semantic-error/10 transition-colors rounded-b-xl'
                        disabled={authStore.loading}
                        role='menuitem'
                    >
                        <LogoutIcon size={16} className='mr-3' />
                        {authStore.loading ? t('userMenu.signingOut') : t('userMenu.signOut')}
                    </button>
                </div>
            )}
        </div>
    );
}
