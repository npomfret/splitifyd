import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { createFirestoreDatabase, IFirestoreDatabase } from '../firestore-wrapper';
import { ActivityFeedService } from './ActivityFeedService';
import { IAuthService } from './auth';
import { FirebaseAuthService, type IdentityToolkitConfig } from './auth';
import { IncrementalBalanceService } from './balance/IncrementalBalanceService';
import { CommentService } from './CommentService';
import { ExpenseService } from './ExpenseService';
import { FirestoreReader, type IFirestoreReader, type IFirestoreWriter } from './firestore';
import { FirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { GroupService } from './GroupService';
import { GroupShareService } from './GroupShareService';
import { PolicyService } from './PolicyService';
import { SettlementService } from './SettlementService';
import { GroupTransactionManager } from './transactions/GroupTransactionManager';
import { UserPolicyService } from './UserPolicyService';
import { UserService } from './UserService2';
import { TenantRegistryService } from './tenant/TenantRegistryService';

export class ComponentBuilder {
    // Base infrastructure - created once
    // Services - created lazily but cached
    private userService?: UserService;
    private groupService?: GroupService;
    private expenseService?: ExpenseService;
    private settlementService?: SettlementService;
    private commentService?: CommentService;
    private policyService?: PolicyService;
    private userPolicyService?: UserPolicyService;
    private groupMemberService?: GroupMemberService;
    private groupShareService?: GroupShareService;
    private groupTransactionManager?: GroupTransactionManager;
    private incrementalBalanceService?: IncrementalBalanceService;
    private activityFeedService?: ActivityFeedService;
    private tenantRegistryService?: TenantRegistryService;
    private firestoreReader: IFirestoreReader;
    private firestoreWriter: IFirestoreWriter;

    constructor(private authService: IAuthService, private db: IFirestoreDatabase) {
        this.firestoreReader = new FirestoreReader(db);
        this.firestoreWriter = new FirestoreWriter(db);
    }

    static createComponentBuilder(firestore: Firestore, auth: Auth, identityToolkit: IdentityToolkitConfig) {
        // Wrap the Firestore instance with our abstraction layer
        const wrappedDb = createFirestoreDatabase(firestore);

        const firebaseAuthService = new FirebaseAuthService(
            auth,
            identityToolkit,
            true, // enableValidation
            true, // enableMetrics
        );

        return new ComponentBuilder(firebaseAuthService, wrappedDb);
    }

    // ========================================================================
    // Public Builder Methods
    // ========================================================================

    buildUserService(): UserService {
        if (!this.userService) {
            this.userService = new UserService(this.buildFirestoreReader(), this.buildFirestoreWriter(), this.buildAuthService());
        }
        return this.userService!;
    }

    buildGroupService(): GroupService {
        if (!this.groupService) {
            this.groupService = new GroupService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildUserService(),
                this.buildExpenseService(),
                this.buildSettlementService(),
                this.buildGroupMemberService(),
                this.buildGroupShareService(),
                this.buildCommentService(),
                this.buildActivityFeedService(),
                this.buildGroupTransactionManager(),
            );
        }
        return this.groupService;
    }

    buildExpenseService(): ExpenseService {
        if (!this.expenseService) {
            this.expenseService = new ExpenseService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildIncrementalBalanceService(),
                this.buildActivityFeedService(),
                this.buildUserService(),
                this.buildGroupMemberService(),
            );
        }
        return this.expenseService;
    }

    buildSettlementService(): SettlementService {
        if (!this.settlementService) {
            this.settlementService = new SettlementService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildIncrementalBalanceService(),
                this.buildActivityFeedService(),
                this.buildUserService(),
                this.buildGroupMemberService(),
            );
        }
        return this.settlementService;
    }

    buildCommentService(): CommentService {
        if (!this.commentService) {
            this.commentService = new CommentService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildGroupMemberService(),
                this.buildActivityFeedService(),
            );
        }
        return this.commentService;
    }

    buildPolicyService(): PolicyService {
        if (!this.policyService) {
            this.policyService = new PolicyService(this.buildFirestoreReader(), this.buildFirestoreWriter());
        }
        return this.policyService;
    }

    buildUserPolicyService(): UserPolicyService {
        if (!this.userPolicyService) {
            this.userPolicyService = new UserPolicyService(this.buildFirestoreReader(), this.buildFirestoreWriter());
        }
        return this.userPolicyService;
    }

    buildGroupMemberService(): GroupMemberService {
        if (!this.groupMemberService) {
            this.groupMemberService = new GroupMemberService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildActivityFeedService(),
            );
        }
        return this.groupMemberService;
    }

    buildGroupTransactionManager(): GroupTransactionManager {
        if (!this.groupTransactionManager) {
            this.groupTransactionManager = new GroupTransactionManager(this.buildFirestoreReader(), this.buildFirestoreWriter());
        }
        return this.groupTransactionManager;
    }

    buildIncrementalBalanceService(): IncrementalBalanceService {
        if (!this.incrementalBalanceService) {
            this.incrementalBalanceService = new IncrementalBalanceService(this.buildFirestoreWriter());
        }
        return this.incrementalBalanceService;
    }

    buildGroupShareService(): GroupShareService {
        if (!this.groupShareService) {
            this.groupShareService = new GroupShareService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildGroupMemberService(),
                this.buildActivityFeedService(),
                this.buildUserService(),
                this.buildGroupTransactionManager(),
            );
        }
        return this.groupShareService;
    }

    buildActivityFeedService(): ActivityFeedService {
        if (!this.activityFeedService) {
            this.activityFeedService = new ActivityFeedService(this.buildFirestoreReader(), this.buildFirestoreWriter());
        }
        return this.activityFeedService;
    }

    buildTenantRegistryService(): TenantRegistryService {
        if (!this.tenantRegistryService) {
            this.tenantRegistryService = new TenantRegistryService(this.buildFirestoreReader());
        }
        return this.tenantRegistryService;
    }

    buildFirestoreReader(): IFirestoreReader {
        return this.firestoreReader;
    }

    buildFirestoreWriter(): IFirestoreWriter {
        return this.firestoreWriter;
    }

    buildAuthService(): IAuthService {
        return this.authService;
    }

    getDatabase(): IFirestoreDatabase {
        return this.db;
    }
}
