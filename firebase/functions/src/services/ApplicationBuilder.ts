import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreReader, type IFirestoreReader, type IFirestoreWriter } from './firestore';
import { FirestoreWriter } from './firestore';
import { UserService } from './UserService2';
import { GroupService } from './GroupService';
import { ExpenseService } from './ExpenseService';
import { SettlementService } from './SettlementService';
import { CommentService } from './CommentService';
import { PolicyService } from './PolicyService';
import { UserPolicyService } from './UserPolicyService';
import { GroupMemberService } from './GroupMemberService';
import { GroupShareService } from './GroupShareService';
import { NotificationService } from './notification-service';
import { IAuthService } from './auth';
import { FirebaseAuthService } from './auth';
import * as admin from 'firebase-admin';
import { IncrementalBalanceService } from './balance/IncrementalBalanceService';

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

    constructor(
        private firestoreReader: IFirestoreReader,
        private firestoreWriter: IFirestoreWriter,
        private authService: IAuthService,
    ) {}

    static createApplicationBuilder(firestore: Firestore, auth: admin.auth.Auth) {
        const firestoreReader = new FirestoreReader(firestore);
        const firestoreWriter = new FirestoreWriter(firestore);
        const firebaseAuthService = new FirebaseAuthService(
            auth,
            true, // enableValidation
            true, // enableMetrics
        );

        return new ApplicationBuilder(firestoreReader, firestoreWriter, firebaseAuthService);
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
            this.expenseService = new ExpenseService(this.buildFirestoreReader(), this.buildFirestoreWriter(), this.buildUserService(), this.buildIncrementalBalanceService());
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
