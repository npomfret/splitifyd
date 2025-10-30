import type { RequestHandler } from 'express';
import { ComponentBuilder } from './services/ComponentBuilder';
import type { IAuthService } from './services/auth';
import type { IFirestoreDatabase } from './firestore-wrapper';
import { buildEnvPayload, buildHealthPayload, resolveHealthStatusCode, runHealthChecks } from './endpoints/diagnostics';
import { getConfig as getClientConfig } from './client-config';
import { getEnhancedConfigResponse } from './utils/config-response';
import { metrics, toAggregatedReport } from './monitoring/lightweight-metrics';
import { logger } from './logger';

// Handler imports
import { GroupHandlers } from './groups/GroupHandlers';
import { GroupShareHandlers } from './groups/GroupShareHandlers';
import { GroupMemberHandlers } from './groups/GroupMemberHandlers';
import { GroupSecurityHandlers } from './groups/GroupSecurityHandlers';
import { ExpenseHandlers } from './expenses/ExpenseHandlers';
import { SettlementHandlers } from './settlements/SettlementHandlers';
import { CommentHandlers } from './comments/CommentHandlers';
import { UserHandlers } from './user/UserHandlers';
import { PolicyHandlers } from './policies/PolicyHandlers';
import { UserHandlers as PolicyUserHandlers } from './policies/UserHandlers';
import { ActivityFeedHandlers } from './activity/ActivityHandlers';
import { UserBrowserHandlers } from './browser/UserBrowserHandlers';

/**
 * Optional test handlers that can be included in the registry
 */
export interface TestHandlers {
    borrowTestUser: RequestHandler;
    returnTestUser: RequestHandler;
    testClearPolicyAcceptances: RequestHandler;
    testPromoteToAdmin: RequestHandler;
}

/**
 * Factory function that creates all application handlers with proper dependency injection.
 * This is the single source of truth for handler instantiation.
 *
 * @param authService - Authentication service implementation (Firebase or stub for testing)
 * @param db - Database implementation (Firestore or test database)
 * @param testHandlers - Optional test handlers (only provided in non-production environments)
 * @returns Record mapping handler names to handler functions
 */
export function createHandlerRegistry(
    authService: IAuthService,
    db: IFirestoreDatabase,
    testHandlers?: TestHandlers
): Record<string, RequestHandler> {
    // Create ComponentBuilder with injected dependencies
    const componentBuilder = new ComponentBuilder(authService, db);

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

    // User service for auth handlers
    const userService = componentBuilder.buildUserService();
    const policyService = componentBuilder.buildPolicyService();

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
    };

    // Add test handlers if provided
    if (testHandlers) {
        registry.borrowTestUser = testHandlers.borrowTestUser;
        registry.returnTestUser = testHandlers.returnTestUser;
        registry.testClearPolicyAcceptances = testHandlers.testClearPolicyAcceptances;
        registry.testPromoteToAdmin = testHandlers.testPromoteToAdmin;
    }

    return registry;
}
