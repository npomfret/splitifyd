import Router, { Route } from 'preact-router';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { PricingPage } from './pages/static/PricingPage';
import { TermsOfServicePage } from './pages/static/TermsOfServicePage';
import { PrivacyPolicyPage } from './pages/static/PrivacyPolicyPage';
import { CookiePolicyPage } from './pages/static/CookiePolicyPage';

export function App() {
  // In production, we're served at /v2/ so we need to handle that prefix
  const prefix = import.meta.env.PROD ? '/v2' : '';
  
  return (
    <Router>
      <Route path={`${prefix}/`} component={LandingPage} />
      <Route path="/" component={LandingPage} />
      
      {/* Auth Routes */}
      <Route path={`${prefix}/login`} component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      <Route path={`${prefix}/register`} component={RegisterPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path={`${prefix}/reset-password`} component={ResetPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Dashboard Routes */}
      <Route path={`${prefix}/dashboard`} component={DashboardPage} />
      <Route path="/dashboard" component={DashboardPage} />
      
      {/* Static Pages */}
      <Route path={`${prefix}/pricing`} component={PricingPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path={`${prefix}/terms-of-service`} component={TermsOfServicePage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path={`${prefix}/privacy-policy`} component={PrivacyPolicyPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path={`${prefix}/cookies-policy`} component={CookiePolicyPage} />
      <Route path="/cookies-policy" component={CookiePolicyPage} />
      
      <Route default component={NotFoundPage} />
    </Router>
  );
}