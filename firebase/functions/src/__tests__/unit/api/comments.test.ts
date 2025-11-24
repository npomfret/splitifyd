import {
    calculateEqualSplits,
    toAmount,
    USD,

} from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import {
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,

} from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('comments', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users } = await appDriver.createTestUsers({ count: 2 });
        [user1, user2] = users;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    

    it('should sanitize comment text containing scripts', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const response = await appDriver.createGroupComment(groupId, '<script>alert(1)</script>Hello', user1);
        expect(response.text).toBe('Hello');

        const comments = await appDriver.listGroupComments(groupId, {}, user1);
        expect(comments.comments[0].text).toBe('Hello');
    });

    it('should sanitize expense comment text containing scripts', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const participants = [user1, user2];
        const expense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(50, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                .build(),
            user1,
        );

        const response = await appDriver.createExpenseComment(expense.id, '<script>alert(1)</script>Thanks', user1);
        expect(response.text).toBe('Thanks');

        const comments = await appDriver.listExpenseComments(expense.id, {}, user1);
        expect(comments.comments[0].text).toBe('Thanks');
    });
});
