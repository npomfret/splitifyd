import { useAuth } from '@/app/hooks/useAuth.ts';
import { Button } from '@/components/ui/Button';
import { Clickable } from '@/components/ui/Clickable';
import { HomeIcon } from '@/components/ui/icons';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
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
    const brandingTokens = config?.tenant?.brandingTokens?.tokens;
    const logoUrl = brandingTokens?.assets?.logoUrl ?? null;
    const appName = brandingTokens?.legal?.appName ?? t('header.logoAlt');
    const showAppName = branding?.showAppNameInHeader !== false;

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
                <div className='flex items-center gap-4'>
                    <Suspense fallback={<div>...</div>}>
                        <UserMenu user={user.value} />
                    </Suspense>
                </div>
            );
        }

        return (
            <div className='flex items-center gap-4'>
                <LanguageSwitcher variant='compact' />
                <Button
                    onClick={() => navigation.goToLogin()}
                    variant='ghost'
                >
                    {t('header.login')}
                </Button>
                <Button
                    onClick={() => navigation.goToRegister()}
                    variant='primary'
                >
                    {t('header.signUp')}
                </Button>
            </div>
        );
    };

    return (
        <header className='border-b border-border-subtle sticky top-0 z-50 bg-surface-raised'>
            <div className='max-w-7xl mx-auto px-4'>
                <nav className='flex items-center justify-between h-16 relative'>
                    <div className='flex items-center space-x-8'>
                        <div className='flex items-center gap-3'>
                            <Clickable
                                onClick={() => (isAuthenticated.value ? navigation.goToDashboard() : navigation.goHome())}
                                className='cursor-pointer'
                                aria-label={t('header.goToHome')}
                                title={t('header.goToHome')}
                                eventName='header_logo_click'
                                eventProps={{ destination: isAuthenticated.value ? 'dashboard' : 'home' }}
                            >
                                {logoUrl ? <img src={logoUrl} alt={appName} className='h-8' /> : <HomeIcon size={32} className='text-text-primary' />}
                            </Clickable>
                            {showAppName && (
                                <span className='text-text-primary font-semibold leading-6 whitespace-nowrap'>
                                    {appName}
                                </span>
                            )}
                        </div>
                        {getNavLinks()}
                    </div>
                    {getAuthSection()}
                </nav>
            </div>
        </header>
    );
}
