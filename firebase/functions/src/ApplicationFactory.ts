import { CreateAdminUserRequest, SystemUserRoles, TestErrorResponse, TestSuccessResponse, toEmail, toISOString } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import { getAppConfig, getTenantAwareAppConfig } from './app-config';
import { buildEnvPayload, buildHealthPayload, resolveHealthStatusCode, runHealthChecks } from './endpoints/diagnostics';
import { isRealFirebase } from './firebase';
import { logger } from './logger';
import { metrics, toAggregatedReport } from './monitoring/lightweight-metrics';
import { UpdateTenantBrandingRequestSchema } from './schemas/tenant';
import type { IAuthService } from './services/auth';
import { ComponentBuilder } from './services/ComponentBuilder';
import { TestUserPoolService } from './test-pool/TestUserPoolService';
import { getEnhancedConfigResponse } from './utils/config-response';

// Handler imports
import { toPolicyId, toTenantId, toUserId } from '@billsplit-wl/shared';
import { ActivityFeedHandlers } from './activity/ActivityHandlers';
import { UserAdminHandlers } from './admin/UserAdminHandlers';
import { AttachmentHandlers } from './attachments/AttachmentHandlers';
import { AuthHandlers } from './auth/handlers';
import { CommentHandlers } from './comments/CommentHandlers';
import { ExpenseHandlers } from './expenses/ExpenseHandlers';
import { GroupHandlers } from './groups/GroupHandlers';
import { GroupMemberHandlers } from './groups/GroupMemberHandlers';
import { GroupShareHandlers } from './groups/GroupShareHandlers';
import { PolicyHandlers } from './policies/PolicyHandlers';
import { PolicyTextHandlers } from './policies/PolicyTextHandlers';
import { UserHandlers as PolicyUserHandlers } from './policies/UserHandlers';
import { ReactionHandlers } from './reactions/ReactionHandlers';
import { SettlementHandlers } from './settlements/SettlementHandlers';
import { TenantAdminHandlers } from './tenant/TenantAdminHandlers';
import { TenantImageLibraryHandlers } from './tenant/TenantImageLibraryHandlers';
import { ThemeHandlers } from './theme/ThemeHandlers';
import { UserHandlers } from './user/UserHandlers';
import { UrlRedirectHandlers } from './utils/UrlRedirectHandlers';

/**
 * Factory function that creates all application handlers with proper dependency injection.
 * This is the single source of truth for handler instantiation.
 *
 * @param componentBuilder - Component builder that provides all dependencies
 * @returns Record mapping handler names to handler functions
 */
