import type { GroupDTO, GroupId } from '@billsplit-wl/shared';
import type { IDocumentReference, ITransaction } from 'ts-firebase-simulator';
import { ErrorDetail, Errors } from '../../errors';
import type { GroupBalanceDTO } from '../../schemas';
import type { IFirestoreReader, IFirestoreWriter } from '../firestore';

export interface GroupTransactionOptions {
    preloadBalance?: boolean;
    requireGroup?: boolean;
}

export class GroupTransactionContext {
    private balance?: GroupBalanceDTO;
    private balanceLoaded = false;
    private membershipRefs: Array<{ id: string; ref: IDocumentReference; }> = [];

    constructor(
        private readonly groupId: GroupId,
        private readonly groupSnapshot: GroupDTO | null,
        private readonly transactionRef: ITransaction,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly firestoreReader: IFirestoreReader,
        private readonly options: GroupTransactionOptions,
    ) {}

    async prepare(): Promise<void> {
        // Preload membership refs - must happen before any writes (Firestore rule)
        this.membershipRefs = await this.firestoreReader.getMembershipRefsInTransaction(
            this.transactionRef,
            this.groupId,
        );

        if (this.options.preloadBalance) {
            await this.getCurrentBalance();
        }
    }

    get group(): GroupDTO {
        if (!this.groupSnapshot) {
            throw new Error('GroupTransactionContext: group data not loaded');
        }
        return this.groupSnapshot;
    }

    get transaction(): ITransaction {
        return this.transactionRef;
    }

    async getCurrentBalance(): Promise<GroupBalanceDTO> {
        if (!this.balanceLoaded) {
            this.balance = await this.firestoreWriter.getGroupBalanceInTransaction(this.transactionRef, this.groupId);
            this.balanceLoaded = true;
        }
        return this.balance!;
    }

    async touchGroup(excludeMembershipIds?: string[]): Promise<void> {
        const excludeSet = new Set(excludeMembershipIds ?? []);
        const refsToUpdate = this.membershipRefs.filter((m) => !excludeSet.has(m.id));
        await this.firestoreWriter.touchGroupWithPreloadedRefs(
            this.groupId,
            this.transactionRef,
            refsToUpdate.map((m) => m.ref),
        );
    }
}

export class GroupTransactionManager {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
    ) {}

    async run<T>(
        groupId: GroupId,
        options: GroupTransactionOptions,
        executor: (context: GroupTransactionContext) => Promise<T>,
    ): Promise<T> {
        const requireGroup = options.requireGroup !== false;
        return this.firestoreWriter.runTransaction(async (transaction) => {
            let group: GroupDTO | null = null;
            if (requireGroup) {
                group = await this.firestoreReader.getGroupInTransaction(transaction, groupId);

                if (!group) {
                    throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
                }
            }

            const context = new GroupTransactionContext(groupId, group, transaction, this.firestoreWriter, this.firestoreReader, options);
            await context.prepare();

            return executor(context);
        });
    }
}
