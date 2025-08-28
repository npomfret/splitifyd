export const ROUTES = {
    // Main Routes
    HOME: '/',
    DASHBOARD: '/dashboard',
    NOT_FOUND: '/404',

    // Auth Routes
    LOGIN: '/login',
    REGISTER: '/register',
    RESET_PASSWORD: '/reset-password',

    // Group Routes
    GROUP_DETAIL: '/groups/:id',
    GROUP_DETAIL_ALT: '/group/:id', // Alternative route for backward compatibility
    ADD_EXPENSE: '/groups/:groupId/add-expense',
    EXPENSE_DETAIL: '/groups/:groupId/expenses/:expenseId',
    JOIN_GROUP: '/join',

    // User Pages
    SETTINGS: '/settings',

    // Static Pages
    PRICING: '/pricing',
    TERMS_OF_SERVICE: '/terms-of-service',
    TERMS_OF_SERVICE_SHORT: '/terms',
    PRIVACY_POLICY: '/privacy-policy',
    PRIVACY_POLICY_SHORT: '/privacy',
    COOKIE_POLICY: '/cookies-policy',
    COOKIE_POLICY_SHORT: '/cookies',
} as const;

// Helper functions for dynamic routes
export const routes = {
    groupDetail: (id: string) => `/groups/${id}`,
    addExpense: (groupId: string) => `/groups/${groupId}/add-expense`,
    expenseDetail: (groupId: string, expenseId: string) => `/groups/${groupId}/expenses/${expenseId}`,
    editExpense: (groupId: string, expenseId: string) => `/groups/${groupId}/add-expense?id=${expenseId}&edit=true`,
    copyExpense: (groupId: string, sourceId: string) => `/groups/${groupId}/add-expense?copy=true&sourceId=${sourceId}`,
    loginWithReturnUrl: (returnUrl: string) => `/login?returnUrl=${encodeURIComponent(returnUrl)}`,
} as const;

// Type for all route values
export type RouteKey = keyof typeof ROUTES;
export type RouteValue = (typeof ROUTES)[RouteKey];
