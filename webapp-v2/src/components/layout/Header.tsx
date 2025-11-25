import { useAuth } from '@/app/hooks/useAuth.ts';
import { Button } from '@/components/ui/Button';
import { Clickable } from '@/components/ui/Clickable';
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
                <Button
                    onClick={() => navigation.goToLogin()}
                    variant='ghost'
                    data-testid='header-login-link'
                >
                    {t('header.login')}
                </Button>
                <Button
                    onClick={() => navigation.goToRegister()}
                    variant='primary'
                    data-testid='header-signup-link'
                >
                    {t('header.signUp')}
                </Button>
            </div>
        );
    };

    return (
        <header class='border-b border-border-subtle sticky top-0 z-50 bg-surface-raised'>
            <div class='max-w-7xl mx-auto px-4'>
                <nav class='flex items-center justify-between h-16 relative'>
                    <div class='flex items-center space-x-8'>
                        <Clickable
                            onClick={() => (isAuthenticated.value ? navigation.goToDashboard() : navigation.goHome())}
                            className='flex items-center gap-3'
                            data-testid='header-logo-link'
                            aria-label={appName}
                            eventName='header_logo_click'
                            eventProps={{ destination: isAuthenticated.value ? 'dashboard' : 'home' }}
                        >
                            <img src={logoUrl} alt={appName} class='h-8' />
                            <span class='text-text-primary font-semibold leading-6 whitespace-nowrap'>
                                {appName}
                            </span>
                        </Clickable>
                        {getNavLinks()}
                    </div>
                    {getAuthSection()}
                </nav>
            </div>
        </header>
    );
}
