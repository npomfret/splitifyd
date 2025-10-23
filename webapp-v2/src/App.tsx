import Router, { Route } from 'preact-router';
import { lazy, Suspense } from 'preact/compat';
import { useTranslation } from 'react-i18next';
import { useAuth } from './app/hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PolicyAcceptanceModal } from './components/policy/PolicyAcceptanceModal';
import { LoadingState, WarningBanner } from './components/ui';
import { TokenRefreshIndicator } from './components/auth/TokenRefreshIndicator';
import { usePolicyAcceptance } from './hooks/usePolicyAcceptance';
import { navigationService } from './services/navigation.service';

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

// Wrapper component to handle Suspense for lazy-loaded components
function LazyRoute({ component: Component, ...props }: any) {
    const { t } = useTranslation();
    return (
        <Suspense fallback={<LoadingState fullPage message={t('app.loadingPage')} />}>
            <Component {...props} />
        </Suspense>
    );
}

// Auth guard wrapper for protected routes
function ProtectedRoute({ component: Component, ...props }: any) {
    const { t } = useTranslation();
    const authStore = useAuth();

    // Handle SSG case where useAuth returns null
    if (!authStore) {
        return <LoadingState fullPage message={t('app.loading')} />;
    }

    // Wait for auth initialization
    if (!authStore.initialized) {
        return <LoadingState fullPage message={t('app.loading')} />;
    }

    // Redirect to login if not authenticated (declarative approach)
    if (authStore.initialized && !authStore.user) {
        // Store current URL for redirect after login
        const locationRef = (globalThis as Record<string, any>).location as Location | undefined;
        const pathname = locationRef?.pathname ?? '';
        const search = locationRef?.search ?? '';
        const currentUrl = `${pathname}${search}`;
        navigationService.goToLogin(currentUrl.length > 0 ? currentUrl : undefined);
        return null;
    }

    return (
        <Suspense fallback={<LoadingState fullPage message={t('app.loadingPage')} />}>
            <Component {...props} />
        </Suspense>
    );
}

export function App() {
    const authStore = useAuth();
    const { needsAcceptance, pendingPolicies, refreshPolicyStatus } = usePolicyAcceptance();

    const user = authStore?.user;

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
                <Route path='/' component={(props: any) => <LazyRoute component={LandingPage} {...props} />} />

                {/* Auth Routes */}
                <Route path='/login' component={(props: any) => <LazyRoute component={LoginPage} {...props} />} />
                <Route path='/register' component={(props: any) => <LazyRoute component={RegisterPage} {...props} />} />
                <Route path='/reset-password' component={(props: any) => <LazyRoute component={ResetPasswordPage} {...props} />} />

                {/* Dashboard Routes - Protected */}
                <Route path='/dashboard' component={(props: any) => <ProtectedRoute component={DashboardPage} {...props} />} />

                {/* Settings Routes - Protected */}
                <Route path='/settings' component={(props: any) => <ProtectedRoute component={SettingsPage} {...props} />} />

                {/* Group Routes - Protected */}
                <Route path='/groups/:id' component={(props: any) => <ProtectedRoute component={GroupDetailPage} {...props} />} />
                <Route path='/group/:id' component={(props: any) => <ProtectedRoute component={GroupDetailPage} {...props} />} />

                {/* Add Expense Route - Protected */}
                <Route path='/groups/:groupId/add-expense' component={(props: any) => <ProtectedRoute component={AddExpensePage} {...props} />} />

                {/* Expense Detail Route - Protected */}
                <Route path='/groups/:groupId/expenses/:expenseId' component={(props: any) => <ProtectedRoute component={ExpenseDetailPage} {...props} />} />

                {/* Join Group Route - Protected */}
                <Route path='/join' component={(props: any) => <ProtectedRoute component={JoinGroupPage} {...props} />} />

                {/* Static Pages */}
                <Route path='/pricing' component={(props: any) => <LazyRoute component={PricingPage} {...props} />} />
                <Route path='/terms-of-service' component={(props: any) => <LazyRoute component={TermsOfServicePage} {...props} />} />
                <Route path='/terms' component={(props: any) => <LazyRoute component={TermsOfServicePage} {...props} />} />
                <Route path='/privacy-policy' component={(props: any) => <LazyRoute component={PrivacyPolicyPage} {...props} />} />
                <Route path='/privacy' component={(props: any) => <LazyRoute component={PrivacyPolicyPage} {...props} />} />
                <Route path='/cookies-policy' component={(props: any) => <LazyRoute component={CookiePolicyPage} {...props} />} />
                <Route path='/cookies' component={(props: any) => <LazyRoute component={CookiePolicyPage} {...props} />} />

                {/* Explicit 404 route */}
                <Route path='/404' component={(props: any) => <LazyRoute component={NotFoundPage} {...props} />} />

                <Route default component={(props: any) => <LazyRoute component={NotFoundPage} {...props} />} />
            </Router>

            {/* Policy Acceptance Modal - shows when user has pending policy acceptances */}
            {shouldShowPolicyModal && <PolicyAcceptanceModal policies={pendingPolicies} onAccept={handlePolicyAcceptance} />}
        </ErrorBoundary>
    );
}
