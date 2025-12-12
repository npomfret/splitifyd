import { ExpenseId, GroupId } from '@billsplit-wl/shared';

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

    // Admin Pages (System Admin only)
    ADMIN: '/admin',
    USERS_BROWSER: '/browser/users',
} as const;

// Helper functions for dynamic routes
export const routes = {
    groupDetail: (id: string) => `/groups/${id}`,
    addExpense: (groupId: GroupId) => `/groups/${groupId}/add-expense`,
    expenseDetail: (groupId: GroupId, expenseId: ExpenseId) => `/groups/${groupId}/expenses/${expenseId}`,
    loginWithReturnUrl: (returnUrl: string) => `/login?returnUrl=${encodeURIComponent(returnUrl)}`,
} as const;
