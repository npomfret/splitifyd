import Router, { Route } from 'preact-router';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Router>
      <Route path="/" component={HomePage} />
      <Route default component={NotFoundPage} />
    </Router>
  );
}