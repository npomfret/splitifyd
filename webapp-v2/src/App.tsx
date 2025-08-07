import Router, { Route } from 'preact-router';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import GroupDetailPage from './pages/GroupDetailPage';
import AddExpensePage from './pages/AddExpensePage';
import ExpenseDetailPage from './pages/ExpenseDetailPage';
import { PricingPage } from './pages/static/PricingPage';
import { TermsOfServicePage } from './pages/static/TermsOfServicePage';
import { PrivacyPolicyPage } from './pages/static/PrivacyPolicyPage';
import { CookiePolicyPage } from './pages/static/CookiePolicyPage';
import { JoinGroupPage } from './pages/JoinGroupPage';

export function App() {
  return (
    <Router>
      <Route path="/" component={LandingPage} />
      
      {/* Auth Routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Dashboard Routes */}
      <Route path="/dashboard" component={DashboardPage} />
      
      {/* Group Routes */}
      <Route path="/groups/:id" component={GroupDetailPage} />
      <Route path="/group/:id" component={GroupDetailPage} />
      
      {/* Add Expense Route */}
      <Route path="/groups/:groupId/add-expense" component={AddExpensePage} />
      
      {/* Expense Detail Route */}
      <Route path="/groups/:groupId/expenses/:expenseId" component={ExpenseDetailPage} />
      
      {/* Join Group Route */}
      <Route path="/join" component={JoinGroupPage} />
      
      {/* Static Pages */}
      <Route path="/pricing" component={PricingPage} />
      <Route path="/terms-of-service" component={TermsOfServicePage} />
      <Route path="/terms" component={TermsOfServicePage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/cookies-policy" component={CookiePolicyPage} />
      <Route path="/cookies" component={CookiePolicyPage} />
      
      <Route default component={NotFoundPage} />
    </Router>
  );
}
