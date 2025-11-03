import { ReturnTestUserResponse, SystemUserRoles, TestErrorResponse, TestSuccessResponse } from '@splitifyd/shared';
import type { RequestHandler } from 'express';
import { getConfig as getClientConfig } from './client-config';
import { buildEnvPayload, buildHealthPayload, resolveHealthStatusCode, runHealthChecks } from './endpoints/diagnostics';
import { isEmulator } from './firebase';
import type { IFirestoreDatabase } from './firestore-wrapper';
import { logger } from './logger';
import { metrics, toAggregatedReport } from './monitoring/lightweight-metrics';
import type { IAuthService } from './services/auth';
import { ComponentBuilder } from './services/ComponentBuilder';
import { requireInstanceMode } from './shared/instance-mode';
import { TestUserPoolService } from './test-pool/TestUserPoolService';
import { getEnhancedConfigResponse } from './utils/config-response';

// Handler imports
import { ActivityFeedHandlers } from './activity/ActivityHandlers';
import { UserBrowserHandlers } from './browser/UserBrowserHandlers';
import { CommentHandlers } from './comments/CommentHandlers';
import { ExpenseHandlers } from './expenses/ExpenseHandlers';
import { GroupHandlers } from './groups/GroupHandlers';
import { GroupMemberHandlers } from './groups/GroupMemberHandlers';
import { GroupSecurityHandlers } from './groups/GroupSecurityHandlers';
import { GroupShareHandlers } from './groups/GroupShareHandlers';
import { PolicyHandlers } from './policies/PolicyHandlers';
import { UserHandlers as PolicyUserHandlers } from './policies/UserHandlers';
import { SettlementHandlers } from './settlements/SettlementHandlers';
import { UserHandlers } from './user/UserHandlers';

/**
 * Factory function that creates all application handlers with proper dependency injection.
 * This is the single source of truth for handler instantiation.
 *
 * @param authService - Authentication service implementation (Firebase or stub for testing)
 * @param db - Database implementation (Firestore or test database)
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
    );

    // Services for inline handlers
    const userService = componentBuilder.buildUserService();
    const policyService = componentBuilder.buildPolicyService();
    const firestoreWriter = componentBuilder.buildFirestoreWriter();

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

    const getConfig: RequestHandler = (req, res) => {
        const config = getEnhancedConfigResponse();
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
            return requireInstanceMode() === 'test';
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
            await firestoreWriter.updateUser(decodedToken.uid, {
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

        // Auth handlers (inline)
        register: async (req, res) => {
            const result = await userService.registerUser(req.body);
            res.status(201).json(result);
        },

        // Public policy handlers (inline)
        getCurrentPolicy: async (req, res) => {
            const { id } = req.params;
            const result = await policyService.getCurrentPolicy(id);
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
        clearUserPolicyAcceptances,
    };

    return registry;
}
