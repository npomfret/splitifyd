import { ServiceRegistry } from './ServiceRegistry';
import { UserService } from './UserService2';
import { GroupService } from './GroupService';
import { ExpenseService } from './ExpenseService';
import { SettlementService } from './SettlementService';
import { CommentService } from './CommentService';
import { PolicyService } from './PolicyService';
import { UserPolicyService } from './UserPolicyService';
import { GroupMemberService } from './GroupMemberService';
import { GroupPermissionService } from './GroupPermissionService';
import { GroupShareService } from './GroupShareService';
import { FirestoreValidationService } from './FirestoreValidationService';
import { FirestoreReader } from './firestore/FirestoreReader';
import type { IFirestoreReader } from './firestore/IFirestoreReader';

/**
 * Register all services with the ServiceRegistry
 * 
 * This module registers all services using factory functions for lazy initialization.
 * Each service is registered as a singleton that gets created only when first requested.
 */

// Singleton instances (will be created lazily)
let userServiceInstance: UserService | null = null;
let groupServiceInstance: GroupService | null = null;
let expenseServiceInstance: ExpenseService | null = null;
let settlementServiceInstance: SettlementService | null = null;
let commentServiceInstance: CommentService | null = null;
let policyServiceInstance: PolicyService | null = null;
let userPolicyServiceInstance: UserPolicyService | null = null;
let groupMemberServiceInstance: GroupMemberService | null = null;
let groupPermissionServiceInstance: GroupPermissionService | null = null;
let groupShareServiceInstance: GroupShareService | null = null;
let firestoreValidationServiceInstance: FirestoreValidationService | null = null;
let firestoreReaderInstance: IFirestoreReader | null = null;

/**
 * Initialize all service registrations
 */
export function registerAllServices(): void {
    const registry = ServiceRegistry.getInstance();

    // Register services with factory functions for lazy initialization
    registry.registerService('UserService', () => {
        if (!userServiceInstance) {
            const firestoreReader = getFirestoreReader();
            userServiceInstance = new UserService(firestoreReader);
        }
        return userServiceInstance;
    });

    registry.registerService('GroupService', () => {
        if (!groupServiceInstance) {
            const firestoreReader = getFirestoreReader();
            groupServiceInstance = new GroupService(firestoreReader);
        }
        return groupServiceInstance;
    });

    registry.registerService('ExpenseService', () => {
        if (!expenseServiceInstance) {
            expenseServiceInstance = new ExpenseService();
        }
        return expenseServiceInstance;
    });

    registry.registerService('SettlementService', () => {
        if (!settlementServiceInstance) {
            settlementServiceInstance = new SettlementService();
        }
        return settlementServiceInstance;
    });

    registry.registerService('CommentService', () => {
        if (!commentServiceInstance) {
            commentServiceInstance = new CommentService();
        }
        return commentServiceInstance;
    });

    registry.registerService('PolicyService', () => {
        if (!policyServiceInstance) {
            policyServiceInstance = new PolicyService();
        }
        return policyServiceInstance;
    });

    registry.registerService('UserPolicyService', () => {
        if (!userPolicyServiceInstance) {
            userPolicyServiceInstance = new UserPolicyService();
        }
        return userPolicyServiceInstance;
    });

    registry.registerService('GroupMemberService', () => {
        if (!groupMemberServiceInstance) {
            groupMemberServiceInstance = new GroupMemberService();
        }
        return groupMemberServiceInstance;
    });

    registry.registerService('GroupPermissionService', () => {
        if (!groupPermissionServiceInstance) {
            groupPermissionServiceInstance = new GroupPermissionService();
        }
        return groupPermissionServiceInstance;
    });

    registry.registerService('GroupShareService', () => {
        if (!groupShareServiceInstance) {
            groupShareServiceInstance = new GroupShareService();
        }
        return groupShareServiceInstance;
    });

    registry.registerService('FirestoreValidationService', () => {
        if (!firestoreValidationServiceInstance) {
            firestoreValidationServiceInstance = FirestoreValidationService.getInstance();
        }
        return firestoreValidationServiceInstance;
    });

    registry.registerService('FirestoreReader', () => {
        if (!firestoreReaderInstance) {
            firestoreReaderInstance = new FirestoreReader();
        }
        return firestoreReaderInstance;
    });
}

/**
 * Service name constants for type-safe service retrieval
 */
export const SERVICE_NAMES = {
    USER_SERVICE: 'UserService',
    GROUP_SERVICE: 'GroupService',
    EXPENSE_SERVICE: 'ExpenseService',
    SETTLEMENT_SERVICE: 'SettlementService',
    COMMENT_SERVICE: 'CommentService',
    POLICY_SERVICE: 'PolicyService',
    USER_POLICY_SERVICE: 'UserPolicyService',
    GROUP_MEMBER_SERVICE: 'GroupMemberService',
    GROUP_PERMISSION_SERVICE: 'GroupPermissionService',
    GROUP_SHARE_SERVICE: 'GroupShareService',
    FIRESTORE_VALIDATION_SERVICE: 'FirestoreValidationService',
    FIRESTORE_READER: 'FirestoreReader'
} as const;

/**
 * Type-safe service getters
 */
export function getUserService(): UserService {
    return ServiceRegistry.getInstance().getService<UserService>(SERVICE_NAMES.USER_SERVICE);
}

export function getGroupService(): GroupService {
    return ServiceRegistry.getInstance().getService<GroupService>(SERVICE_NAMES.GROUP_SERVICE);
}

export function getExpenseService(): ExpenseService {
    return ServiceRegistry.getInstance().getService<ExpenseService>(SERVICE_NAMES.EXPENSE_SERVICE);
}

export function getSettlementService(): SettlementService {
    return ServiceRegistry.getInstance().getService<SettlementService>(SERVICE_NAMES.SETTLEMENT_SERVICE);
}

export function getCommentService(): CommentService {
    return ServiceRegistry.getInstance().getService<CommentService>(SERVICE_NAMES.COMMENT_SERVICE);
}

export function getPolicyService(): PolicyService {
    return ServiceRegistry.getInstance().getService<PolicyService>(SERVICE_NAMES.POLICY_SERVICE);
}

export function getUserPolicyService(): UserPolicyService {
    return ServiceRegistry.getInstance().getService<UserPolicyService>(SERVICE_NAMES.USER_POLICY_SERVICE);
}

export function getGroupMemberService(): GroupMemberService {
    return ServiceRegistry.getInstance().getService<GroupMemberService>(SERVICE_NAMES.GROUP_MEMBER_SERVICE);
}

export function getGroupPermissionService(): GroupPermissionService {
    return ServiceRegistry.getInstance().getService<GroupPermissionService>(SERVICE_NAMES.GROUP_PERMISSION_SERVICE);
}

export function getGroupShareService(): GroupShareService {
    return ServiceRegistry.getInstance().getService<GroupShareService>(SERVICE_NAMES.GROUP_SHARE_SERVICE);
}

export function getFirestoreValidationService(): FirestoreValidationService {
    return ServiceRegistry.getInstance().getService<FirestoreValidationService>(SERVICE_NAMES.FIRESTORE_VALIDATION_SERVICE);
}

export function getFirestoreReader(): IFirestoreReader {
    return ServiceRegistry.getInstance().getService<IFirestoreReader>(SERVICE_NAMES.FIRESTORE_READER);
}