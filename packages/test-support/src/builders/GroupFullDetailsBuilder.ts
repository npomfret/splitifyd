import type { ExpenseDTO, GroupBalances, GroupDTO, GroupFullDetailsDTO, GroupMember, ListCommentsResponse, SettlementWithMembers } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';
import { convertToISOString } from '../test-helpers';

/**
 * Builder for creating GroupFullDetails responses for testing
 * This matches the structure returned by GET /api/groups/:id/full-details
 */
export class GroupFullDetailsBuilder {
    private fullDetails: GroupFullDetailsDTO;

    constructor() {
        this.fullDetails = {
            group: {} as GroupDTO,
            members: { members: [], hasMore: false },
            expenses: { expenses: [], hasMore: false },
            balances: {
                groupId: toGroupId('default-group-id'),
                lastUpdated: convertToISOString(new Date()),
                userBalances: {},
                simplifiedDebts: [],
                balancesByCurrency: {},
            },
            settlements: { settlements: [], hasMore: false },
            comments: {
                comments: [],
                hasMore: false,
            },
        };
    }

    withGroup(group: GroupDTO): this {
        this.fullDetails.group = group;
        // Also update balances groupId to match
        if (group.id) {
            this.fullDetails.balances.groupId = group.id;
        }
        return this;
    }

    withMembers(members: GroupMember[], hasMore: boolean = false, nextCursor?: string): this {
        this.fullDetails.members = { members, hasMore, nextCursor };
        return this;
    }

    withExpenses(expenses: ExpenseDTO[], hasMore: boolean = false, nextCursor?: string): this {
        this.fullDetails.expenses = { expenses, hasMore, nextCursor };
        return this;
    }

    withBalances(balances: GroupBalances): this {
        this.fullDetails.balances = balances;
        return this;
    }

    withSettlements(settlements: SettlementWithMembers[], hasMore: boolean = false, nextCursor?: string): this {
        this.fullDetails.settlements = { settlements, hasMore, nextCursor };
        return this;
    }

    withComments(comments: ListCommentsResponse): this {
        this.fullDetails.comments = comments;
        return this;
    }

    build(): GroupFullDetailsDTO {
        return this.fullDetails;
    }
}
