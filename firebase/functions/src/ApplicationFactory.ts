import type { RequestHandler } from 'express';
import { ComponentBuilder } from './services/ComponentBuilder';
import type { IAuthService } from './services/auth';
import type { IFirestoreDatabase } from './firestore-wrapper';
import { FirestoreWriter } from './services/firestore';

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
 * Factory function that creates all application handlers with proper dependency injection.
 * This is the single source of truth for handler instantiation.
 *
 * @param authService - Authentication service implementation (Firebase or stub for testing)
 * @param db - Database implementation (Firestore or test database)
 * @returns Record mapping handler names to handler functions
 */
export function createHandlerRegistry(
    authService: IAuthService,
    db: IFirestoreDatabase
): Record<string, RequestHandler> {
    // Create ComponentBuilder with injected dependencies
    const componentBuilder = new ComponentBuilder(authService, db);
    const firestoreWriter = componentBuilder.buildFirestoreWriter();

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

    // Return handler registry
    return {
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
    };
}
