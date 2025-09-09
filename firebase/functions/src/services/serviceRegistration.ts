import { ServiceRegistry, SERVICE_NAMES } from './ServiceRegistry';
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
import { ExpenseMetadataService } from './expenseMetadataService';
import { FirestoreValidationService } from './FirestoreValidationService';
import { FirestoreReader } from './firestore/FirestoreReader';
import { FirestoreWriter } from './firestore/FirestoreWriter';
import { NotificationService } from './notification-service';
import { ServiceContainer } from './ServiceContainer';
import type { IFirestoreReader } from './firestore/IFirestoreReader';
import type { IFirestoreWriter } from './firestore/IFirestoreWriter';
import type { IServiceProvider } from './IServiceProvider';
import { Firestore } from "firebase-admin/firestore";

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
let expenseMetadataServiceInstance: ExpenseMetadataService | null = null;
let firestoreValidationServiceInstance: FirestoreValidationService | null = null;
let firestoreReaderInstance: IFirestoreReader | null = null;
let firestoreWriterInstance: IFirestoreWriter | null = null;
let notificationServiceInstance: NotificationService | null = null;

/**
 * Initialize all service registrations
 */
export function registerAllServices(firestore: Firestore): void {
    const registry = ServiceRegistry.getInstance();

    const firestoreReader: IFirestoreReader = new FirestoreReader(firestore);
    const firestoreWriter: IFirestoreWriter = new FirestoreWriter(firestore);
    const serviceProvider: IServiceProvider = new ServiceContainer(firestoreReader, firestoreWriter, firestore);
    // Register services with factory functions for lazy initialization
    registry.registerService('UserService', () => {
        if (!userServiceInstance) {
            userServiceInstance = new UserService(firestoreReader, firestoreWriter);
        }
        return userServiceInstance;
    });

    registry.registerService('GroupService', () => {
        if (!groupServiceInstance) {
            groupServiceInstance = new GroupService(firestoreReader, firestoreWriter, serviceProvider);
        }
        return groupServiceInstance;
    });

    registry.registerService('ExpenseService', () => {
        if (!expenseServiceInstance) {
            expenseServiceInstance = new ExpenseService(firestoreReader, firestoreWriter, serviceProvider);
        }
        return expenseServiceInstance;
    });

    registry.registerService('SettlementService', () => {
        if (!settlementServiceInstance) {
            settlementServiceInstance = new SettlementService(firestoreReader, firestoreWriter);
        }
        return settlementServiceInstance;
    });

    registry.registerService('CommentService', () => {
        if (!commentServiceInstance) {
            commentServiceInstance = new CommentService(firestoreReader);
        }
        return commentServiceInstance;
    });

    registry.registerService('PolicyService', () => {
        if (!policyServiceInstance) {
            policyServiceInstance = new PolicyService(firestoreReader);
        }
        return policyServiceInstance;
    });

    registry.registerService('UserPolicyService', () => {
        if (!userPolicyServiceInstance) {
            userPolicyServiceInstance = new UserPolicyService(firestoreReader);
        }
        return userPolicyServiceInstance;
    });

    registry.registerService('GroupMemberService', () => {
        if (!groupMemberServiceInstance) {
            groupMemberServiceInstance = new GroupMemberService(firestoreReader);
        }
        return groupMemberServiceInstance;
    });

    registry.registerService('GroupPermissionService', () => {
        if (!groupPermissionServiceInstance) {
            groupPermissionServiceInstance = new GroupPermissionService(firestoreReader, firestoreWriter);
        }
        return groupPermissionServiceInstance;
    });

    registry.registerService('GroupShareService', () => {
        if (!groupShareServiceInstance) {
            groupShareServiceInstance = new GroupShareService(firestoreReader, firestoreWriter);
        }
        return groupShareServiceInstance;
    });

    registry.registerService('ExpenseMetadataService', () => {
        if (!expenseMetadataServiceInstance) {
            expenseMetadataServiceInstance = new ExpenseMetadataService(firestoreReader);
        }
        return expenseMetadataServiceInstance;
    });

    registry.registerService('FirestoreValidationService', () => {
        if (!firestoreValidationServiceInstance) {
            firestoreValidationServiceInstance = FirestoreValidationService.getInstance();
        }
        return firestoreValidationServiceInstance;
    });

    registry.registerService('FirestoreReader', () => {
        if (!firestoreReaderInstance) {
            firestoreReaderInstance = firestoreReader;
        }
        return firestoreReaderInstance;
    });

    registry.registerService('FirestoreWriter', () => {
        if (!firestoreWriterInstance) {
            firestoreWriterInstance = firestoreWriter;
        }
        return firestoreWriterInstance;
    });

    registry.registerService('NotificationService', () => {
        if (!notificationServiceInstance) {
            notificationServiceInstance = new NotificationService(firestoreReader, firestoreWriter);
        }
        return notificationServiceInstance;
    });
}

// Re-export SERVICE_NAMES for backward compatibility
export { SERVICE_NAMES };

/**
 * Type-safe service getters
 */
/**
 * Type-safe service getters - now with automatic type inference from ServiceRegistry
 */
export function getUserService(): UserService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.USER_SERVICE);
}

export function getGroupService(): GroupService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.GROUP_SERVICE);
}

export function getExpenseService(): ExpenseService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.EXPENSE_SERVICE);
}

export function getSettlementService(): SettlementService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.SETTLEMENT_SERVICE);
}

export function getCommentService(): CommentService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.COMMENT_SERVICE);
}

export function getPolicyService(): PolicyService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.POLICY_SERVICE);
}

export function getUserPolicyService(): UserPolicyService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.USER_POLICY_SERVICE);
}

export function getGroupMemberService(): GroupMemberService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.GROUP_MEMBER_SERVICE);
}

export function getGroupPermissionService(): GroupPermissionService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.GROUP_PERMISSION_SERVICE);
}

export function getGroupShareService(): GroupShareService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.GROUP_SHARE_SERVICE);
}

export function getFirestoreValidationService(): FirestoreValidationService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.FIRESTORE_VALIDATION_SERVICE);
}

export function getExpenseMetadataService(): ExpenseMetadataService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.EXPENSE_METADATA_SERVICE);
}

export function getFirestoreReader(): IFirestoreReader {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.FIRESTORE_READER);
}

export function getFirestoreWriter(): IFirestoreWriter {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.FIRESTORE_WRITER);
}

export function getNotificationService(): NotificationService {
    return ServiceRegistry.getInstance().getService(SERVICE_NAMES.NOTIFICATION_SERVICE);
}
