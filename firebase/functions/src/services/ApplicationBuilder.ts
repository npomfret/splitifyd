/**
 * ApplicationBuilder - Simple service factory with dependency injection
 *
 * Replaces the complex ServiceContainer/ServiceRegistry pattern with a straightforward
 * factory that creates services once and injects dependencies through constructors.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreReader } from './firestore';
import { FirestoreWriter } from './firestore';
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
import { NotificationService } from './notification-service';
import { IAuthService } from './auth';
import { FirebaseAuthService } from './auth';
import { getAuth } from '../firebase';

export class ApplicationBuilder {
    private readonly firestore: Firestore;

    // Base infrastructure - created once
    private firestoreReader?: FirestoreReader;
    private firestoreWriter?: FirestoreWriter;
    private validationService?: FirestoreValidationService;
    private authService?: IAuthService;

    // Services - created lazily but cached
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
    private notificationService?: NotificationService;

    constructor(firestore: Firestore) {
        this.firestore = firestore;
    }

    // ========================================================================
    // Public Builder Methods
    // ========================================================================

    buildUserService(): UserService {
        if (!this.userService) {
            this.userService = new UserService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildFirestoreValidationService(),
                this.buildNotificationService(),
                this.buildAuthService(),
            );
        }
        return this.userService;
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
                this.buildExpenseMetadataService(),
                this.buildGroupShareService(),
            );
        }
        return this.groupService;
    }

    buildExpenseService(): ExpenseService {
        if (!this.expenseService) {
            this.expenseService = new ExpenseService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildGroupMemberService(),
                this.buildUserService()
            );
        }
        return this.expenseService;
    }

    buildSettlementService(): SettlementService {
        if (!this.settlementService) {
            this.settlementService = new SettlementService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildGroupMemberService()
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
                this.buildAuthService()
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
                this.buildUserService(),
            );
        }
        return this.groupMemberService;
    }

    buildGroupPermissionService(): GroupPermissionService {
        if (!this.groupPermissionService) {
            this.groupPermissionService = new GroupPermissionService(this.buildFirestoreReader(), this.buildFirestoreWriter());
        }
        return this.groupPermissionService;
    }

    buildGroupShareService(): GroupShareService {
        if (!this.groupShareService) {
            this.groupShareService = new GroupShareService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildGroupMemberService()
            );
        }
        return this.groupShareService;
    }

    buildExpenseMetadataService(): ExpenseMetadataService {
        if (!this.expenseMetadataService) {
            this.expenseMetadataService = new ExpenseMetadataService(this.buildFirestoreReader());
        }
        return this.expenseMetadataService;
    }

    buildNotificationService(): NotificationService {
        if (!this.notificationService) {
            this.notificationService = new NotificationService(this.buildFirestoreReader(), this.buildFirestoreWriter());
        }
        return this.notificationService;
    }

    buildFirestoreReader(): FirestoreReader {
        if (!this.firestoreReader) {
            this.firestoreReader = new FirestoreReader(this.firestore);
        }
        return this.firestoreReader;
    }

    buildFirestoreWriter(): FirestoreWriter {
        if (!this.firestoreWriter) {
            this.firestoreWriter = new FirestoreWriter(this.firestore);
        }
        return this.firestoreWriter;
    }

    buildFirestoreValidationService(): FirestoreValidationService {
        if (!this.validationService) {
            this.validationService = FirestoreValidationService.getInstance();
        }
        return this.validationService;
    }

    buildAuthService(): IAuthService {
        if (!this.authService) {
            this.authService = new FirebaseAuthService(
                getAuth(),
                true, // enableValidation
                true, // enableMetrics
            );
        }
        return this.authService!;
    }
}
