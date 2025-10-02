import type { GroupFullDetails, Group, GroupMemberDTO, ExpenseData, GroupBalances, SettlementListItem } from '@splitifyd/shared';

/**
 * Builder for creating GroupFullDetails responses for testing
 * This matches the structure returned by GET /api/groups/:id/full-details
 */
export class GroupFullDetailsBuilder {
    private fullDetails: GroupFullDetails;

    constructor() {
        this.fullDetails = {
            group: {} as Group,
            members: { members: [] },
            expenses: { expenses: [], hasMore: false },
            balances: {
                groupId: 'default-group-id',
                lastUpdated: new Date().toISOString(),
                userBalances: {},
                simplifiedDebts: [],
                balancesByCurrency: {}
            },
            settlements: { settlements: [], hasMore: false }
        };
    }

    withGroup(group: Group): this {
        this.fullDetails.group = group;
        // Also update balances groupId to match
        if (group.id) {
            this.fullDetails.balances.groupId = group.id;
        }
        return this;
    }

    withMembers(members: GroupMemberDTO[]): this {
        this.fullDetails.members = { members };
        return this;
    }

    withExpenses(expenses: ExpenseData[], hasMore: boolean = false, nextCursor?: string): this {
        this.fullDetails.expenses = { expenses, hasMore, nextCursor };
        return this;
    }

    withBalances(balances: GroupBalances): this {
        this.fullDetails.balances = balances;
        return this;
    }

    withSettlements(settlements: SettlementListItem[], hasMore: boolean = false, nextCursor?: string): this {
        this.fullDetails.settlements = { settlements, hasMore, nextCursor };
        return this;
    }

    build(): GroupFullDetails {
        return this.fullDetails;
    }
}
