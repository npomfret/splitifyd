import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { Tooltip } from '@/components/ui/Tooltip.tsx';
import { navigationService } from '@/services/navigation.service';
import { type SystemUserRole, SystemUserRoles } from '@splitifyd/shared';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
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
            // Use capture phase and add delay to prevent race conditions
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside, true);
            }, 0);
            return () => document.removeEventListener('click', handleClickOutside, true);
        }
    }, [isOpen]);

    const userInitial = user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();

    const userName = user.displayName || user.email.split('@')[0];
    const isSystemUser = user.role === SystemUserRoles.SYSTEM_USER;
    const hasDiagnosticsAccess = user.role === SystemUserRoles.SYSTEM_USER || user.role === SystemUserRoles.SYSTEM_ADMIN;

    const openDiagnosticsWindow = (title: string, endpoint: string, heading: string, loadingMessage: string, errorLabel: string) => {
        if (typeof window === 'undefined') {
            return;
        }

        const diagnosticsWindow = window.open('about:blank', '_blank');

        if (!diagnosticsWindow) {
            console.error('Failed to open diagnostics window');
            return;
        }

        diagnosticsWindow.opener = null;

        let diagnosticsDocument: Document | null = null;

        const timestamp = new Date().toLocaleString();
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const darkModeClass = prefersDark ? ' class="dark-mode"' : '';

        try {
            diagnosticsDocument = diagnosticsWindow.document;
            if (!diagnosticsDocument) {
                throw new Error('Missing diagnostics document');
            }
            diagnosticsDocument.open('text/html', 'replace');
        } catch (error) {
            console.error('Unable to initialize diagnostics window', error);
            diagnosticsWindow.close();
            return;
        }

        diagnosticsDocument.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>${title}</title>
                <style>
                    :root {
                        color-scheme: light dark;
                    }
                    body {
                        margin: 0;
                        padding: 24px;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                        background-color: #f8fafc;
                        color: #0f172a;
                    }
                    body.dark-mode {
                        background-color: #0f172a;
                        color: #e2e8f0;
                    }
                    h1 {
                        margin: 0 0 12px;
                        font-size: 20px;
                    }
                    p {
                        margin: 0 0 16px;
                        font-size: 14px;
                        color: inherit;
                        opacity: 0.75;
                    }
                    pre {
                        background-color: rgba(15, 23, 42, 0.07);
                        padding: 16px;
                        border-radius: 8px;
                        overflow-x: auto;
                        white-space: pre;
                        font-size: 13px;
                        line-height: 1.5;
                        max-height: calc(100vh - 140px);
                    }
                    body.dark-mode pre {
                        background-color: rgba(226, 232, 240, 0.08);
                    }
                    .diagnostic-error {
                        color: #b91c1c;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body${darkModeClass}>
                <main>
                    <h1 id="diagnostic-heading">${heading}</h1>
                    <p id="diagnostic-subheading">${timestamp}</p>
                    <pre id="diagnostic-content">${loadingMessage}</pre>
                </main>
            </body>
            </html>
        `);

        diagnosticsDocument.close();

        try {
            const targetPath = endpoint === '/status' ? '/diagnostics/status' : '/diagnostics/env';
            diagnosticsWindow.history.replaceState(null, '', targetPath);
        } catch (error) {
            console.warn('Unable to update diagnostics window URL', error);
        }

        const headingElement = diagnosticsDocument.getElementById('diagnostic-heading');
        const subheadingElement = diagnosticsDocument.getElementById('diagnostic-subheading');
        const contentElement = diagnosticsDocument.getElementById('diagnostic-content') as HTMLPreElement | null;

        if (headingElement) {
            headingElement.textContent = heading;
        }

        if (subheadingElement) {
            subheadingElement.textContent = timestamp;
        }

        if (contentElement) {
            contentElement.textContent = loadingMessage;
            contentElement.classList.remove('diagnostic-error');
        }

        void (async () => {
            try {
                const token = await authStore.refreshAuthToken();
                const response = await fetch(`/api${endpoint}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                    credentials: 'omit',
                });

                if (diagnosticsWindow.closed) {
                    return;
                }

                if (!contentElement) {
                    return;
                }

                if (!response.ok) {
                    const errorBody = await response.text();
                    contentElement.textContent = `${errorLabel}\n${response.status} ${response.statusText}\n${errorBody}`;
                    contentElement.classList.add('diagnostic-error');
                    return;
                }

                const payload = await response.json();
                contentElement.textContent = JSON.stringify(payload, null, 2);
                contentElement.classList.remove('diagnostic-error');
            } catch (error) {
                if (diagnosticsWindow.closed) {
                    return;
                }
                if (!contentElement) {
                    return;
                }
                const message = error instanceof Error ? error.message : String(error);
                contentElement.textContent = `${errorLabel}\n${message}`;
                contentElement.classList.add('diagnostic-error');
            }
        })();
    };

    return (
        <div class='relative' ref={menuRef}>
            <button
                data-testid='user-menu-button'
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                class='flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors'
                aria-expanded={isOpen}
                aria-haspopup='true'
                aria-controls='user-dropdown-menu'
            >
                <div class='w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center'>
                    <span class='text-sm font-medium'>{userInitial}</span>
                </div>
                <div class='hidden sm:block text-left'>
                    <p class='text-sm font-medium text-gray-700' data-testid='user-menu-display-name'>{userName}</p>
                    <p class='text-xs text-gray-500'>{user.email}</p>
                    {isSystemUser && (
                        <Tooltip content={t('userMenu.systemUserTooltip')}>
                            <span class='mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700'>
                                {t('userMenu.systemUserBadge')}
                            </span>
                        </Tooltip>
                    )}
                </div>
                <svg class='w-4 h-4 text-gray-500' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' />
                </svg>
            </button>

            {isOpen && (
                <div
                    id='user-dropdown-menu'
                    data-testid='user-dropdown-menu'
                    class='absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50'
                    role='menu'
                    aria-orientation='vertical'
                    aria-labelledby='user-menu-button'
                >
                    <div class='px-4 py-2 border-b border-gray-100'>
                        <p class='text-sm font-medium text-gray-900'>{userName}</p>
                        <p class='text-xs text-gray-500'>{user.email}</p>
                        {isSystemUser && (
                            <Tooltip content={t('userMenu.systemUserTooltip')}>
                                <span class='mt-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700'>
                                    {t('userMenu.systemUserBadge')}
                                </span>
                            </Tooltip>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            navigationService.goToDashboard();
                        }}
                        class='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                        data-testid='user-menu-dashboard-link'
                        role='menuitem'
                    >
                        {t('userMenu.dashboard')}
                    </button>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            navigationService.goToSettings();
                        }}
                        class='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                        data-testid='user-menu-settings-link'
                        role='menuitem'
                    >
                        {t('userMenu.settings')}
                    </button>

                    {hasDiagnosticsAccess && (
                        <>
                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    setIsOpen(false);
                                    openDiagnosticsWindow(
                                        t('userMenu.statusLink'),
                                        '/status',
                                        t('userMenu.statusLink'),
                                        t('userMenu.diagnosticsLoading'),
                                        t('userMenu.diagnosticsError'),
                                    );
                                }}
                                class='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                                data-testid='user-menu-status-link'
                                role='menuitem'
                                type='button'
                            >
                                <span class='flex items-center justify-between'>
                                    <span>{t('userMenu.statusLink')}</span>
                                    <ArrowTopRightOnSquareIcon class='ml-2 h-4 w-4 text-gray-400' aria-hidden='true' />
                                </span>
                            </button>

                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    setIsOpen(false);
                                    openDiagnosticsWindow(
                                        t('userMenu.environmentLink'),
                                        '/env',
                                        t('userMenu.environmentLink'),
                                        t('userMenu.diagnosticsLoading'),
                                        t('userMenu.diagnosticsError'),
                                    );
                                }}
                                class='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                                data-testid='user-menu-environment-link'
                                role='menuitem'
                                type='button'
                            >
                                <span class='flex items-center justify-between'>
                                    <span>{t('userMenu.environmentLink')}</span>
                                    <ArrowTopRightOnSquareIcon class='ml-2 h-4 w-4 text-gray-400' aria-hidden='true' />
                                </span>
                            </button>
                        </>
                    )}

                    <hr class='my-1 border-gray-100' />

                    <button
                        data-testid='sign-out-button'
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                await authStore.logout();
                                // Force immediate redirect to login
                                navigationService.goToLogin();
                            } catch (error) {
                                // Error is already handled in authStore
                                console.error('Logout failed:', error);
                            }
                        }}
                        class='w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                        disabled={authStore.loading}
                        role='menuitem'
                    >
                        {authStore.loading ? t('userMenu.signingOut') : t('userMenu.signOut')}
                    </button>
                </div>
            )}
        </div>
    );
}
