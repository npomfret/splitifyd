/**
 * Service Container Implementation
 * 
 * Concrete implementation of IServiceProvider that manages service lifecycle
 * and provides dependency injection without circular dependencies.
 * 
 * This container:
 * - Implements IServiceProvider interface
 * - Manages lazy initialization of all services
 * - Prevents circular dependencies during construction
 * - Provides clean access to cross-service operations
 */

import type { Transaction } from 'firebase-admin/firestore';
import type { 
    IServiceProvider, 
    ExpenseListOptions, 
    SettlementListOptions, 
    ExpenseMetadata 
} from './IServiceProvider';
import type {
    GroupMembersResponse,
    GroupMemberDocument,
    UserWithProfile,
    ExpenseListResponse,
    SettlementsData
} from '@splitifyd/shared';
import type { IFirestoreReader } from './firestore/IFirestoreReader';
import type { IFirestoreWriter } from './firestore/IFirestoreWriter';

// Import all services that will be managed by this container
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
import { BalanceCalculationService } from './balance/BalanceCalculationService';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Service container that implements IServiceProvider and manages all service instances
 */
export class ServiceContainer implements IServiceProvider {
    // Service instances (lazy-initialized)
    private userService?: UserService;
    private groupService?: GroupService;
    private expenseService?: ExpenseService;
    private settlementService?: SettlementService;
    private commentService?: CommentService;
    private policyService?: PolicyService;
    private userPolicyService?: UserPolicyService;
    private groupMemberService?: GroupMemberService;
    private groupPermissionService?: GroupPermissionService;
    private groupShareService?: GroupShareService;
    private expenseMetadataService?: ExpenseMetadataService;
    private firestoreValidationService?: FirestoreValidationService;
    private balanceCalculationService?: BalanceCalculationService;

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly firestore: Firestore
    ) {}

    // ========================================================================
    // Service Getters (Lazy Initialization)
    // ========================================================================

    private getUserService(): UserService {
        if (!this.userService) {
            this.userService = new UserService(this.firestoreReader, this.firestoreWriter);
        }
        return this.userService;
    }

    private getGroupMemberService(): GroupMemberService {
        if (!this.groupMemberService) {
            this.groupMemberService = new GroupMemberService(
                this.firestoreReader,
                this.firestoreWriter,
                this // Pass the container as IServiceProvider
            );
        }
        return this.groupMemberService;
    }

    private getExpenseService(): ExpenseService {
        if (!this.expenseService) {
            this.expenseService = new ExpenseService(
                this.firestoreReader,
                this.firestoreWriter,
                this.firestore, // TODO: remove this when ExpenseService is fully refactored
                this // Pass the container as IServiceProvider
            );
        }
        return this.expenseService;
    }

    private getSettlementService(): SettlementService {
        if (!this.settlementService) {
            this.settlementService = new SettlementService(
                this.firestoreReader,
                this // Pass the container as IServiceProvider
            );
        }
        return this.settlementService;
    }

    private getExpenseMetadataService(): ExpenseMetadataService {
        if (!this.expenseMetadataService) {
            this.expenseMetadataService = new ExpenseMetadataService(this.firestoreReader);
        }
        return this.expenseMetadataService;
    }

    private getBalanceCalculationService(): BalanceCalculationService {
        if (!this.balanceCalculationService) {
            this.balanceCalculationService = new BalanceCalculationService(
                this.firestoreReader,
                this // Pass the container as IServiceProvider
            );
        }
        return this.balanceCalculationService;
    }

    // ========================================================================
    // IServiceProvider Implementation
    // ========================================================================

    async getUserProfiles(userIds: string[]): Promise<Map<string, UserWithProfile>> {
        return this.getUserService().getUsers(userIds);
    }

    async getGroupMembers(groupId: string): Promise<GroupMembersResponse> {
        return this.getGroupMemberService().getGroupMembersResponseFromSubcollection(groupId);
    }

    async getGroupMember(groupId: string, userId: string): Promise<GroupMemberDocument | null> {
        return this.getGroupMemberService().getMemberFromSubcollection(groupId, userId);
    }

    async getMembersFromSubcollection(groupId: string): Promise<GroupMemberDocument[]> {
        return this.getGroupMemberService().getMembersFromSubcollection(groupId);
    }

    async listGroupExpenses(groupId: string, userId: string, options: ExpenseListOptions): Promise<ExpenseListResponse> {
        return this.getExpenseService().listGroupExpenses(groupId, userId, options);
    }

    async getExpenseMetadata(groupId: string): Promise<ExpenseMetadata> {
        const metadata = await this.getExpenseMetadataService().calculateExpenseMetadata(groupId);
        return {
            totalExpenses: metadata.count,
            totalAmount: metadata.totalAmount || 0,
            currencies: metadata.currencies || [],
            dateRange: metadata.dateRange
        };
    }

    async getGroupSettlementsData(groupId: string, options: SettlementListOptions): Promise<SettlementsData> {
        return this.getSettlementService()._getGroupSettlementsData(groupId, options);
    }

    async runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T> {
        return this.firestoreWriter.runTransaction(updateFunction);
    }
}