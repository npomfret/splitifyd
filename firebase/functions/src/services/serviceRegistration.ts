import { ServiceContainer } from './ServiceContainer';
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
import { ExpenseMetadataService } from './expenseMetadataService';
import { FirestoreValidationService } from './FirestoreValidationService';
import { FirestoreReader } from './firestore/FirestoreReader';
import { FirestoreWriter } from './firestore/FirestoreWriter';
import type { IFirestoreReader } from './firestore/IFirestoreReader';
import type { IFirestoreWriter } from './firestore/IFirestoreWriter';
import { Firestore } from "firebase-admin/firestore";

// Legacy SERVICE_NAMES for backward compatibility
export const SERVICE_NAMES = {
    USER_SERVICE: 'UserService' as const,
    GROUP_SERVICE: 'GroupService' as const,
    EXPENSE_SERVICE: 'ExpenseService' as const,
    SETTLEMENT_SERVICE: 'SettlementService' as const,
    COMMENT_SERVICE: 'CommentService' as const,
    POLICY_SERVICE: 'PolicyService' as const,
    USER_POLICY_SERVICE: 'UserPolicyService' as const,
    GROUP_MEMBER_SERVICE: 'GroupMemberService' as const,
    GROUP_PERMISSION_SERVICE: 'GroupPermissionService' as const,
    GROUP_SHARE_SERVICE: 'GroupShareService' as const,
    EXPENSE_METADATA_SERVICE: 'ExpenseMetadataService' as const,
    FIRESTORE_VALIDATION_SERVICE: 'FirestoreValidationService' as const,
    FIRESTORE_READER: 'FirestoreReader' as const,
    FIRESTORE_WRITER: 'FirestoreWriter' as const,
} as const;

/**
 * Legacy service registration - now delegates to ServiceContainer
 * 
 * This provides backward compatibility while using the new ServiceContainer under the hood
 */

let serviceContainer: ServiceContainer | null = null;

/**
 * Set the ServiceContainer instance (called from index.ts)
 */
export function setServiceContainer(container: ServiceContainer): void {
    serviceContainer = container;
}

/**
 * Initialize services using ServiceContainer and register them in ServiceRegistry for backward compatibility
 */
export function registerAllServices(firestore: Firestore): void {
    if (!serviceContainer) {
        // Create ServiceContainer directly for tests and other contexts
        const firestoreReader = new FirestoreReader(firestore);
        const firestoreWriter = new FirestoreWriter(firestore);
        serviceContainer = new ServiceContainer(firestoreReader, firestoreWriter, firestore);
        
        // Register all services in ServiceRegistry for backward compatibility
        const registry = ServiceRegistry.getInstance();
        registry.clearServices();
        
        registry.registerService('UserService', () => serviceContainer!.getUserService());
        registry.registerService('GroupService', () => serviceContainer!.getGroupService());
        registry.registerService('ExpenseService', () => serviceContainer!.getExpenseService());
        registry.registerService('SettlementService', () => serviceContainer!.getSettlementService());
        registry.registerService('CommentService', () => serviceContainer!.getCommentService());
        registry.registerService('PolicyService', () => serviceContainer!.getPolicyService());
        registry.registerService('UserPolicyService', () => serviceContainer!.getUserPolicyService());
        registry.registerService('GroupMemberService', () => serviceContainer!.getGroupMemberService());
        registry.registerService('GroupPermissionService', () => serviceContainer!.getGroupPermissionService());
        registry.registerService('GroupShareService', () => serviceContainer!.getGroupShareService());
        registry.registerService('FirestoreValidationService', () => serviceContainer!.getFirestoreValidationService());
        registry.registerService('ExpenseMetadataService', () => serviceContainer!.getExpenseMetadataService());
        registry.registerService('FirestoreReader', () => serviceContainer!.getFirestoreReader());
        registry.registerService('FirestoreWriter', () => serviceContainer!.getFirestoreWriter());
    }
}

/**
 * Type-safe service getters - now delegates to ServiceContainer
 */
export function getUserService(): UserService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getUserService();
}

export function getGroupService(): GroupService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getGroupService();
}

export function getExpenseService(): ExpenseService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getExpenseService();
}

export function getSettlementService(): SettlementService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getSettlementService();
}

export function getCommentService(): CommentService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getCommentService();
}

export function getPolicyService(): PolicyService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getPolicyService();
}

export function getUserPolicyService(): UserPolicyService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getUserPolicyService();
}

export function getGroupMemberService(): GroupMemberService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getGroupMemberService();
}

export function getGroupPermissionService(): GroupPermissionService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getGroupPermissionService();
}

export function getGroupShareService(): GroupShareService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getGroupShareService();
}

export function getFirestoreValidationService(): FirestoreValidationService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getFirestoreValidationService();
}

export function getExpenseMetadataService(): ExpenseMetadataService {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getExpenseMetadataService();
}

export function getFirestoreReader(): IFirestoreReader {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getFirestoreReader();
}

export function getFirestoreWriter(): IFirestoreWriter {
    if (!serviceContainer) throw new Error('ServiceContainer not initialized');
    return serviceContainer.getFirestoreWriter();
}
