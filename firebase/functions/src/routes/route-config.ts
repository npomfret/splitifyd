import type { RequestHandler } from 'express';
import { FirestoreCollections } from '../constants';

/**
 * Route configuration type defining the structure of each route
 */
export interface RouteDefinition {
    /** HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD, ALL) */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'ALL';

    /** Express route path (e.g., '/users/:id') */
    path: string;

    /** Handler function identifier */
    handlerName: string;

    /** Middleware names to apply before the handler */
    middleware?: Array<'authenticate' | 'authenticateAdmin' | 'authenticateSystemUser'>;

    /** Optional tag for categorization/documentation */
    category?: 'diagnostic' | 'public' | 'test' | 'user' | 'auth' | 'resource' | 'admin';

    /** Whether this is an inline handler (defined directly in index.ts) */
    isInline?: boolean;

    /** Production availability */
    productionOnly?: boolean;
    testOnly?: boolean;
}

/**
 * Centralized route configuration for the Splitifyd API.
 * This serves as the single source of truth for all routes in both production and testing.
 */
export const routeDefinitions: RouteDefinition[] = [
    // === Diagnostics & Infrastructure ===
    {
        method: 'GET',
        path: '/metrics',
        handlerName: 'getMetrics',
        category: 'diagnostic',
        isInline: true,
    },
    {
        method: 'GET',
        path: '/health',
        handlerName: 'getHealth',
        category: 'diagnostic',
        isInline: true,
    },
    {
        method: 'HEAD',
        path: '/health',
        handlerName: 'headHealth',
        category: 'diagnostic',
        isInline: true,
    },
    {
        method: 'GET',
        path: '/env',
        handlerName: 'getEnv',
        category: 'diagnostic',
        middleware: ['authenticateSystemUser'],
        isInline: true,
    },
    {
        method: 'GET',
        path: '/config',
        handlerName: 'getConfig',
        category: 'diagnostic',
        isInline: true,
    },
    {
        method: 'POST',
        path: '/csp-violation-report',
        handlerName: 'reportCspViolation',
        category: 'diagnostic',
        isInline: true,
    },

    // === Public Policies ===
    {
        method: 'GET',
        path: '/policies/:id/current',
        handlerName: 'getCurrentPolicy',
        category: 'public',
    },

    // === Test Endpoints (non-production only) ===
    {
        method: 'POST',
        path: '/test-pool/borrow',
        handlerName: 'borrowTestUser',
        category: 'test',
        testOnly: true,
    },
    {
        method: 'POST',
        path: '/test-pool/return',
        handlerName: 'returnTestUser',
        category: 'test',
        testOnly: true,
    },
    {
        method: 'POST',
        path: '/test/user/clear-policy-acceptances',
        handlerName: 'testClearPolicyAcceptances',
        category: 'test',
        testOnly: true,
    },
    {
        method: 'POST',
        path: '/test/user/promote-to-admin',
        handlerName: 'testPromoteToAdmin',
        category: 'test',
        testOnly: true,
    },

    // === User & Policy Management ===
    {
        method: 'POST',
        path: '/user/policies/accept-multiple',
        handlerName: 'acceptMultiplePolicies',
        category: 'user',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: '/user/policies/status',
        handlerName: 'getUserPolicyStatus',
        category: 'user',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: '/user/profile',
        handlerName: 'getUserProfile',
        category: 'user',
        middleware: ['authenticate'],
    },
    {
        method: 'PUT',
        path: '/user/profile',
        handlerName: 'updateUserProfile',
        category: 'user',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: '/user/change-password',
        handlerName: 'changePassword',
        category: 'user',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: '/user/change-email',
        handlerName: 'changeEmail',
        category: 'user',
        middleware: ['authenticate'],
    },

    // === Registration ===
    {
        method: 'POST',
        path: '/register',
        handlerName: 'register',
        category: 'auth',
    },

    // === Expenses ===
    {
        method: 'POST',
        path: `/${FirestoreCollections.EXPENSES}`,
        handlerName: 'createExpense',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PUT',
        path: `/${FirestoreCollections.EXPENSES}`,
        handlerName: 'updateExpense',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.EXPENSES}`,
        handlerName: 'deleteExpense',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: `/${FirestoreCollections.EXPENSES}/:id/full-details`,
        handlerName: 'getExpenseFullDetails',
        category: 'resource',
        middleware: ['authenticate'],
    },

    // === Groups ===
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}`,
        handlerName: 'createGroup',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}`,
        handlerName: 'listGroups',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/share`,
        handlerName: 'generateShareableLink',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/preview`,
        handlerName: 'previewGroupByLink',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/join`,
        handlerName: 'joinGroupByLink',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}/:id/full-details`,
        handlerName: 'getGroupFullDetails',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: '/activity-feed',
        handlerName: 'getActivityFeed',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PUT',
        path: `/${FirestoreCollections.GROUPS}/:id`,
        handlerName: 'updateGroup',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.GROUPS}/:id`,
        handlerName: 'deleteGroup',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PATCH',
        path: `/${FirestoreCollections.GROUPS}/:id/security/permissions`,
        handlerName: 'updateGroupPermissions',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:id/leave`,
        handlerName: 'leaveGroup',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:id/archive`,
        handlerName: 'archiveGroupForUser',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:id/unarchive`,
        handlerName: 'unarchiveGroupForUser',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PUT',
        path: `/${FirestoreCollections.GROUPS}/:id/members/display-name`,
        handlerName: 'updateGroupMemberDisplayName',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}/:id/members/pending`,
        handlerName: 'getPendingMembers',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PATCH',
        path: `/${FirestoreCollections.GROUPS}/:id/members/:memberId/role`,
        handlerName: 'updateMemberRole',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:id/members/:memberId/approve`,
        handlerName: 'approveMember',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:id/members/:memberId/reject`,
        handlerName: 'rejectMember',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.GROUPS}/:id/members/:memberId`,
        handlerName: 'removeGroupMember',
        category: 'resource',
        middleware: ['authenticate'],
    },

    // === Settlements ===
    {
        method: 'POST',
        path: `/${FirestoreCollections.SETTLEMENTS}`,
        handlerName: 'createSettlement',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PUT',
        path: `/${FirestoreCollections.SETTLEMENTS}/:settlementId`,
        handlerName: 'updateSettlement',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.SETTLEMENTS}/:settlementId`,
        handlerName: 'deleteSettlement',
        category: 'resource',
        middleware: ['authenticate'],
    },

    // === Comments ===
    {
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.COMMENTS}`,
        handlerName: 'listGroupComments',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.COMMENTS}`,
        handlerName: 'createComment',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: `/${FirestoreCollections.EXPENSES}/:expenseId/${FirestoreCollections.COMMENTS}`,
        handlerName: 'listExpenseComments',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.EXPENSES}/:expenseId/${FirestoreCollections.COMMENTS}`,
        handlerName: 'createCommentForExpense',
        category: 'resource',
        middleware: ['authenticate'],
    },

    // === Admin Policies ===
    {
        method: 'POST',
        path: `/admin/${FirestoreCollections.POLICIES}`,
        handlerName: 'createPolicy',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'GET',
        path: `/admin/${FirestoreCollections.POLICIES}`,
        handlerName: 'listPolicies',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'GET',
        path: `/admin/${FirestoreCollections.POLICIES}/:id`,
        handlerName: 'getPolicy',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'GET',
        path: `/admin/${FirestoreCollections.POLICIES}/:id/versions/:hash`,
        handlerName: 'getPolicyVersion',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'PUT',
        path: `/admin/${FirestoreCollections.POLICIES}/:id`,
        handlerName: 'updatePolicy',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'POST',
        path: `/admin/${FirestoreCollections.POLICIES}/:id/publish`,
        handlerName: 'publishPolicy',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'DELETE',
        path: `/admin/${FirestoreCollections.POLICIES}/:id/versions/:hash`,
        handlerName: 'deletePolicyVersion',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },

    // === Admin Browser ===
    {
        method: 'GET',
        path: '/admin/browser/users/auth',
        handlerName: 'listAuthUsers',
        category: 'admin',
        middleware: ['authenticateSystemUser'],
    },
    {
        method: 'GET',
        path: '/admin/browser/users/firestore',
        handlerName: 'listFirestoreUsers',
        category: 'admin',
        middleware: ['authenticateSystemUser'],
    },
];
