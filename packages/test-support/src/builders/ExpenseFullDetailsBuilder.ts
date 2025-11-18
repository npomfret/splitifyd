import type { ExpenseDTO, ExpenseFullDetailsDTO, GroupDTO, GroupMember } from '@billsplit-wl/shared';
import { ExpenseDTOBuilder } from './ExpenseDTOBuilder';
import { GroupDTOBuilder } from './GroupDTOBuilder';
import { GroupMemberBuilder } from './GroupMemberBuilder';

/**
 * Builder for creating ExpenseFullDetails responses for testing
 * Mirrors the structure returned by GET /api/expenses/:id/full-details
 */
export class ExpenseFullDetailsBuilder {
    private fullDetails: ExpenseFullDetailsDTO;

    constructor() {
        const defaultExpense = new ExpenseDTOBuilder().build();
        const defaultGroup = GroupDTOBuilder
            .groupForUser(defaultExpense.createdBy)
            .withId(defaultExpense.groupId)
            .build();
        const defaultMember = new GroupMemberBuilder()
            .withUid(defaultExpense.paidBy)
            .build();

        this.fullDetails = {
            expense: defaultExpense,
            group: defaultGroup,
            members: { members: [defaultMember] },
        };
    }

    withExpense(expense: ExpenseDTO): this {
        this.fullDetails.expense = expense;
        return this;
    }

    withGroup(group: GroupDTO): this {
        this.fullDetails.group = group;
        return this;
    }

    withMembers(members: GroupMember[]): this {
        this.fullDetails.members = { members };
        return this;
    }

    build(): ExpenseFullDetailsDTO {
        return this.fullDetails;
    }
}
