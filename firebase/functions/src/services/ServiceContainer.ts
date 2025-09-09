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
    GroupMemberDocument
} from '@splitifyd/shared';
import type { UserWithProfile, ExpenseListResponse, SettlementsData } from './IServiceProvider';
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
import { NotificationService } from './notification-service';
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
    private notificationService?: NotificationService;

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly firestore: Firestore
    ) {}

    // ========================================================================
    // Service Getters (Lazy Initialization)
    // ========================================================================

    public getUserService(): UserService {
        if (!this.userService) {
            this.userService = new UserService(this.firestoreReader, this.firestoreWriter);
        }
        return this.userService;
    }

    public getGroupMemberService(): GroupMemberService {
        if (!this.groupMemberService) {
            this.groupMemberService = new GroupMemberService(
                this.firestoreReader
            );
        }
        return this.groupMemberService;
    }

    public getExpenseService(): ExpenseService {
        if (!this.expenseService) {
            this.expenseService = new ExpenseService(
                this.firestoreReader,
                this.firestoreWriter,
                this // Pass the container as IServiceProvider
            );
        }
        return this.expenseService;
    }

    public getSettlementService(): SettlementService {
        if (!this.settlementService) {
            this.settlementService = new SettlementService(
                this.firestoreReader
            );
        }
        return this.settlementService;
    }

    public getExpenseMetadataService(): ExpenseMetadataService {
        if (!this.expenseMetadataService) {
            this.expenseMetadataService = new ExpenseMetadataService(this.firestoreReader);
        }
        return this.expenseMetadataService;
    }

    public getBalanceCalculationService(): BalanceCalculationService {
        if (!this.balanceCalculationService) {
            this.balanceCalculationService = new BalanceCalculationService(
                this.firestoreReader
            );
        }
        return this.balanceCalculationService;
    }

    public getGroupService(): GroupService {
        if (!this.groupService) {
            this.groupService = new GroupService(
                this.firestoreReader,
                this.firestoreWriter,
                this // Pass the container as IServiceProvider
            );
        }
        return this.groupService;
    }

    public getCommentService(): CommentService {
        if (!this.commentService) {
            this.commentService = new CommentService(this.firestoreReader);
        }
        return this.commentService;
    }

    public getPolicyService(): PolicyService {
        if (!this.policyService) {
            this.policyService = new PolicyService(this.firestoreReader);
        }
        return this.policyService;
    }

    public getUserPolicyService(): UserPolicyService {
        if (!this.userPolicyService) {
            this.userPolicyService = new UserPolicyService(this.firestoreReader);
        }
        return this.userPolicyService;
    }

    public getGroupPermissionService(): GroupPermissionService {
        if (!this.groupPermissionService) {
            this.groupPermissionService = new GroupPermissionService(
                this.firestoreReader, 
                this.firestoreWriter
            );
        }
        return this.groupPermissionService;
    }

    public getGroupShareService(): GroupShareService {
        if (!this.groupShareService) {
            this.groupShareService = new GroupShareService(this.firestoreReader);
        }
        return this.groupShareService;
    }

    public getFirestoreValidationService(): FirestoreValidationService {
        if (!this.firestoreValidationService) {
            this.firestoreValidationService = FirestoreValidationService.getInstance();
        }
        return this.firestoreValidationService;
    }

    public getNotificationService(): NotificationService {
        if (!this.notificationService) {
            this.notificationService = new NotificationService(
                this.firestore,
                this.firestoreReader
            );
        }
        return this.notificationService;
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
        const result = await this.getExpenseService().listGroupExpenses(groupId, userId, options);
        return {
            ...result,
            hasNext: result.hasMore
        };
    }

    async getExpenseMetadata(groupId: string): Promise<ExpenseMetadata> {
        const metadata = await this.getExpenseMetadataService().calculateExpenseMetadata(groupId);
        return {
            totalExpenses: metadata.expenseCount,
            totalAmount: 0, // TODO: implement totalAmount calculation
            currencies: [], // TODO: implement currencies calculation
            dateRange: undefined // TODO: implement date range
        };
    }

    async getGroupSettlementsData(groupId: string, options: SettlementListOptions): Promise<SettlementsData> {
        const result = await this.getSettlementService()._getGroupSettlementsData(groupId, options);
        return {
            ...result,
            hasNext: result.hasMore
        };
    }

    async runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T> {
        return this.firestoreWriter.runTransaction(updateFunction);
    }

    public getFirestoreReader(): IFirestoreReader {
        return this.firestoreReader;
    }

    public getFirestoreWriter(): IFirestoreWriter {
        return this.firestoreWriter;
    }
}