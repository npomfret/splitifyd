import { ComponentChildren } from 'preact';
import Router from 'preact-router';

// Helper to test components with router context
export function renderWithRouter(component: ComponentChildren, initialUrl = '/') {
  // Set the initial URL
  window.history.replaceState({}, '', initialUrl);
  
  return component;
}

// Mock router for testing
export const MockRouter = ({ children }: { children: ComponentChildren }) => {
  return (
    <Router>
      {children}
    </Router>
  );
};