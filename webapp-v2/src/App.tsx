import type { ComponentProps, ComponentType, FunctionalComponent, VNode } from 'preact';
import Router, { Route } from 'preact-router';
import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuth } from './app/hooks/useAuth';
import { useConfig } from './hooks/useConfig.ts';
import { TokenRefreshIndicator } from './components/auth/TokenRefreshIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PolicyAcceptanceModal } from './components/policy/PolicyAcceptanceModal';
import { LoadingState, WarningBanner } from './components/ui';
import { usePolicyAcceptance } from './hooks/usePolicyAcceptance';
import { navigationService } from './services/navigation.service';
import { FeatureGate } from './utils/feature-flags.ts';

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
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'));
const AddExpensePage = lazy(() => import('./pages/AddExpensePage'));
const ExpenseDetailPage = lazy(() => import('./pages/ExpenseDetailPage'));
const PricingPage = lazy(() => import('./pages/static/PricingPage').then((m) => ({ default: m.PricingPage })));
const TermsOfServicePage = lazy(() => import('./pages/static/TermsOfServicePage').then((m) => ({ default: m.TermsOfServicePage })));
const PrivacyPolicyPage = lazy(() => import('./pages/static/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const CookiePolicyPage = lazy(() => import('./pages/static/CookiePolicyPage').then((m) => ({ default: m.CookiePolicyPage })));
const JoinGroupPage = lazy(() => import('./pages/JoinGroupPage').then((m) => ({ default: m.JoinGroupPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const UsersBrowserPage = lazy(() => import('./pages/browser/UsersBrowserPage').then((m) => ({ default: m.UsersBrowserPage })));

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

const LandingRoute = createLazyRoute(LandingPage);
const NotFoundRoute = createLazyRoute(NotFoundPage);
const LoginRoute = createLazyRoute(LoginPage);
const RegisterRoute = createLazyRoute(RegisterPage);
const ResetPasswordRoute = createLazyRoute(ResetPasswordPage);
const DashboardRoute = createProtectedRoute(DashboardPage);
const GroupDetailRoute = createProtectedRoute(GroupDetailPage);
const AddExpenseRoute = createProtectedRoute(AddExpensePage);
const ExpenseDetailRoute = createProtectedRoute(ExpenseDetailPage);
const PricingRoute = createLazyRoute(PricingPage);
const TermsRoute = createLazyRoute(TermsOfServicePage);
const PrivacyRoute = createLazyRoute(PrivacyPolicyPage);
const CookieRoute = createLazyRoute(CookiePolicyPage);
const JoinGroupRoute = createProtectedRoute(JoinGroupPage);
const SettingsRoute = createProtectedRoute(SettingsPage);
const UsersBrowserRoute = createProtectedRoute(UsersBrowserPage);

export function App() {
    const authStore = useAuth();
    const { needsAcceptance, pendingPolicies, refreshPolicyStatus } = usePolicyAcceptance();
    const config = useConfig();

    const user = authStore?.user;
    const marketingFlags = config?.tenant?.branding?.marketingFlags;
    const showLandingPage = marketingFlags?.showLandingPage ?? true;
    const showPricingPage = marketingFlags?.showPricingPage ?? false;

    const handlePolicyAcceptance = async () => {
        // Refresh policy status after acceptance to hide the modal
        await refreshPolicyStatus();
    };

    // Only show policy modal for authenticated users who need acceptance
    const shouldShowPolicyModal = user && needsAcceptance && pendingPolicies.length > 0;

    return (
        <ErrorBoundary>
            <WarningBanner />
            <TokenRefreshIndicator />
            <Router>
                <Route path='/' component={showLandingPage ? LandingRoute : user ? DashboardRoute : LoginRoute} />

                {/* Auth Routes */}
                <Route path='/login' component={LoginRoute} />
                <Route path='/register' component={RegisterRoute} />
                <Route path='/reset-password' component={ResetPasswordRoute} />

                {/* Dashboard Routes - Protected */}
                <Route path='/dashboard' component={DashboardRoute} />

                {/* Settings Routes - Protected */}
                <Route path='/settings' component={SettingsRoute} />

                {/* Browser Routes - Protected */}
                <FeatureGate feature='enableAdvancedReporting' defaultValue>
                    <Route path='/browser/users' component={UsersBrowserRoute} />
                </FeatureGate>

                {/* Group Routes - Protected */}
                <Route path='/groups/:id' component={GroupDetailRoute} />

                {/* Add Expense Route - Protected */}
                <Route path='/groups/:groupId/add-expense' component={AddExpenseRoute} />

                {/* Expense Detail Route - Protected */}
                <Route path='/groups/:groupId/expenses/:expenseId' component={ExpenseDetailRoute} />

                {/* Join Group Route - Protected */}
                <Route path='/join' component={JoinGroupRoute} />

                {/* Static Pages */}
                {showPricingPage && <Route path='/pricing' component={PricingRoute} />}
                <Route path='/terms-of-service' component={TermsRoute} />
                <Route path='/terms' component={TermsRoute} />
                <Route path='/privacy-policy' component={PrivacyRoute} />
                <Route path='/privacy' component={PrivacyRoute} />
                <Route path='/cookies-policy' component={CookieRoute} />
                <Route path='/cookies' component={CookieRoute} />

                {/* Explicit 404 route */}
                <Route path='/404' component={NotFoundRoute} />

                <Route default component={NotFoundRoute} />
            </Router>

            {/* Policy Acceptance Modal - shows when user has pending policy acceptances */}
            {shouldShowPolicyModal && <PolicyAcceptanceModal policies={pendingPolicies} onAccept={handlePolicyAcceptance} />}
        </ErrorBoundary>
    );
}
