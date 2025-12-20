import type { ComponentProps, ComponentType, FunctionalComponent, VNode } from 'preact';
import Router, { Route } from 'preact-router';
import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuth } from './app/hooks/useAuth';
import { TokenRefreshIndicator } from './components/auth/TokenRefreshIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PolicyAcceptanceModal } from './components/policy/PolicyAcceptanceModal';
import { EmailVerificationBanner, LoadingState, WarningBanner } from './components/ui';
import { useConfig } from './hooks/useConfig.ts';
import { usePolicyAcceptance } from './hooks/usePolicyAcceptance';
import { navigationService } from './services/navigation.service';

type RouterInjectedProps = Partial<{
    matches: Record<string, string | undefined>;
    path: string;
    url: string;
    default: boolean;
}>;

type ComponentOwnProps<T extends ComponentType<any>> = Omit<ComponentProps<T>, 'children'>;
type LazyRouteProps<T extends ComponentType<any>> = ComponentOwnProps<T> & RouterInjectedProps & { component: T; };
type ProtectedRouteProps<T extends ComponentType<any>> = ComponentOwnProps<T> & RouterInjectedProps & { component: T; };

// Lazy-loaded page components for code splitting
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage })));
const JoinGroupPage = lazy(() => import('./pages/JoinGroupPage').then((m) => ({ default: m.JoinGroupPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const TenantBrandingPage = lazy(() => import('./pages/TenantBrandingPage').then((m) => ({ default: m.TenantBrandingPage })));

// Wrapper component to handle Suspense for lazy-loaded components
function LazyRoute<T extends ComponentType<any>>({ component: Component, ...props }: LazyRouteProps<T>): VNode {
    const { t } = useTranslation();
    const componentProps = props as unknown as ComponentProps<T>;

    return (
        <Suspense fallback={<LoadingState fullPage message={t('app.loadingPage')} />}>
            <Component {...componentProps} />
        </Suspense>
    );
}

// Auth guard wrapper for protected routes
function ProtectedRoute<T extends ComponentType<any>>({ component: Component, ...props }: ProtectedRouteProps<T>): VNode | null {
    const { t } = useTranslation();
    const authStore = useAuth();
    const componentProps = props as unknown as ComponentProps<T>;

    // Handle SSG case where useAuth returns null
    if (!authStore) {
        return <LoadingState fullPage message={t('app.loading')} />;
    }

    // Wait for auth initialization
    if (!authStore.initialized) {
        return <LoadingState fullPage message={t('app.loading')} />;
    }

    const shouldRedirectToLogin = authStore.initialized && !authStore.user;

    useEffect(() => {
        if (!shouldRedirectToLogin) {
            return;
        }

        const locationRef = (globalThis as Record<string, unknown>).location as Location | undefined;
        const pathname = locationRef?.pathname ?? '';
        const search = locationRef?.search ?? '';
        const currentUrl = `${pathname}${search}`;

        void navigationService.goToLogin(currentUrl.length > 0 ? currentUrl : undefined);
    }, [shouldRedirectToLogin]);

    if (shouldRedirectToLogin) {
        return <LoadingState fullPage message={t('app.loading')} />;
    }

    return (
        <Suspense fallback={<LoadingState fullPage message={t('app.loadingPage')} />}>
            <Component {...componentProps} />
        </Suspense>
    );
}

function createLazyRoute<T extends ComponentType<any>>(Component: T): FunctionalComponent<ComponentOwnProps<T> & RouterInjectedProps> {
    const WrappedComponent: FunctionalComponent<ComponentOwnProps<T> & RouterInjectedProps> = (routeProps) => <LazyRoute component={Component} {...routeProps} />;
    return WrappedComponent;
}

function createProtectedRoute<T extends ComponentType<any>>(Component: T): FunctionalComponent<ComponentOwnProps<T> & RouterInjectedProps> {
    const WrappedComponent: FunctionalComponent<ComponentOwnProps<T> & RouterInjectedProps> = (routeProps) => <ProtectedRoute component={Component} {...routeProps} />;
    return WrappedComponent;
}

const NotFoundRoute = createLazyRoute(NotFoundPage);
const LoginRoute = createLazyRoute(LoginPage);
const RegisterRoute = createLazyRoute(RegisterPage);
const ResetPasswordRoute = createLazyRoute(ResetPasswordPage);
const DashboardRoute = createProtectedRoute(DashboardPage);
const GroupDetailRoute = createProtectedRoute(GroupDetailPage);
const JoinGroupRoute = createProtectedRoute(JoinGroupPage);
const SettingsRoute = createProtectedRoute(SettingsPage);
const AdminRoute = createProtectedRoute(AdminPage);
const TenantBrandingRoute = createProtectedRoute(TenantBrandingPage);

function RootRedirect(): VNode | null {
    useEffect(() => {
        void navigationService.goToDashboard();
    }, []);
    return null;
}

export function App() {
    const authStore = useAuth();
    const { needsAcceptance, pendingPolicies, refreshPolicyStatus } = usePolicyAcceptance();
    const config = useConfig();
    const { i18n } = useTranslation();

    const user = authStore?.user;

    // Update document direction and language when language changes
    useEffect(() => {
        document.documentElement.dir = i18n.dir();
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    // Update document title when tenant config loads
    useEffect(() => {
        const appName = config?.tenant?.brandingTokens?.tokens?.legal?.appName;
        if (appName) {
            document.title = appName;
        }
    }, [config?.tenant?.brandingTokens?.tokens?.legal?.appName]);

    const handlePolicyAcceptance = async () => {
        // Refresh policy status after acceptance to hide the modal
        await refreshPolicyStatus();
    };

    // Only show policy modal for authenticated users who need acceptance
    const shouldShowPolicyModal = user && needsAcceptance && pendingPolicies.length > 0;

    return (
        <ErrorBoundary>
            <EmailVerificationBanner />
            <WarningBanner />
            <TokenRefreshIndicator />
            <Router>
                {/* Root redirects to dashboard (which redirects to login if needed) */}
                <Route path='/' component={RootRedirect} />

                {/* Auth Routes */}
                <Route path='/login' component={LoginRoute} />
                <Route path='/register' component={RegisterRoute} />
                <Route path='/reset-password' component={ResetPasswordRoute} />

                {/* Dashboard Routes - Protected */}
                <Route path='/dashboard' component={DashboardRoute} />

                {/* Settings Routes - Protected */}
                <Route path='/settings' component={SettingsRoute} />
                <Route path='/settings/tenant/branding' component={TenantBrandingRoute} />

                {/* Admin Routes - Protected (System Admin only) */}
                <Route path='/admin' component={AdminRoute} />

                {/* Group Routes - Protected */}
                <Route path='/groups/:id' component={GroupDetailRoute} />

                {/* Expense Routes - Protected (handled by GroupDetailPage via modal deep linking) */}
                <Route path='/groups/:id/add-expense' component={GroupDetailRoute} />
                <Route path='/groups/:id/expenses/:expenseId' component={GroupDetailRoute} />

                {/* Join Group Route - Protected */}
                <Route path='/join' component={JoinGroupRoute} />

                {/* Explicit 404 route */}
                <Route path='/404' component={NotFoundRoute} />

                <Route default component={NotFoundRoute} />
            </Router>

            {/* Policy Acceptance Modal - shows when user has pending policy acceptances */}
            {shouldShowPolicyModal && <PolicyAcceptanceModal policies={pendingPolicies} onAccept={handlePolicyAcceptance} />}
        </ErrorBoundary>
    );
}
