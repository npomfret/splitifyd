import type { GroupDTO, GroupId } from '@splitifyd/shared';
import type { ITransaction } from '../../firestore-wrapper';
import { Errors } from '../../utils/errors';
import type { IFirestoreReader, IFirestoreWriter } from '../firestore';
import type { GroupBalanceDTO } from '../../schemas';

export interface GroupTransactionOptions {
    preloadBalance?: boolean;
    requireGroup?: boolean;
}

export class GroupTransactionContext {
    private balance?: GroupBalanceDTO;
    private balanceLoaded = false;

    constructor(
        private readonly groupId: GroupId,
        private readonly groupSnapshot: GroupDTO | null,
        private readonly transactionRef: ITransaction,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly options: GroupTransactionOptions,
    ) {}

    async prepare(): Promise<void> {
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

    async touchGroup(): Promise<void> {
        await this.firestoreWriter.touchGroup(this.groupId, this.transactionRef);
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
                    throw Errors.NOT_FOUND('Group');
                }
            }

            const context = new GroupTransactionContext(groupId, group, transaction, this.firestoreWriter, options);
            await context.prepare();

            return executor(context);
        });
    }
}
