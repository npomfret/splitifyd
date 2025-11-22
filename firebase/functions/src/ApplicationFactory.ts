import { ReturnTestUserResponse, TestErrorResponse, TestSuccessResponse } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import { getConfig as getClientConfig, getConfig as getServerConfig } from './client-config';
import { buildEnvPayload, buildHealthPayload, resolveHealthStatusCode, runHealthChecks } from './endpoints/diagnostics';
import { isEmulator } from './firebase';
import type { IFirestoreDatabase } from './firestore-wrapper';
import { logger } from './logger';
import { metrics, toAggregatedReport } from './monitoring/lightweight-metrics';
import type { IAuthService } from './services/auth';
import { ComponentBuilder } from './services/ComponentBuilder';
import { requireInstanceName } from './shared/instance-name';
import { TestUserPoolService } from './test-pool/TestUserPoolService';
import { getEnhancedConfigResponse } from './utils/config-response';
import { UpdateTenantBrandingRequestSchema } from './schemas/tenant';

// Handler imports
import { toPolicyId } from '@billsplit-wl/shared';
import { ActivityFeedHandlers } from './activity/ActivityHandlers';
import { UserAdminHandlers } from './admin/UserAdminHandlers';
import { TenantBrowserHandlers } from './browser/TenantBrowserHandlers';
import { UserBrowserHandlers } from './browser/UserBrowserHandlers';
import { CommentHandlers } from './comments/CommentHandlers';
import { ExpenseHandlers } from './expenses/ExpenseHandlers';
import { GroupHandlers } from './groups/GroupHandlers';
import { GroupMemberHandlers } from './groups/GroupMemberHandlers';
import { GroupSecurityHandlers } from './groups/GroupSecurityHandlers';
import { GroupShareHandlers } from './groups/GroupShareHandlers';
import { PolicyHandlers } from './policies/PolicyHandlers';
import { UserHandlers as PolicyUserHandlers } from './policies/UserHandlers';
import { TenantAdminService } from './services/tenant/TenantAdminService';
import { ThemeArtifactService } from './services/tenant/ThemeArtifactService';
import { SettlementHandlers } from './settlements/SettlementHandlers';
import { TenantAdminHandlers } from './tenant/TenantAdminHandlers';
import { ThemeHandlers } from './theme/ThemeHandlers';
import { UserHandlers } from './user/UserHandlers';
import {toUserId} from "@billsplit-wl/shared";

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
    const db: IFirestoreDatabase = componentBuilder.getDatabase();

    // Instantiate all handler classes
    const settlementHandlers = new SettlementHandlers(componentBuilder.buildSettlementService());
    const groupHandlers = new GroupHandlers(componentBuilder.buildGroupService());
    const groupShareHandlers = new GroupShareHandlers(componentBuilder.buildGroupShareService());
    const groupMemberHandlers = new GroupMemberHandlers(componentBuilder.buildGroupMemberService());
    const expenseHandlers = new ExpenseHandlers(componentBuilder.buildExpenseService());
    const commentHandlers = new CommentHandlers(componentBuilder.buildCommentService());
    const userHandlers = new UserHandlers(componentBuilder.buildUserService());
    const policyHandlers = new PolicyHandlers(componentBuilder.buildPolicyService());
    const policyUserHandlers = new PolicyUserHandlers(componentBuilder.buildUserPolicyService());
    const activityFeedHandlers = new ActivityFeedHandlers(componentBuilder.buildActivityFeedService());
    const groupSecurityHandlers = new GroupSecurityHandlers(
        componentBuilder.buildGroupService(),
        componentBuilder.buildGroupMemberService(),
    );
    const userBrowserHandlers = new UserBrowserHandlers(
        authService,
        db,
        componentBuilder.buildFirestoreReader(),
    );
    const tenantBrowserHandlers = new TenantBrowserHandlers(
        componentBuilder.buildFirestoreReader(),
    );

    // Services for inline handlers
    const userService = componentBuilder.buildUserService();
    const policyService = componentBuilder.buildPolicyService();
    const firestoreWriter = componentBuilder.buildFirestoreWriter();
    const userAdminHandlers = new UserAdminHandlers(authService, firestoreWriter);
    const tenantRegistryService = componentBuilder.buildTenantRegistryService();
    const tenantAdminService = new TenantAdminService(
        componentBuilder.buildFirestoreWriter(),
        componentBuilder.buildFirestoreReader(),
        new ThemeArtifactService(componentBuilder.buildThemeArtifactStorage()),
    );
    const tenantAdminHandlers = new TenantAdminHandlers(tenantAdminService);
    const themeHandlers = new ThemeHandlers(componentBuilder.buildFirestoreReader());

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
        // Get tenant configuration from request context (set by tenant identification middleware)
        // If not present (exempt route), resolve the default tenant
        let tenantContext = (req as any).tenant;

        if (!tenantContext) {
            tenantContext = await tenantRegistryService.resolveTenant({
                host: null,
                overrideTenantId: null,
                allowOverride: false,
            });
        }

        const config = getEnhancedConfigResponse(tenantContext);

        // Cache config: 60s in dev for quick tenant branding updates, 5min in prod for efficiency
        const serverConfig = getServerConfig();
        const cacheMaxAge = serverConfig.isProduction ? 300 : 60;
        res.setHeader('Cache-Control', `public, max-age=${cacheMaxAge}, must-revalidate`);
        res.json(config);
    };

    const reportCspViolation: RequestHandler = (req, res) => {
        try {
            res.status(204).send();
        } catch (error) {
            logger.error('Error processing CSP violation report', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };

    // Test endpoint handlers (only active in non-production)
    const config = getClientConfig();

    const isTestEnvironment = (): boolean => {
        try {
            return requireInstanceName() === 'dev1';
        } catch {
            return false;
        }
    };

    const isPoolEnabled = (): boolean => isEmulator() || isTestEnvironment();

    const testPool = TestUserPoolService.getInstance(firestoreWriter, userService, authService);

    const borrowTestUser: RequestHandler = async (req, res) => {
        if (!isPoolEnabled()) {
            res.status(403).json({ error: 'Test pool only available in emulator or test environments' });
            return;
        }

        try {
            const poolUser = await testPool.borrowUser();
            res.json(poolUser);
        } catch (error: any) {
            logger.error('Failed to borrow test user', error);
            res.status(500).json({
                error: 'Failed to borrow test user',
                details: error.message,
            });
        }
    };

    const returnTestUser: RequestHandler = async (req, res) => {
        if (!isPoolEnabled()) {
            res.status(403).json({ error: 'Test pool only available in emulator or test environments' });
            return;
        }

        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Email required' });
            return;
        }

        try {
            await testPool.returnUser(email);

            const response: ReturnTestUserResponse = {
                message: 'User returned to pool',
                email,
            };
            res.json(response);
        } catch (error: any) {
            logger.error('Failed to return test user', error);
            res.status(500).json({
                error: 'Failed to return test user',
                details: error.message,
            });
        }
    };

    const promoteTestUserToAdmin: RequestHandler = async (req, res) => {
        if (!isPoolEnabled()) {
            res.status(403).json({ error: 'Test pool only available in emulator or test environments' });
            return;
        }

        const { uid } = req.body;

        if (!uid) {
            res.status(400).json({ error: 'User ID required' });
            return;
        }

        try {
            // Update Firestore document only
            await firestoreWriter.promoteUserToAdmin(uid);
            res.json({ message: 'User promoted to admin', uid });
        } catch (error: any) {
            logger.error('Failed to promote user to admin', error);
            res.status(500).json({
                error: 'Failed to promote user to admin',
                details: error.message,
            });
        }
    };

    const clearUserPolicyAcceptances: RequestHandler = async (req, res) => {
        if (config.isProduction) {
            const response: TestErrorResponse = {
                error: {
                    code: 'FORBIDDEN',
                    message: 'Test endpoints not available in production',
                },
            };
            res.status(403).json(response);
            return;
        }

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

    const testPromoteToAdmin: RequestHandler = async (req, res) => {
        if (config.isProduction) {
            const response: TestErrorResponse = {
                error: {
                    code: 'FORBIDDEN',
                    message: 'Test endpoints not available in production',
                },
            };
            res.status(403).json(response);
            return;
        }

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
            await firestoreWriter.promoteUserToAdmin(toUserId(decodedToken.uid));

            logger.info('User promoted to admin', {
                userId: decodedToken.uid,
            });

            const response: TestSuccessResponse = {
                success: true,
                message: 'User promoted to system admin',
            };
            res.json(response);
        } catch (error) {
            logger.error('Failed to promote user to admin', error as Error, {
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
            const tenantRecord = await tenantRegistryService.resolveTenant({
                host: null,
                overrideTenantId: tenantId,
                allowOverride: true,
            });

            res.json({
                tenantId: tenantRecord.tenantId,
                config: tenantRecord.config,
                domains: tenantRecord.domains,
                primaryDomain: tenantRecord.primaryDomain,
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

            res.json({
                message: 'Tenant branding updated successfully',
            });
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

            const tenantRecord = await tenantRegistryService.resolveTenant({
                host: null,
                overrideTenantId: tenantId,
                allowOverride: true,
            });

            res.json({
                domains: tenantRecord.domains,
                primaryDomain: tenantRecord.primaryDomain,
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

        // Settlement handlers
        createSettlement: settlementHandlers.createSettlement,
        updateSettlement: settlementHandlers.updateSettlement,
        deleteSettlement: settlementHandlers.deleteSettlement,

        // Comment handlers
        createComment: commentHandlers.createComment,
        createCommentForExpense: commentHandlers.createComment,
        listGroupComments: commentHandlers.listGroupComments,
        listExpenseComments: commentHandlers.listExpenseComments,

        // User handlers
        getUserProfile: userHandlers.getUserProfile,
        updateUserProfile: userHandlers.updateUserProfile,
        changePassword: userHandlers.changePassword,
        changeEmail: userHandlers.changeEmail,

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

        // User browser (admin)
        listAuthUsers: userBrowserHandlers.listAuthUsers,
        listFirestoreUsers: userBrowserHandlers.listFirestoreUsers,

        // User admin (system admin)
        updateUserAdmin: userAdminHandlers.updateUser,
        updateUserRoleAdmin: userAdminHandlers.updateUserRole,

        // Tenant browser (system admin)
        listAllTenants: tenantBrowserHandlers.listAllTenants,

        // Auth handlers (inline)
        register: async (req, res) => {
            const result = await userService.registerUser(req.body);
            res.status(201).json(result);
        },

        // Public policy handlers (inline)
        getCurrentPolicy: async (req, res) => {
            const { id } = req.params;
            const result = await policyService.getCurrentPolicy(toPolicyId(id));
            res.json(result);
        },

        // Diagnostic handlers
        getMetrics,
        getHealth,
        headHealth,
        getEnv,
        getConfig,
        reportCspViolation,

        // Test endpoint handlers
        borrowTestUser,
        returnTestUser,
        promoteTestUserToAdmin,
        clearUserPolicyAcceptances,
        testPromoteToAdmin,

        // Tenant settings handlers
        getTenantSettings,
        updateTenantBranding,
        listTenantDomains,
        addTenantDomain,

        // Tenant admin handlers
        adminUpsertTenant: tenantAdminHandlers.upsertTenant,
        publishTenantTheme: tenantAdminHandlers.publishTenantTheme,

        // Theme delivery
        serveThemeCss: themeHandlers.serveThemeCss,
    };

    return registry;
}
