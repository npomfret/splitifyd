import { route } from 'preact-router';
import { ROUTES, routes } from '@/constants/routes';
import { logUserAction } from '@/utils/browser-logger';

/**
 * Centralized navigation service for consistent routing throughout the application.
 *
 * Key principles:
 * - Use programmatic navigation (route()) for all internal links
 * - Provide type-safe navigation methods
 * - Centralize navigation logging and tracking
 * - Support query parameters and navigation options
 */
class NavigationService {
    private currentPath: string = '';

    constructor() {
        // Initialize current path tracking
        this.currentPath = window.location.pathname;

        // Set up event-based navigation tracking (replaces polling)
        this.setupNavigationTracking();
    }

    /**
     * Navigate to a specific route with optional query parameters
     * Returns a Promise that resolves when navigation is complete
     */
    navigateTo(path: string, options: { replace?: boolean; queryParams?: Record<string, string> } = {}): Promise<void> {
        const { replace = false, queryParams } = options;

        // Build full URL with query parameters
        let fullPath = path;
        if (queryParams && Object.keys(queryParams).length > 0) {
            const searchParams = new URLSearchParams(queryParams);
            fullPath = `${path}?${searchParams.toString()}`;
        }

        // Log navigation action
        this.logNavigation('Programmatic Navigation', {
            from: window.location.pathname,
            to: fullPath,
            method: replace ? 'replace' : 'push',
        });

        // Perform navigation and return Promise that resolves when complete
        return new Promise((resolve) => {
            // Perform the navigation
            route(fullPath, replace);

            // Wait for the URL to actually change before resolving
            const checkNavigation = () => {
                if (window.location.pathname === path ||
                    window.location.href.split('?')[0].endsWith(path)) {
                    resolve();
                } else {
                    // Check again on next tick
                    setTimeout(checkNavigation, 0);
                }
            };

            // Start checking on next tick to allow route() to complete
            setTimeout(checkNavigation, 0);
        });
    }

    /**
     * Navigate to home/landing page
     */
    goHome(): Promise<void> {
        return this.navigateTo(ROUTES.HOME);
    }

    /**
     * Navigate to dashboard
     */
    goToDashboard(): Promise<void> {
        return this.navigateTo(ROUTES.DASHBOARD);
    }

    /**
     * Navigate to login with optional return URL
     */
    goToLogin(returnUrl?: string): Promise<void> {
        if (returnUrl) {
            return this.navigateTo(routes.loginWithReturnUrl(returnUrl));
        } else {
            return this.navigateTo(ROUTES.LOGIN);
        }
    }

    /**
     * Navigate to register page
     */
    goToRegister(): Promise<void> {
        return this.navigateTo(ROUTES.REGISTER);
    }

    /**
     * Navigate to reset password page
     */
    goToResetPassword(): Promise<void> {
        return this.navigateTo(ROUTES.RESET_PASSWORD);
    }

    /**
     * Navigate to settings page
     */
    goToSettings(): Promise<void> {
        return this.navigateTo(ROUTES.SETTINGS);
    }

    /**
     * Navigate to group detail page
     */
    goToGroup(groupId: string): Promise<void> {
        return this.navigateTo(routes.groupDetail(groupId));
    }

    /**
     * Navigate to add expense page
     */
    goToAddExpense(groupId: string): Promise<void> {
        return this.navigateTo(routes.addExpense(groupId));
    }

    /**
     * Navigate to edit expense page
     */
    goToEditExpense(groupId: string, expenseId: string): Promise<void> {
        return this.navigateTo(routes.editExpense(groupId, expenseId));
    }

    /**
     * Navigate to copy expense page
     */
    goToCopyExpense(groupId: string, sourceId: string): Promise<void> {
        return this.navigateTo(routes.copyExpense(groupId, sourceId));
    }

    /**
     * Navigate to expense detail page
     */
    goToExpenseDetail(groupId: string, expenseId: string): Promise<void> {
        return this.navigateTo(routes.expenseDetail(groupId, expenseId));
    }

    /**
     * Navigate to static pages
     */
    goToPricing(): Promise<void> {
        return this.navigateTo(ROUTES.PRICING);
    }

    goToTerms(): Promise<void> {
        return this.navigateTo(ROUTES.TERMS_OF_SERVICE);
    }

    goToPrivacyPolicy(): Promise<void> {
        return this.navigateTo(ROUTES.PRIVACY_POLICY);
    }

    goToCookiePolicy(): Promise<void> {
        return this.navigateTo(ROUTES.COOKIE_POLICY);
    }

    /**
     * Navigate to 404 page
     */
    goToNotFound(): Promise<void> {
        return this.navigateTo(ROUTES.NOT_FOUND);
    }

    /**
     * Setup event-based navigation tracking to replace polling
     */
    private setupNavigationTracking(): void {
        // Track popstate events (back/forward navigation)
        window.addEventListener('popstate', () => {
            this.handleNavigationChange('popstate');
        });

        // Override pushState and replaceState to track programmatic navigation
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            // Delay slightly to ensure URL has updated
            setTimeout(() => this.handleNavigationChange('pushstate'), 0);
        };

        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            setTimeout(() => this.handleNavigationChange('replacestate'), 0);
        };
    }

    /**
     * Handle navigation change events
     */
    private handleNavigationChange(method: string): void {
        const newPath = window.location.pathname;
        if (newPath !== this.currentPath) {
            this.logNavigation('Navigation Change', {
                from: this.currentPath,
                to: newPath,
                method,
                type: 'spa-navigation',
            });
            this.currentPath = newPath;
        }
    }

    /**
     * Log navigation events for audit trail
     */
    private logNavigation(action: string, details: Record<string, any>): void {
        logUserAction(action, {
            ...details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.substring(0, 100), // Truncated for privacy
        });
    }
}

// Export singleton instance
export const navigationService = new NavigationService();
