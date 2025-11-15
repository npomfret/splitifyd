import { useAuth } from '@/app/hooks/useAuth.ts';
import { useConfig } from '@/hooks/useConfig.ts';
import { useNavigation } from '@/hooks/useNavigation';
import { useComputed } from '@preact/signals';
import { lazy, Suspense } from 'preact/compat';
import { useTranslation } from 'react-i18next';

// Lazy load UserMenu to avoid SSG issues
const UserMenu = lazy(() => import('./UserMenu').then((m) => ({ default: m.UserMenu })));

interface HeaderProps {
    variant?: 'default' | 'minimal' | 'dashboard';
    showAuth?: boolean;
}

export function Header({ variant = 'default', showAuth = true }: HeaderProps) {
    const { t } = useTranslation();
    const authStore = useAuth();
    const config = useConfig();
    const user = useComputed(() => authStore?.user || null);
    const isAuthenticated = useComputed(() => !!user.value);
    const navigation = useNavigation();
    const branding = config?.tenant?.branding ?? null;
    const logoUrl = branding?.logoUrl ?? '/images/logo.svg';
    const appName = branding?.appName ?? t('header.logoAlt');

    const getNavLinks = () => {
        if (variant === 'minimal') {
            return null;
        }

        // No nav links needed - everything goes in footer
        return null;
    };

    const getAuthSection = () => {
        if (!showAuth) return null;

        if (isAuthenticated.value && user.value) {
            return (
                <div class='flex items-center gap-4'>
                    <Suspense fallback={<div>...</div>}>
                        <UserMenu user={user.value} />
                    </Suspense>
                </div>
            );
        }

        return (
            <div class='flex items-center gap-4'>
                <button onClick={() => navigation.goToLogin()} class='px-4 py-2 rounded-lg text-text-primary border border-border-default hover:bg-surface-muted transition-colors' data-testid='header-login-link'>
                    {t('header.login')}
                </button>
                <button onClick={() => navigation.goToRegister()} class='bg-interactive-primary text-interactive-primary-foreground px-4 py-2 rounded-lg hover:bg-interactive-primary/90 transition-colors' data-testid='header-signup-link'>
                    {t('header.signUp')}
                </button>
            </div>
        );
    };

    return (
        <header class='border-b border-border-subtle backdrop-blur-sm sticky top-0 z-50' style='background: rgba(var(--surface-base-rgb), 0.7);'>
            <div class='max-w-7xl mx-auto px-4'>
                <nav class='flex items-center justify-between h-16 relative'>
                    <div class='flex items-center space-x-8'>
                        <button
                            onClick={() => (isAuthenticated.value ? navigation.goToDashboard() : navigation.goHome())}
                            class='flex items-center'
                            data-testid='header-logo-link'
                            aria-label={appName}
                        >
                            <img src={logoUrl} alt={appName} class='h-8' />
                        </button>
                        {getNavLinks()}
                    </div>
                    {getAuthSection()}
                </nav>
            </div>
        </header>
    );
}
