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
     */
    navigateTo(path: string, options: { replace?: boolean; queryParams?: Record<string, string> } = {}): void {
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
            method: replace ? 'replace' : 'push'
        });

        // Perform navigation
        route(fullPath, replace);
    }

    /**
     * Navigate to home/landing page
     */
    goHome(): void {
        this.navigateTo(ROUTES.HOME);
    }

    /**
     * Navigate to dashboard
     */
    goToDashboard(): void {
        this.navigateTo(ROUTES.DASHBOARD);
    }

    /**
     * Navigate to login with optional return URL
     */
    goToLogin(returnUrl?: string): void {
        if (returnUrl) {
            this.navigateTo(routes.loginWithReturnUrl(returnUrl));
        } else {
            this.navigateTo(ROUTES.LOGIN);
        }
    }

    /**
     * Navigate to register page
     */
    goToRegister(): void {
        this.navigateTo(ROUTES.REGISTER);
    }

    /**
     * Navigate to reset password page
     */
    goToResetPassword(): void {
        this.navigateTo(ROUTES.RESET_PASSWORD);
    }

    /**
     * Navigate to settings page
     */
    goToSettings(): void {
        this.navigateTo(ROUTES.SETTINGS);
    }

    /**
     * Navigate to group detail page
     */
    goToGroup(groupId: string): void {
        this.navigateTo(routes.groupDetail(groupId));
    }

    /**
     * Navigate to add expense page
     */
    goToAddExpense(groupId: string): void {
        this.navigateTo(routes.addExpense(groupId));
    }

    /**
     * Navigate to edit expense page
     */
    goToEditExpense(groupId: string, expenseId: string): void {
        this.navigateTo(routes.editExpense(groupId, expenseId));
    }

    /**
     * Navigate to copy expense page
     */
    goToCopyExpense(groupId: string, sourceId: string): void {
        this.navigateTo(routes.copyExpense(groupId, sourceId));
    }

    /**
     * Navigate to expense detail page
     */
    goToExpenseDetail(groupId: string, expenseId: string): void {
        this.navigateTo(routes.expenseDetail(groupId, expenseId));
    }

    /**
     * Navigate to join group page
     */
    goToJoinGroup(): void {
        this.navigateTo(ROUTES.JOIN_GROUP);
    }

    /**
     * Navigate to static pages
     */
    goToPricing(): void {
        this.navigateTo(ROUTES.PRICING);
    }

    goToTerms(): void {
        this.navigateTo(ROUTES.TERMS_OF_SERVICE);
    }

    goToPrivacyPolicy(): void {
        this.navigateTo(ROUTES.PRIVACY_POLICY);
    }

    goToCookiePolicy(): void {
        this.navigateTo(ROUTES.COOKIE_POLICY);
    }

    /**
     * Navigate to 404 page
     */
    goToNotFound(): void {
        this.navigateTo(ROUTES.NOT_FOUND);
    }

    /**
     * Navigate back in browser history
     */
    goBack(): void {
        this.logNavigation('Browser Back', {
            from: window.location.pathname,
            to: 'previous',
            method: 'back'
        });
        window.history.back();
    }

    /**
     * Navigate forward in browser history
     */
    goForward(): void {
        this.logNavigation('Browser Forward', {
            from: window.location.pathname,
            to: 'next', 
            method: 'forward'
        });
        window.history.forward();
    }

    /**
     * Get current path
     */
    getCurrentPath(): string {
        return window.location.pathname;
    }

    /**
     * Check if currently on a specific route
     */
    isCurrentRoute(path: string): boolean {
        return window.location.pathname === path;
    }

    /**
     * Check if current route matches a pattern (for dynamic routes)
     */
    matchesRoute(pattern: string): boolean {
        const currentPath = window.location.pathname;
        // Simple pattern matching - replace :param with regex
        const regex = new RegExp('^' + pattern.replace(/:\w+/g, '[^/]+') + '$');
        return regex.test(currentPath);
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
                type: 'spa-navigation'
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
            userAgent: navigator.userAgent.substring(0, 100) // Truncated for privacy
        });
    }
}

// Export singleton instance
export const navigationService = new NavigationService();