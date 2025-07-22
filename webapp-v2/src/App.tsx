import Router, { Route } from 'preact-router';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  // In production, we're served at /v2/ so we need to handle that prefix
  const prefix = import.meta.env.PROD ? '/v2' : '';
  
  return (
    <Router>
      <Route path={`${prefix}/`} component={HomePage} />
      <Route path="/" component={HomePage} />
      <Route default component={NotFoundPage} />
    </Router>
  );
}