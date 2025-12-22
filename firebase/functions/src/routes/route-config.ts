import type { RequestHandler } from 'express';
import { createHandlerRegistry } from '../ApplicationFactory';
import { FirestoreCollections } from '../constants';
import { isRealFirebase } from '../firebase';
import { logger } from '../logger';
import { ComponentBuilder } from '../services/ComponentBuilder';

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

    /** The actual handler function (set by ApplicationFactory) */
    handler?: RequestHandler;

    /** Middleware names to apply before the handler */
    middleware?: Array<'authenticate' | 'authenticateAdmin' | 'authenticateCloudTask' | 'authenticateSystemUser' | 'authenticateTenantAdmin'>;

    /** Optional tag for categorization/documentation */
    category?: 'diagnostic' | 'public' | 'test' | 'user' | 'auth' | 'resource' | 'admin';

    /** Whether this is an inline handler (defined directly in index.ts) */
    isInline?: boolean;

    /** Production availability */
    productionOnly?: boolean;

    /** Skip Content-Type validation (for binary uploads) */
    skipContentTypeValidation?: boolean;
}

/**
 * Centralized route configuration for the API.
 * This serves as the single source of truth for all routes in both production and testing.
 */
const routeDefinitions: RouteDefinition[] = [
    // === Theme Delivery ===
    {
        method: 'GET',
        path: '/theme.css',
        handlerName: 'serveThemeCss',
        category: 'public',
    },

    // === Shareable Pages (OG tags for social media) ===
    // No auth required - crawlers can't authenticate
    // These routes serve HTML with OG tags injected, then load the SPA normally
    {
        method: 'GET',
        path: '/join',
        handlerName: 'serveShareablePage',
        category: 'public',
    },

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
        middleware: ['authenticateAdmin'],
        category: 'admin',
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
        method: 'GET',
        path: '/bootstrap-config',
        handlerName: 'getBootstrapConfig',
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
        path: '/policies/:policyId/current',
        handlerName: 'getCurrentPolicy',
        category: 'public',
    },
    {
        method: 'GET',
        path: '/policies/privacy-policy/text',
        handlerName: 'getPrivacyPolicyText',
        category: 'public',
    },
    {
        method: 'GET',
        path: '/policies/terms-of-service/text',
        handlerName: 'getTermsOfServiceText',
        category: 'public',
    },
    {
        method: 'GET',
        path: '/policies/cookie-policy/text',
        handlerName: 'getCookiePolicyText',
        category: 'public',
    },

    // === Test Endpoints (emulator only - handlers not registered in production) ===
    {
        method: 'POST',
        path: '/test-pool/borrow',
        handlerName: 'borrowTestUser',
        category: 'test',
    },
    {
        method: 'POST',
        path: '/test-pool/return',
        handlerName: 'returnTestUser',
        category: 'test',
    },
    {
        method: 'POST',
        path: '/test-pool/promote-to-admin',
        handlerName: 'promoteTestUserToAdmin',
        category: 'test',
    },
    {
        method: 'POST',
        path: '/test/create-admin',
        handlerName: 'createAdminUser',
        category: 'test',
    },
    {
        method: 'POST',
        path: '/user/clear-policy-acceptances',
        handlerName: 'clearUserPolicyAcceptances',
        category: 'test',
    },
    {
        method: 'POST',
        path: '/test/verify-email',
        handlerName: 'verifyEmail',
        category: 'test',
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

    // === Account Merge ===
    {
        method: 'POST',
        path: '/merge',
        handlerName: 'initiateMerge',
        category: 'user',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: '/merge/:jobId',
        handlerName: 'getMergeStatus',
        category: 'user',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: '/tasks/processMerge',
        handlerName: 'processMergeTask',
        category: 'resource',
        middleware: ['authenticateCloudTask'],
    },

    // === Tenant Admin ===
    {
        method: 'POST',
        path: '/admin/tenants',
        handlerName: 'adminUpsertTenant',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'POST',
        path: '/admin/tenants/publish',
        handlerName: 'publishTenantTheme',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'POST',
        path: '/admin/tenants/:tenantId/assets/:assetType',
        handlerName: 'uploadTenantImage',
        category: 'admin',
        middleware: ['authenticateAdmin'],
        skipContentTypeValidation: true,
    },

    // === Tenant Image Library ===
    {
        method: 'GET',
        path: '/admin/tenants/:tenantId/images',
        handlerName: 'listTenantImages',
        category: 'admin',
        middleware: ['authenticateTenantAdmin'],
    },
    {
        method: 'POST',
        path: '/admin/tenants/:tenantId/images',
        handlerName: 'uploadTenantLibraryImage',
        category: 'admin',
        middleware: ['authenticateTenantAdmin'],
        skipContentTypeValidation: true,
    },
    {
        method: 'PATCH',
        path: '/admin/tenants/:tenantId/images/:imageId',
        handlerName: 'renameTenantImage',
        category: 'admin',
        middleware: ['authenticateTenantAdmin'],
    },
    {
        method: 'DELETE',
        path: '/admin/tenants/:tenantId/images/:imageId',
        handlerName: 'deleteTenantImage',
        category: 'admin',
        middleware: ['authenticateTenantAdmin'],
    },

    // === Registration ===
    {
        method: 'POST',
        path: '/register',
        handlerName: 'register',
        category: 'auth',
    },

    // === Login ===
    {
        method: 'POST',
        path: '/login',
        handlerName: 'login',
        category: 'auth',
    },

    // === Password Reset ===
    {
        method: 'POST',
        path: '/password-reset',
        handlerName: 'sendPasswordResetEmail',
        category: 'auth',
    },

    // === Email Verification ===
    {
        method: 'POST',
        path: '/email-verification',
        handlerName: 'sendEmailVerification',
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
        path: `/${FirestoreCollections.EXPENSES}/:expenseId/full-details`,
        handlerName: 'getExpenseFullDetails',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.EXPENSES}`,
        handlerName: 'listGroupExpenses',
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
        path: `/${FirestoreCollections.GROUPS}/:groupId/full-details`,
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
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}/:groupId/activity-feed`,
        handlerName: 'getGroupActivityFeed',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PUT',
        path: `/${FirestoreCollections.GROUPS}/:groupId`,
        handlerName: 'updateGroup',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.GROUPS}/:groupId`,
        handlerName: 'deleteGroup',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PATCH',
        path: `/${FirestoreCollections.GROUPS}/:groupId/security/permissions`,
        handlerName: 'updateGroupPermissions',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:groupId/leave`,
        handlerName: 'leaveGroup',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:groupId/archive`,
        handlerName: 'archiveGroupForUser',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:groupId/unarchive`,
        handlerName: 'unarchiveGroupForUser',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PUT',
        path: `/${FirestoreCollections.GROUPS}/:groupId/members/display-name`,
        handlerName: 'updateGroupMemberDisplayName',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}/:groupId/members/pending`,
        handlerName: 'getPendingMembers',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'PATCH',
        path: `/${FirestoreCollections.GROUPS}/:groupId/members/:memberId/role`,
        handlerName: 'updateMemberRole',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:groupId/members/:memberId/approve`,
        handlerName: 'approveMember',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:groupId/members/:memberId/reject`,
        handlerName: 'rejectMember',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.GROUPS}/:groupId/members/:memberId`,
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
    {
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.SETTLEMENTS}`,
        handlerName: 'listGroupSettlements',
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
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.COMMENTS}/:commentId`,
        handlerName: 'deleteGroupComment',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.EXPENSES}/:expenseId/${FirestoreCollections.COMMENTS}/:commentId`,
        handlerName: 'deleteExpenseComment',
        category: 'resource',
        middleware: ['authenticate'],
    },

    // === Attachments ===
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:groupId/attachments`,
        handlerName: 'uploadAttachment',
        category: 'resource',
        middleware: ['authenticate'],
        skipContentTypeValidation: true,
    },
    {
        method: 'GET',
        path: `/${FirestoreCollections.GROUPS}/:groupId/attachments/:attachmentId`,
        handlerName: 'getAttachment',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'DELETE',
        path: `/${FirestoreCollections.GROUPS}/:groupId/attachments/:attachmentId`,
        handlerName: 'deleteAttachment',
        category: 'resource',
        middleware: ['authenticate'],
    },

    // === Reactions ===
    {
        method: 'POST',
        path: `/${FirestoreCollections.EXPENSES}/:expenseId/${FirestoreCollections.REACTIONS}`,
        handlerName: 'toggleExpenseReaction',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.COMMENTS}/:commentId/${FirestoreCollections.REACTIONS}`,
        handlerName: 'toggleGroupCommentReaction',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.EXPENSES}/:expenseId/${FirestoreCollections.COMMENTS}/:commentId/${FirestoreCollections.REACTIONS}`,
        handlerName: 'toggleExpenseCommentReaction',
        category: 'resource',
        middleware: ['authenticate'],
    },
    {
        method: 'POST',
        path: `/${FirestoreCollections.SETTLEMENTS}/:settlementId/${FirestoreCollections.REACTIONS}`,
        handlerName: 'toggleSettlementReaction',
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
        path: `/admin/${FirestoreCollections.POLICIES}/:policyId`,
        handlerName: 'getPolicy',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'GET',
        path: `/admin/${FirestoreCollections.POLICIES}/:policyId/versions/:hash`,
        handlerName: 'getPolicyVersion',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'PUT',
        path: `/admin/${FirestoreCollections.POLICIES}/:policyId`,
        handlerName: 'updatePolicy',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'POST',
        path: `/admin/${FirestoreCollections.POLICIES}/:policyId/publish`,
        handlerName: 'publishPolicy',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'DELETE',
        path: `/admin/${FirestoreCollections.POLICIES}/:policyId/versions/:hash`,
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
    {
        method: 'GET',
        path: '/admin/browser/tenants',
        handlerName: 'listAllTenants',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },

    // === Admin User Management ===
    {
        method: 'PUT',
        path: '/admin/users/:userId',
        handlerName: 'updateUserAdmin',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'PUT',
        path: '/admin/users/:userId/role',
        handlerName: 'updateUserRoleAdmin',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'GET',
        path: '/admin/users/:userId/auth',
        handlerName: 'getUserAuth',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'GET',
        path: '/admin/users/:userId/firestore',
        handlerName: 'getUserFirestore',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },
    {
        method: 'PUT',
        path: '/admin/users/:userId/profile',
        handlerName: 'updateUserProfileAdmin',
        category: 'admin',
        middleware: ['authenticateAdmin'],
    },

    // === URL Utilities ===
    {
        method: 'POST',
        path: '/utils/resolve-redirect',
        handlerName: 'resolveRedirect',
        category: 'resource',
        middleware: ['authenticate'],
    },

    // === Tenant Settings (Tenant Admin Only) ===
    {
        method: 'GET',
        path: '/settings/tenant',
        handlerName: 'getTenantSettings',
        category: 'admin',
        middleware: ['authenticateTenantAdmin'],
    },
    {
        method: 'PUT',
        path: '/settings/tenant/branding',
        handlerName: 'updateTenantBranding',
        category: 'admin',
        middleware: ['authenticateTenantAdmin'],
    },
    {
        method: 'GET',
        path: '/settings/tenant/domains',
        handlerName: 'listTenantDomains',
        category: 'admin',
        middleware: ['authenticateTenantAdmin'],
    },
    {
        method: 'POST',
        path: '/settings/tenant/domains',
        handlerName: 'addTenantDomain',
        category: 'admin',
        middleware: ['authenticateTenantAdmin'],
    },
];

export function createRouteDefinitions(componentBuilder: ComponentBuilder) {
    const handlerRegistry = createHandlerRegistry(componentBuilder);

    // Populate route definitions with handlers from the registry
    const routes = routeDefinitions.slice();

    for (const route of routes) {
        const handler = handlerRegistry[route.handlerName];
        if (handler) {
            route.handler = handler;
        } else if (!route.isInline) {
            // Test routes are intentionally excluded from production - don't warn
            const isExpectedMissing = route.category === 'test' && isRealFirebase();
            if (!isExpectedMissing) {
                logger.warn('route-handler-missing', {
                    method: route.method,
                    path: route.path,
                    handlerName: route.handlerName,
                });
            }
        }
    }

    return routes;
}
