import { createFirestoreDatabase, IFirestoreDatabase } from '../firestore-wrapper';
import { IAuthService } from './auth';
import { FirebaseAuthService } from './auth';
import { IncrementalBalanceService } from './balance/IncrementalBalanceService';
import { CommentService } from './CommentService';
import { ExpenseService } from './ExpenseService';
import { FirestoreReader, type IFirestoreReader, type IFirestoreWriter } from './firestore';
import { FirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { GroupService } from './GroupService';
import { GroupShareService } from './GroupShareService';
import { NotificationService } from './notification-service';
import { PolicyService } from './PolicyService';
import { SettlementService } from './SettlementService';
import { UserPolicyService } from './UserPolicyService';
import { UserService } from './UserService2';

export class ApplicationBuilder {
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
    private notificationService?: NotificationService;
    private incrementalBalanceService?: IncrementalBalanceService;
    private firestoreReader: IFirestoreReader;
    private firestoreWriter: IFirestoreWriter;

    constructor(private authService: IAuthService, db: IFirestoreDatabase) {
        this.firestoreReader = new FirestoreReader(db);
        this.firestoreWriter = new FirestoreWriter(db);
    }

    static createApplicationBuilder(
        firestore: Parameters<typeof createFirestoreDatabase>[0],
        auth: ConstructorParameters<typeof FirebaseAuthService>[0],
    ) {
        // Wrap the Firestore instance with our abstraction layer
        const wrappedDb = createFirestoreDatabase(firestore);

        const firebaseAuthService = new FirebaseAuthService(
            auth,
            true, // enableValidation
            true, // enableMetrics
        );

        return new ApplicationBuilder(firebaseAuthService, wrappedDb);
    }

    // ========================================================================
    // Public Builder Methods
    // ========================================================================

    buildUserService(): UserService {
        if (!this.userService) {
            this.userService = new UserService(this.buildFirestoreReader(), this.buildFirestoreWriter(), this.buildNotificationService(), this.buildAuthService());
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
                this.buildNotificationService(),
                this.buildGroupShareService(),
            );
        }
        return this.groupService;
    }

    buildExpenseService(): ExpenseService {
        if (!this.expenseService) {
            this.expenseService = new ExpenseService(this.buildFirestoreReader(), this.buildFirestoreWriter(), this.buildIncrementalBalanceService());
        }
        return this.expenseService;
    }

    buildSettlementService(): SettlementService {
        if (!this.settlementService) {
            this.settlementService = new SettlementService(this.buildFirestoreReader(), this.buildFirestoreWriter(), this.buildIncrementalBalanceService());
        }
        return this.settlementService;
    }

    buildCommentService(): CommentService {
        if (!this.commentService) {
            this.commentService = new CommentService(this.buildFirestoreReader(), this.buildFirestoreWriter(), this.buildGroupMemberService(), this.buildAuthService());
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
            this.groupMemberService = new GroupMemberService(this.buildFirestoreReader(), this.buildFirestoreWriter());
        }
        return this.groupMemberService;
    }

    buildIncrementalBalanceService(): IncrementalBalanceService {
        if (!this.incrementalBalanceService) {
            this.incrementalBalanceService = new IncrementalBalanceService(this.buildFirestoreWriter());
        }
        return this.incrementalBalanceService;
    }

    buildGroupShareService(): GroupShareService {
        if (!this.groupShareService) {
            this.groupShareService = new GroupShareService(this.buildFirestoreReader(), this.buildFirestoreWriter(), this.buildGroupMemberService());
        }
        return this.groupShareService;
    }

    buildNotificationService(): NotificationService {
        if (!this.notificationService) {
            this.notificationService = new NotificationService(this.buildFirestoreReader(), this.buildFirestoreWriter());
        }
        return this.notificationService;
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
}
