import { calculateEqualSplits, toAmount, USD } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder } from '@billsplit-wl/test-support';
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

    describe('comment edge cases', () => {
        it('should reject creating group comment for non-existent group', async () => {
            await expect(
                appDriver.createGroupComment('non-existent-group-id', 'Test comment', user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject creating group comment as non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // user2 is NOT a member
            await expect(
                appDriver.createGroupComment(group.id, 'Test comment', user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject creating expense comment for non-existent expense', async () => {
            await expect(
                appDriver.createExpenseComment('non-existent-expense-id', 'Test comment', user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject listing group comments for non-existent group', async () => {
            await expect(
                appDriver.listGroupComments('non-existent-group-id', {}, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject listing group comments as non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // user2 is NOT a member
            await expect(
                appDriver.listGroupComments(group.id, {}, user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject listing expense comments for non-existent expense', async () => {
            await expect(
                appDriver.listExpenseComments('non-existent-expense-id', {}, user1),
            )
                .rejects
                .toMatchObject({ code: 'NOT_FOUND' });
        });

        it('should reject listing expense comments as non-member', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const participants = [user1];
            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(50, USD)
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                    .build(),
                user1,
            );

            // user2 is NOT a member
            await expect(
                appDriver.listExpenseComments(expense.id, {}, user2),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('should reject empty comment text after sanitization', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;
            const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            // Comment with only script tag should be sanitized to empty and rejected
            await expect(
                appDriver.createGroupComment(groupId, '<script>alert(1)</script>', user1),
            )
                .rejects
                .toThrow();
        });

        it('should support pagination for group comments', async () => {
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const groupId = group.id;

            // Create 5 comments
            for (let i = 0; i < 5; i += 1) {
                await appDriver.createGroupComment(groupId, `Comment ${i}`, user1);
            }

            // Request with limit of 2
            const firstPage = await appDriver.listGroupComments(groupId, { limit: 2 }, user1);
            expect(firstPage.comments).toHaveLength(2);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            // Get next page
            const secondPage = await appDriver.listGroupComments(groupId, { limit: 2, cursor: firstPage.nextCursor }, user1);
            expect(secondPage.comments).toHaveLength(2);
        });
    });
});
