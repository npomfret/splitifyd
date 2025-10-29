import type { ExpenseDTO, GroupId, SettlementDTO, UserId } from '@splitifyd/shared';
import type { IFirestoreReader } from '../firestore';

export class GroupLockEvaluator {
    constructor(private readonly firestoreReader: IFirestoreReader) {}

    async isExpenseLocked(expense: ExpenseDTO): Promise<boolean> {
        const memberIds = await this.getMemberIds(expense.groupId);
        return expense.participants.some((uid) => !memberIds.has(uid));
    }

    async isSettlementLocked(settlement: SettlementDTO): Promise<boolean> {
        const memberIds = await this.getMemberIds(settlement.groupId);
        return !memberIds.has(settlement.payerId) || !memberIds.has(settlement.payeeId);
    }

    private async getMemberIds(groupId: GroupId): Promise<Set<UserId>> {
        const ids = await this.firestoreReader.getAllGroupMemberIds(groupId);
        return new Set(ids);
    }
}
