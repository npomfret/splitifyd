import Router, { Route } from 'preact-router';
import { Suspense, lazy } from 'preact/compat';
import { LoadingState } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded page components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'));
const AddExpensePage = lazy(() => import('./pages/AddExpensePage'));
const ExpenseDetailPage = lazy(() => import('./pages/ExpenseDetailPage'));
const PricingPage = lazy(() => import('./pages/static/PricingPage').then(m => ({ default: m.PricingPage })));
const TermsOfServicePage = lazy(() => import('./pages/static/TermsOfServicePage').then(m => ({ default: m.TermsOfServicePage })));
const PrivacyPolicyPage = lazy(() => import('./pages/static/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const CookiePolicyPage = lazy(() => import('./pages/static/CookiePolicyPage').then(m => ({ default: m.CookiePolicyPage })));
const JoinGroupPage = lazy(() => import('./pages/JoinGroupPage').then(m => ({ default: m.JoinGroupPage })));

// Wrapper component to handle Suspense for lazy-loaded components
function LazyRoute({ component: Component, ...props }: any) {
  return (
    <Suspense fallback={<LoadingState fullPage message="Loading page..." />}>
      <Component {...props} />
    </Suspense>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Route path="/" component={(props: any) => <LazyRoute component={LandingPage} {...props} />} />
        
        {/* Auth Routes */}
        <Route path="/login" component={(props: any) => <LazyRoute component={LoginPage} {...props} />} />
        <Route path="/register" component={(props: any) => <LazyRoute component={RegisterPage} {...props} />} />
        <Route path="/reset-password" component={(props: any) => <LazyRoute component={ResetPasswordPage} {...props} />} />
        
        {/* Dashboard Routes */}
        <Route path="/dashboard" component={(props: any) => <LazyRoute component={DashboardPage} {...props} />} />
        
        {/* Group Routes */}
        <Route path="/groups/:id" component={(props: any) => <LazyRoute component={GroupDetailPage} {...props} />} />
        <Route path="/group/:id" component={(props: any) => <LazyRoute component={GroupDetailPage} {...props} />} />
        
        {/* Add Expense Route */}
        <Route path="/groups/:groupId/add-expense" component={(props: any) => <LazyRoute component={AddExpensePage} {...props} />} />
        
        {/* Expense Detail Route */}
        <Route path="/groups/:groupId/expenses/:expenseId" component={(props: any) => <LazyRoute component={ExpenseDetailPage} {...props} />} />
        
        {/* Join Group Route */}
        <Route path="/join" component={(props: any) => <LazyRoute component={JoinGroupPage} {...props} />} />
        
        {/* Static Pages */}
        <Route path="/pricing" component={(props: any) => <LazyRoute component={PricingPage} {...props} />} />
        <Route path="/terms-of-service" component={(props: any) => <LazyRoute component={TermsOfServicePage} {...props} />} />
        <Route path="/terms" component={(props: any) => <LazyRoute component={TermsOfServicePage} {...props} />} />
        <Route path="/privacy-policy" component={(props: any) => <LazyRoute component={PrivacyPolicyPage} {...props} />} />
        <Route path="/privacy" component={(props: any) => <LazyRoute component={PrivacyPolicyPage} {...props} />} />
        <Route path="/cookies-policy" component={(props: any) => <LazyRoute component={CookiePolicyPage} {...props} />} />
        <Route path="/cookies" component={(props: any) => <LazyRoute component={CookiePolicyPage} {...props} />} />
        
        <Route default component={(props: any) => <LazyRoute component={NotFoundPage} {...props} />} />
      </Router>
    </ErrorBoundary>
  );
}