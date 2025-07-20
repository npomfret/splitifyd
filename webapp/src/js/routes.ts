/**
 * Centralized route constants for the application.
 * 
 * Usage in TypeScript files:
 * ```typescript
 * import { ROUTES } from './routes.js';
 * window.location.href = ROUTES.DASHBOARD;
 * ```
 * 
 * Note: HTML files cannot import TypeScript modules, so they must continue
 * to use hardcoded paths. When updating routes, ensure to update both:
 * 1. This ROUTES object for TypeScript files
 * 2. Any hardcoded links in HTML files
 * 
 * HTML files with hardcoded links:
 * - index.html: Contains links to /login.html
 * - pricing.html: Contains links to /login.html
 * - dashboard.html: Contains logo link to dashboard.html
 * - group-detail.html: Contains logo link to dashboard.html
 * - expense-detail.html: Contains logo link to dashboard.html
 */
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard.html',
  LOGIN: '/login.html',
  REGISTER: '/register.html',
  RESET_PASSWORD: '/reset-password.html',
  GROUP_DETAIL: '/group-detail.html',
  ADD_EXPENSE: '/add-expense.html',
  EXPENSE_DETAIL: '/expense-detail.html',
  JOIN_GROUP: '/join-group.html',
  PRICING: '/pricing.html',
  PRIVACY_POLICY: '/privacy-policy.html',
  TERMS_OF_SERVICE: '/terms-of-service.html',
  COOKIES_POLICY: '/cookies-policy.html'
} as const;