export function createHandlerRegistry(componentBuilder: ComponentBuilder): Record<string, RequestHandler> {
    // Create ComponentBuilder with injected dependencies
    const authService: IAuthService = componentBuilder.buildAuthService();

    // Instantiate all handler classes
    const settlementHandlers = new SettlementHandlers(componentBuilder.buildSettlementService());
    const groupHandlers = new GroupHandlers(componentBuilder.buildGroupService());
    const groupShareHandlers = new GroupShareHandlers(componentBuilder.buildGroupShareService());
    const groupMemberHandlers = new GroupMemberHandlers(componentBuilder.buildGroupMemberService());
    const expenseHandlers = new ExpenseHandlers(componentBuilder.buildExpenseService());
    const commentHandlers = new CommentHandlers(componentBuilder.buildCommentService());
    const reactionHandlers = new ReactionHandlers(componentBuilder.buildReactionService());
    const attachmentHandlers = new AttachmentHandlers(
        componentBuilder.buildGroupMemberService(),
        componentBuilder.buildGroupAttachmentStorage(),
    );
    const userHandlers = new UserHandlers(
        componentBuilder.buildUserService(),
        authService,
        componentBuilder.buildTenantRegistryService(),
    );
    const policyHandlers = new PolicyHandlers(componentBuilder.buildPolicyService());
    const policyUserHandlers = new PolicyUserHandlers(componentBuilder.buildUserPolicyService());
    const activityFeedHandlers = new ActivityFeedHandlers(
        componentBuilder.buildActivityFeedService(),
        componentBuilder.buildFirestoreReader(),
    );
    const groupSecurityHandlers = componentBuilder.buildGroupSecurityHandlers();
    const userBrowserHandlers = componentBuilder.buildUserBrowserHandlers();
    const tenantBrowserHandlers = componentBuilder.buildTenantBrowserHandlers();
    const mergeHandlers = componentBuilder.buildMergeHandlers();

    // Services for inline handlers
    const userService = componentBuilder.buildUserService();
    const policyService = componentBuilder.buildPolicyService();
    const firestoreWriter = componentBuilder.buildFirestoreWriter();
    const firestoreReader = componentBuilder.buildFirestoreReader();
    const userAdminHandlers = new UserAdminHandlers(authService, firestoreWriter, firestoreReader);
    const tenantRegistryService = componentBuilder.buildTenantRegistryService();
    const tenantAdminHandlers = new TenantAdminHandlers(
        componentBuilder.buildTenantAdminService(),
        componentBuilder.buildTenantAssetStorage(),
        componentBuilder.buildFirestoreReader(),
    );
    const tenantImageLibraryHandlers = new TenantImageLibraryHandlers(
        componentBuilder.buildTenantImageLibraryService(),
    );
    const themeHandlers = new ThemeHandlers(componentBuilder.buildFirestoreReader(), tenantRegistryService);
    const policyTextHandlers = new PolicyTextHandlers(policyService, tenantRegistryService);
    const authHandlers = new AuthHandlers(authService, tenantRegistryService, userService);
    const urlRedirectHandlers = new UrlRedirectHandlers();
    const sharingHandlers = componentBuilder.buildSharingHandlers();

    // Inline diagnostic handlers
    const getMetrics: RequestHandler = (req, res) => {
        const snapshot = metrics.getSnapshot();
        res.json(toAggregatedReport(snapshot));
    };

    const getHealth: RequestHandler = async (req, res) => {
        const checks = await runHealthChecks();
        const payload = buildHealthPayload(checks);
        const statusCode = resolveHealthStatusCode(checks);
        res.status(statusCode).json(payload);
    };

    const headHealth: RequestHandler = async (req, res) => {
        const checks = await runHealthChecks();
        const statusCode = resolveHealthStatusCode(checks);
        res.status(statusCode).end();
    };

    const getEnv: RequestHandler = (req, res) => {
        res.json(buildEnvPayload());
    };

    const getConfig: RequestHandler = async (req, res) => {
        const host = req.headers['x-forwarded-host'] as string | undefined
            ?? req.headers.host
            ?? req.hostname
            ?? null;

        const tenantContext = await tenantRegistryService.resolveTenant({ host });
        const config = getEnhancedConfigResponse(tenantContext);

        const serverConfig = getAppConfig();
        const maxAge = serverConfig.cache.paths['/api/config'];
        res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);
        res.json(config);
    };

    const getBootstrapConfig: RequestHandler = async (_req, res) => {
        // Minimal config for scripts that need to authenticate before tenants exist
        const config = getTenantAwareAppConfig();
        res.setHeader('Cache-Control', 'no-cache');
        res.json(config);
    };

    const reportCspViolation: RequestHandler = (req, res) => {
        try {
            res.status(204).send();
        } catch (error) {
            logger.error('Error processing CSP violation report', error);
            res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
        }
    };

    // Test endpoint handlers (only registered in emulator environments)
    const testPool = TestUserPoolService.getInstance(firestoreWriter, userService, authService);

    const borrowTestUser: RequestHandler = async (req, res) => {
        try {
            const poolUser = await testPool.borrowUser();
            res.json(poolUser);
        } catch (error: any) {
            logger.error('Failed to borrow test user', error);
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to borrow test user',
                    details: error.message,
                },
            });
        }
    };

    const returnTestUser: RequestHandler = async (req, res) => {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Email required' } });
            return;
        }

        try {
            await testPool.returnUser(email);
            res.status(204).send();
        } catch (error: any) {
            logger.error('Failed to return test user', error);
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to return test user',
                    details: error.message,
                },
            });
        }
    };

    const promoteTestUserToAdmin: RequestHandler = async (req, res) => {
        const { uid } = req.body;

        if (!uid) {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'User ID required' } });
            return;
        }

        try {
            // Update Firestore document only
            await firestoreWriter.promoteUserToAdmin(uid);
            res.status(204).send();
        } catch (error: any) {
            logger.error('Failed to promote user to admin', error);
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to promote user to admin',
                    details: error.message,
                },
            });
        }
    };

    const createAdminUser: RequestHandler = async (req, res) => {
        const { email, password, displayName } = req.body as CreateAdminUserRequest;

        if (!email || !password || !displayName) {
            res.status(400).json({
                error: { code: 'BAD_REQUEST', message: 'email, password, and displayName are required' },
            });
            return;
        }

        try {
            // Create user in Firebase Auth (bypassing normal registration flow)
            // Mark email as verified so admin can perform write operations immediately
            const userRecord = await authService.createUser({
                email,
                password,
                displayName,
                emailVerified: true,
            });

            const userId = toUserId(userRecord.uid);

            // Create user document in Firestore with admin role (no policy acceptance needed)
            const now = toISOString(new Date().toISOString());
            await firestoreWriter.createUser(userId, {
                role: SystemUserRoles.SYSTEM_ADMIN,
                createdAt: now,
                updatedAt: now,
                acceptedPolicies: {}, // Empty - policies don't exist yet during bootstrap
            });

            // Create custom token for authentication
            const token = await authService.createCustomToken(userId);

            res.json({
                uid: userId,
                email: toEmail(email),
                password,
                token,
            });
        } catch (error: any) {
            logger.error('Failed to create admin user', error);
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to create admin user',
                    details: error.message,
                },
            });
        }
    };

    const clearUserPolicyAcceptances: RequestHandler = async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const response: TestErrorResponse = {
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authorization token required',
                },
            };
            res.status(401).json(response);
            return;
        }

        const token = authHeader.substring(7);
        let decodedToken;

        try {
            decodedToken = await authService.verifyIdToken(token);
        } catch (error) {
            const response: TestErrorResponse = {
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid token',
                },
            };
            res.status(401).json(response);
            return;
        }

        try {
            await firestoreWriter.updateUser(toUserId(decodedToken.uid), {
                acceptedPolicies: {},
            });

            logger.info('Policy acceptances cleared', {
                userId: decodedToken.uid,
            });

            const response: TestSuccessResponse = {
                success: true,
                message: 'Policy acceptances cleared',
            };
            res.json(response);
        } catch (error) {
            logger.error('Failed to clear policy acceptances', error as Error, {
                userId: decodedToken.uid,
            });
            throw error;
        }
    };

    // Tenant settings handlers (admin-only)
    const getTenantSettings: RequestHandler = async (req, res) => {
        try {
            // Get the tenant ID from the request (set by tenant identification middleware)
            const tenantId = (req as any).tenantId;

            if (!tenantId) {
                res.status(400).json({
                    error: {
                        code: 'MISSING_TENANT_ID',
                        message: 'Tenant ID not found in request context',
                    },
                });
                return;
            }

            // Fetch tenant configuration from registry
            const tenantRecord = await tenantRegistryService.getTenantById(toTenantId(tenantId));

            res.json({
                tenantId: tenantRecord.tenantId,
                config: tenantRecord.config,
                domains: tenantRecord.domains,
            });
        } catch (error) {
            logger.error('Failed to get tenant settings', error);
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve tenant settings',
                },
            });
        }
    };

    const updateTenantBranding: RequestHandler = async (req, res) => {
        try {
            const tenantId = (req as any).tenantId;

            if (!tenantId) {
                res.status(400).json({
                    error: {
                        code: 'MISSING_TENANT_ID',
                        message: 'Tenant ID not found in request context',
                    },
                });
                return;
            }

            // Validate request body
            const parseResult = UpdateTenantBrandingRequestSchema.safeParse(req.body);

            if (!parseResult.success) {
                res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid branding update request',
                        details: parseResult.error.issues,
                    },
                });
                return;
            }

            const brandingUpdates = parseResult.data;

            // Update tenant branding in Firestore
            const result = await firestoreWriter.updateTenantBranding(tenantId, brandingUpdates);

            if (!result.success) {
                res.status(500).json({
                    error: {
                        code: 'UPDATE_FAILED',
                        message: result.error || 'Failed to update tenant branding',
                    },
                });
                return;
            }

            // Clear tenant registry cache to force reload of updated configuration
            tenantRegistryService.clearCache();

            res.status(204).send();
        } catch (error) {
            logger.error('Failed to update tenant branding', error);
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to update tenant branding',
                },
            });
        }
    };

    const listTenantDomains: RequestHandler = async (req, res) => {
        try {
            const tenantId = (req as any).tenantId;

            if (!tenantId) {
                res.status(400).json({
                    error: {
                        code: 'MISSING_TENANT_ID',
                        message: 'Tenant ID not found in request context',
                    },
                });
                return;
            }

            const tenantRecord = await tenantRegistryService.getTenantById(toTenantId(tenantId));

            res.json({
                domains: tenantRecord.domains,
            });
        } catch (error) {
            logger.error('Failed to list tenant domains', error);
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to list tenant domains',
                },
            });
        }
    };

    const addTenantDomain: RequestHandler = async (req, res) => {
        // TODO: Implement tenant domain addition
        // This will add a new domain to the tenant configuration in Firestore
        res.status(501).json({
            error: {
                code: 'NOT_IMPLEMENTED',
                message: 'Tenant domain addition not yet implemented',
            },
        });
    };

    // Build handler registry
    const registry: Record<string, RequestHandler> = {
        // Group handlers
        createGroup: groupHandlers.createGroup,
        listGroups: groupHandlers.listGroups,
        getGroupFullDetails: groupHandlers.getGroupFullDetails,
        updateGroup: groupHandlers.updateGroup,
        deleteGroup: groupHandlers.deleteGroup,
        updateGroupMemberDisplayName: groupHandlers.updateGroupMemberDisplayName,

        // Group share handlers
        generateShareableLink: groupShareHandlers.generateShareableLink,
        joinGroupByLink: groupShareHandlers.joinGroupByLink,
        previewGroupByLink: groupShareHandlers.previewGroupByLink,

        // Group member handlers
        leaveGroup: groupMemberHandlers.leaveGroup,
        removeGroupMember: groupMemberHandlers.removeGroupMember,
        archiveGroupForUser: groupMemberHandlers.archiveGroupForUser,
        unarchiveGroupForUser: groupMemberHandlers.unarchiveGroupForUser,

        // Group security handlers
        updateGroupPermissions: groupSecurityHandlers.updateGroupPermissions,
        getPendingMembers: groupSecurityHandlers.getPendingMembers,
        updateMemberRole: groupSecurityHandlers.updateMemberRole,
        approveMember: groupSecurityHandlers.approveMember,
        rejectMember: groupSecurityHandlers.rejectMember,

        // Expense handlers
        createExpense: expenseHandlers.createExpense,
        updateExpense: expenseHandlers.updateExpense,
        deleteExpense: expenseHandlers.deleteExpense,
        getExpenseFullDetails: expenseHandlers.getExpenseFullDetails,
        listGroupExpenses: expenseHandlers.listGroupExpenses,

        // Settlement handlers
        createSettlement: settlementHandlers.createSettlement,
        updateSettlement: settlementHandlers.updateSettlement,
        deleteSettlement: settlementHandlers.deleteSettlement,
        listGroupSettlements: settlementHandlers.listGroupSettlements,

        // Comment handlers
        createComment: commentHandlers.createComment,
        createCommentForExpense: commentHandlers.createComment,
        listGroupComments: commentHandlers.listGroupComments,
        listExpenseComments: commentHandlers.listExpenseComments,
        deleteGroupComment: commentHandlers.deleteGroupComment,
        deleteExpenseComment: commentHandlers.deleteExpenseComment,

        // Attachment handlers
        uploadAttachment: attachmentHandlers.uploadAttachment,
        getAttachment: attachmentHandlers.getAttachment,
        deleteAttachment: attachmentHandlers.deleteAttachment,

        // Reaction handlers
        toggleExpenseReaction: reactionHandlers.toggleExpenseReaction,
        toggleGroupCommentReaction: reactionHandlers.toggleGroupCommentReaction,
        toggleExpenseCommentReaction: reactionHandlers.toggleExpenseCommentReaction,
        toggleSettlementReaction: reactionHandlers.toggleSettlementReaction,

        // User handlers
        getUserProfile: userHandlers.getUserProfile,
        updateUserProfile: userHandlers.updateUserProfile,
        changePassword: userHandlers.changePassword,
        changeEmail: userHandlers.changeEmail,

        // Merge handlers
        initiateMerge: mergeHandlers.initiateMerge,
        getMergeStatus: mergeHandlers.getMergeStatus,
        processMergeTask: mergeHandlers.processMergeTask,

        // Policy handlers
        createPolicy: policyHandlers.createPolicy,
        listPolicies: policyHandlers.listPolicies,
        getPolicy: policyHandlers.getPolicy,
        getPolicyVersion: policyHandlers.getPolicyVersion,
        updatePolicy: policyHandlers.updatePolicy,
        publishPolicy: policyHandlers.publishPolicy,
        deletePolicyVersion: policyHandlers.deletePolicyVersion,
        acceptMultiplePolicies: policyUserHandlers.acceptMultiplePolicies,
        getUserPolicyStatus: policyUserHandlers.getUserPolicyStatus,

        // Activity feed
        getActivityFeed: activityFeedHandlers.getActivityFeed,
        getGroupActivityFeed: activityFeedHandlers.getGroupActivityFeed,

        // User browser (admin)
        listAuthUsers: userBrowserHandlers.listAuthUsers,
        listFirestoreUsers: userBrowserHandlers.listFirestoreUsers,

        // User admin (system admin)
        updateUserAdmin: userAdminHandlers.updateUser,
        updateUserRoleAdmin: userAdminHandlers.updateUserRole,
        updateUserProfileAdmin: userAdminHandlers.updateUserProfile,
        getUserAuth: userAdminHandlers.getUserAuth,
        getUserFirestore: userAdminHandlers.getUserFirestore,

        // Tenant browser (system admin)
        listAllTenants: tenantBrowserHandlers.listAllTenants,

        // Auth handlers
        register: authHandlers.register,
        login: authHandlers.login,
        sendPasswordResetEmail: authHandlers.sendPasswordResetEmail,
        sendEmailVerification: authHandlers.sendEmailVerification,

        // Public policy handlers (for policy acceptance modal)
        getCurrentPolicy: async (req, res) => {
            const { policyId } = req.params;
            const result = await policyService.getCurrentPolicy(toPolicyId(policyId));
            res.json(result);
        },

        // Policy text endpoints - return text/plain with tenant-specific substitutions
        getPrivacyPolicyText: policyTextHandlers.getPrivacyPolicyText,
        getTermsOfServiceText: policyTextHandlers.getTermsOfServiceText,
        getCookiePolicyText: policyTextHandlers.getCookiePolicyText,

        // Diagnostic handlers
        getMetrics,
        getHealth,
        headHealth,
        getEnv,
        getConfig,
        getBootstrapConfig,
        reportCspViolation,

        // Test endpoint handlers (only in emulator environments)
        ...(!isRealFirebase()
            ? {
                borrowTestUser,
                returnTestUser,
                promoteTestUserToAdmin,
                createAdminUser,
                clearUserPolicyAcceptances,
            }
            : {}),

        // Tenant settings handlers
        getTenantSettings,
        updateTenantBranding,
        listTenantDomains,
        addTenantDomain,

        // Tenant admin handlers
        adminUpsertTenant: tenantAdminHandlers.upsertTenant,
        publishTenantTheme: tenantAdminHandlers.publishTenantTheme,
        uploadTenantImage: tenantAdminHandlers.uploadTenantImage,

        // Tenant image library handlers
        listTenantImages: tenantImageLibraryHandlers.listImages,
        uploadTenantLibraryImage: tenantImageLibraryHandlers.uploadImage,
        renameTenantImage: tenantImageLibraryHandlers.renameImage,
        deleteTenantImage: tenantImageLibraryHandlers.deleteImage,

        // Theme delivery
        serveThemeCss: themeHandlers.serveThemeCss,

        // URL utilities
        resolveRedirect: urlRedirectHandlers.resolveRedirect,

        // Shareable page handlers (OG tags for social media)
        serveShareablePage: sharingHandlers.serveShareablePage,
    };

    return registry;
}
