import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import { createCloudTasksClient, type ICloudTasksClient } from 'ts-firebase-simulator';
import { TenantBrowserHandlers } from '../browser/TenantBrowserHandlers';
import { UserBrowserHandlers } from '../browser/UserBrowserHandlers';
import { createFirestoreDatabase, type IFirestoreDatabase } from '../firestore-wrapper';
import { GroupSecurityHandlers } from '../groups/GroupSecurityHandlers';
import { MergeHandlers } from '../merge/MergeHandlers';
import { MergeService } from '../merge/MergeService';
import { MergeTaskService } from '../merge/MergeTaskService';
import { ServiceConfig } from '../merge/ServiceConfig';
import { SharingHandlers } from '../sharing/SharingHandlers';
import { createStorage, type IStorage } from '../storage-wrapper';
import { ActivityFeedService } from './ActivityFeedService';
import { FirebaseAuthService, type IAuthService, type IdentityToolkitConfig } from './auth';
import { IncrementalBalanceService } from './balance/IncrementalBalanceService';
import { CommentService } from './CommentService';
import { FakeEmailService, type IEmailService, PostmarkEmailService, PostmarkTokenProvider } from './email';
import { ExpenseService } from './ExpenseService';
import { FirestoreReader, FirestoreWriter, type IFirestoreReader, type IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { GroupService } from './GroupService';
import { GroupShareService } from './GroupShareService';
import { PolicyService } from './PolicyService';
import { ReactionService } from './ReactionService';
import { SettlementService } from './SettlementService';
import { CloudThemeArtifactStorage } from './storage/CloudThemeArtifactStorage';
import { CloudGroupAttachmentStorage, type GroupAttachmentStorage } from './storage/GroupAttachmentStorage';
import { CloudTenantAssetStorage, type TenantAssetStorage } from './storage/TenantAssetStorage';
import { type ThemeArtifactStorage } from './storage/ThemeArtifactStorage';
import { TenantAdminService } from './tenant/TenantAdminService';
import { type ITenantImageLibraryService, TenantImageLibraryService } from './tenant/TenantImageLibraryService';
import { TenantRegistryService } from './tenant/TenantRegistryService';
import { ThemeArtifactService } from './tenant/ThemeArtifactService';
import { GroupTransactionManager } from './transactions/GroupTransactionManager';
import { UserPolicyService } from './UserPolicyService';
import { UserService } from './UserService2';

export class ComponentBuilder {
    // Base infrastructure - created once
    // Services - created lazily but cached
    private userService?: UserService;
    private groupService?: GroupService;
    private expenseService?: ExpenseService;
    private settlementService?: SettlementService;
    private commentService?: CommentService;
    private reactionService?: ReactionService;
    private policyService?: PolicyService;
    private userPolicyService?: UserPolicyService;
    private groupMemberService?: GroupMemberService;
    private groupShareService?: GroupShareService;
    private groupTransactionManager?: GroupTransactionManager;
    private incrementalBalanceService?: IncrementalBalanceService;
    private activityFeedService?: ActivityFeedService;
    private tenantRegistryService?: TenantRegistryService;
    private themeArtifactStorage?: ThemeArtifactStorage;
    private tenantAssetStorage?: TenantAssetStorage;
    private themeArtifactService?: ThemeArtifactService;
    private tenantAdminService?: TenantAdminService;
    private userBrowserHandlers?: UserBrowserHandlers;
    private tenantBrowserHandlers?: TenantBrowserHandlers;
    private groupSecurityHandlers?: GroupSecurityHandlers;
    private mergeService?: MergeService;
    private mergeTaskService?: MergeTaskService;
    private mergeHandlers?: MergeHandlers;
    private tenantImageLibraryService?: ITenantImageLibraryService;
    private sharingHandlers?: SharingHandlers;
    private readonly firestoreReader: IFirestoreReader;
    private readonly firestoreWriter: IFirestoreWriter;

    constructor(
        private readonly authService: IAuthService,
        private readonly emailService: IEmailService,
        readonly db: IFirestoreDatabase,
        private readonly storage: IStorage,
        private readonly cloudTasksClient: ICloudTasksClient,
        private readonly serviceConfig: ServiceConfig,
        private readonly groupAttachmentStorage: GroupAttachmentStorage,
    ) {
        this.firestoreReader = new FirestoreReader(db);
        this.firestoreWriter = new FirestoreWriter(db);
    }

    static createComponentBuilder(
        firestore: Firestore,
        auth: Auth,
        storage: Storage,
        identityToolkit: IdentityToolkitConfig,
        serviceConfig: ServiceConfig,
    ) {
        // Wrap the Firestore instance with our abstraction layer
        const wrappedDb = createFirestoreDatabase(firestore);
        const wrappedStorage = createStorage(storage);

        const emailService: IEmailService = process.env.NODE_ENV === 'test'
            ? new FakeEmailService()
            : new PostmarkEmailService(new PostmarkTokenProvider());

        const firebaseAuthService = new FirebaseAuthService(
            auth,
            identityToolkit,
            emailService,
            true, // enableValidation
            true, // enableMetrics
        );

        const cloudTasksClient = createCloudTasksClient();
        // Cast is safe: at runtime with real Firebase Storage, bucket() returns full Bucket
        const groupAttachmentStorage = new CloudGroupAttachmentStorage(
            wrappedStorage.bucket() as unknown as import('@google-cloud/storage').Bucket,
        );

        return new ComponentBuilder(
            firebaseAuthService,
            emailService,
            wrappedDb,
            wrappedStorage,
            cloudTasksClient,
            serviceConfig,
            groupAttachmentStorage,
        );
    }

    // ========================================================================
    // Public Builder Methods
    // ========================================================================

    buildUserService(): UserService {
        if (!this.userService) {
            this.userService = new UserService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildAuthService(),
                this.serviceConfig.minRegistrationDurationMs,
            );
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
                this.buildGroupAttachmentStorage(),
            );
        }
        return this.commentService;
    }

    buildReactionService(): ReactionService {
        if (!this.reactionService) {
            this.reactionService = new ReactionService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildGroupMemberService(),
                this.buildActivityFeedService(),
            );
        }
        return this.reactionService;
    }

    buildGroupAttachmentStorage(): GroupAttachmentStorage {
        return this.groupAttachmentStorage;
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

    buildThemeArtifactStorage(): ThemeArtifactStorage {
        if (!this.themeArtifactStorage) {
            this.themeArtifactStorage = new CloudThemeArtifactStorage(
                this.storage,
                this.serviceConfig.storagePublicBaseUrl,
            );
        }
        return this.themeArtifactStorage;
    }

    buildTenantAssetStorage(): TenantAssetStorage {
        if (!this.tenantAssetStorage) {
            this.tenantAssetStorage = new CloudTenantAssetStorage(
                this.storage,
                this.serviceConfig.storagePublicBaseUrl,
            );
        }
        return this.tenantAssetStorage;
    }

    buildMergeService(): MergeService {
        if (!this.mergeService) {
            this.mergeService = new MergeService(
                this.buildAuthService(),
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.cloudTasksClient,
                this.serviceConfig,
            );
        }
        return this.mergeService;
    }

    buildMergeTaskService(): MergeTaskService {
        if (!this.mergeTaskService) {
            this.mergeTaskService = new MergeTaskService(
                this.buildAuthService(),
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
            );
        }
        return this.mergeTaskService;
    }

    buildThemeArtifactService(): ThemeArtifactService {
        if (!this.themeArtifactService) {
            this.themeArtifactService = new ThemeArtifactService(this.buildThemeArtifactStorage());
        }
        return this.themeArtifactService;
    }

    buildTenantAdminService(): TenantAdminService {
        if (!this.tenantAdminService) {
            this.tenantAdminService = new TenantAdminService(
                this.buildFirestoreWriter(),
                this.buildFirestoreReader(),
                this.buildThemeArtifactService(),
            );
        }
        return this.tenantAdminService;
    }

    buildUserBrowserHandlers(): UserBrowserHandlers {
        if (!this.userBrowserHandlers) {
            this.userBrowserHandlers = new UserBrowserHandlers(
                this.buildAuthService(),
                this.buildFirestoreReader(),
            );
        }
        return this.userBrowserHandlers;
    }

    buildTenantBrowserHandlers(): TenantBrowserHandlers {
        if (!this.tenantBrowserHandlers) {
            this.tenantBrowserHandlers = new TenantBrowserHandlers(
                this.buildFirestoreReader(),
            );
        }
        return this.tenantBrowserHandlers;
    }

    buildGroupSecurityHandlers(): GroupSecurityHandlers {
        if (!this.groupSecurityHandlers) {
            this.groupSecurityHandlers = new GroupSecurityHandlers(
                this.buildGroupService(),
                this.buildGroupMemberService(),
            );
        }
        return this.groupSecurityHandlers;
    }

    buildMergeHandlers(): MergeHandlers {
        if (!this.mergeHandlers) {
            this.mergeHandlers = new MergeHandlers(
                this.buildMergeService(),
                this.buildMergeTaskService(),
            );
        }
        return this.mergeHandlers;
    }

    buildTenantImageLibraryService(): ITenantImageLibraryService {
        if (!this.tenantImageLibraryService) {
            this.tenantImageLibraryService = new TenantImageLibraryService(
                this.buildFirestoreReader(),
                this.buildFirestoreWriter(),
                this.buildTenantAssetStorage(),
            );
        }
        return this.tenantImageLibraryService;
    }

    buildSharingHandlers(): SharingHandlers {
        if (!this.sharingHandlers) {
            this.sharingHandlers = new SharingHandlers(this.buildTenantRegistryService());
        }
        return this.sharingHandlers;
    }
}
