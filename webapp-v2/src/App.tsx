import Router, { Route } from 'preact-router';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PricingPage } from './pages/static/PricingPage';
import { TermsOfServicePage } from './pages/static/TermsOfServicePage';
import { PrivacyPolicyPage } from './pages/static/PrivacyPolicyPage';
import { CookiePolicyPage } from './pages/static/CookiePolicyPage';

export function App() {
  // In production, we're served at /v2/ so we need to handle that prefix
  const prefix = import.meta.env.PROD ? '/v2' : '';
  
  return (
    <Router>
      <Route path={`${prefix}/`} component={HomePage} />
      <Route path="/" component={HomePage} />
      
      {/* Auth Routes */}
      <Route path={`${prefix}/login`} component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      <Route path={`${prefix}/register`} component={RegisterPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path={`${prefix}/reset-password`} component={ResetPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Static Pages */}
      <Route path={`${prefix}/pricing`} component={PricingPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path={`${prefix}/terms`} component={TermsOfServicePage} />
      <Route path="/terms" component={TermsOfServicePage} />
      <Route path={`${prefix}/privacy`} component={PrivacyPolicyPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path={`${prefix}/cookies`} component={CookiePolicyPage} />
      <Route path="/cookies" component={CookiePolicyPage} />
      
      <Route default component={NotFoundPage} />
    </Router>
  );
}