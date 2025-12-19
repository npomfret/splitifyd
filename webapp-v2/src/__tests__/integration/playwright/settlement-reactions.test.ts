import { ReactionEmojis, toUserId } from '@billsplit-wl/shared';
import { GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementWithMembersBuilder } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi, mockToggleSettlementReactionApi } from '../../utils/mock-firebase-service';

test.describe('Settlement Reactions', () => {
    test('should display existing reactions on a settlement', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-settlement-reactions';
        const settlementId = 'settlement-with-reactions';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();

        const testUserMember = new GroupMemberBuilder()
            .withUid(testUser.uid)
            .withDisplayName(testUser.displayName)
            .withGroupDisplayName(testUser.displayName)
            .build();

        const otherMember = new GroupMemberBuilder()
            .withUid('other-user')
            .withDisplayName('Other User')
            .withGroupDisplayName('Other User')
            .build();

        const settlement = new SettlementWithMembersBuilder()
            .withId(settlementId)
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherMember)
            .withAmount(100.00, 'USD')
            .withNote('Settlement With Reactions')
            .withReactionCounts({ [ReactionEmojis.THUMBS_UP]: 2, [ReactionEmojis.HEART]: 1 })
            .withUserReactions({ [toUserId(testUser.uid)]: [ReactionEmojis.THUMBS_UP] })
            .build();

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([testUserMember, otherMember])
            .withSettlements([settlement])
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);

        // Verify settlement reactions are displayed
        await groupDetailPage.verifySettlementReactionVisible('Settlement With Reactions', ReactionEmojis.THUMBS_UP, 2);
        await groupDetailPage.verifySettlementReactionVisible('Settlement With Reactions', ReactionEmojis.HEART, 1);

        // Verify user's reaction is highlighted
        await groupDetailPage.verifySettlementReactionHighlighted('Settlement With Reactions', ReactionEmojis.THUMBS_UP);
        await groupDetailPage.verifySettlementReactionNotHighlighted('Settlement With Reactions', ReactionEmojis.HEART);
    });

    test('should add reaction to a settlement', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-add-settlement-reaction';
        const settlementId = 'settlement-to-react';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Add Settlement Reaction Group')
            .build();

        const testUserMember = new GroupMemberBuilder()
            .withUid(testUser.uid)
            .withDisplayName(testUser.displayName)
            .withGroupDisplayName(testUser.displayName)
            .build();

        const otherMember = new GroupMemberBuilder()
            .withUid('other-user')
            .withDisplayName('Other User')
            .withGroupDisplayName('Other User')
            .build();

        const settlement = new SettlementWithMembersBuilder()
            .withId(settlementId)
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherMember)
            .withAmount(50.00, 'USD')
            .withNote('React To Me')
            .build();

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([testUserMember, otherMember])
            .withSettlements([settlement])
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);
        await mockToggleSettlementReactionApi(page, settlementId, 'added');

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);

        // Add reaction to settlement
        await groupDetailPage.addSettlementReaction('React To Me', ReactionEmojis.THUMBS_UP);

        // Verify reaction appears
        await groupDetailPage.verifySettlementReactionVisible('React To Me', ReactionEmojis.THUMBS_UP, 1);
        await groupDetailPage.verifySettlementReactionHighlighted('React To Me', ReactionEmojis.THUMBS_UP);
    });

    test('should toggle off settlement reaction when clicked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-toggle-settlement';
        const settlementId = 'settlement-toggle-off';

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Toggle Settlement Reaction Group')
            .build();

        const testUserMember = new GroupMemberBuilder()
            .withUid(testUser.uid)
            .withDisplayName(testUser.displayName)
            .withGroupDisplayName(testUser.displayName)
            .build();

        const otherMember = new GroupMemberBuilder()
            .withUid('other-user')
            .withDisplayName('Other User')
            .withGroupDisplayName('Other User')
            .build();

        const settlement = new SettlementWithMembersBuilder()
            .withId(settlementId)
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherMember)
            .withAmount(75.00, 'USD')
            .withNote('Toggle Me Off')
            .withReactionCounts({ [ReactionEmojis.HEART]: 1 })
            .withUserReactions({ [toUserId(testUser.uid)]: [ReactionEmojis.HEART] })
            .build();

        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([testUserMember, otherMember])
            .withSettlements([settlement])
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);
        await mockToggleSettlementReactionApi(page, settlementId, 'removed', { emoji: ReactionEmojis.HEART });

        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded' });

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.verifyGroupDetailPageLoaded(group.name);

        // Verify initial state
        await groupDetailPage.verifySettlementReactionVisible('Toggle Me Off', ReactionEmojis.HEART, 1);
        await groupDetailPage.verifySettlementReactionHighlighted('Toggle Me Off', ReactionEmojis.HEART);

        // Toggle off
        await groupDetailPage.toggleSettlementReaction('Toggle Me Off', ReactionEmojis.HEART);

        // Verify reaction is removed
        await groupDetailPage.verifySettlementReactionNotVisible('Toggle Me Off', ReactionEmojis.HEART);
    });
});
