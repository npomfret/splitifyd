import { GroupDTOBuilder, GroupDetailPage, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementWithMembersBuilder, ThemeBuilder } from '@splitifyd/test-support';
import type { GroupId } from '@splitifyd/shared';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupDetailApi } from '../../utils/mock-firebase-service';

test.describe('Settlement History - Locked Settlement UI', () => {
    test('should display disabled edit button when settlement is locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-123';

        const testUserMember = new GroupMemberBuilder()
            .withUid(testUser.uid)
            .withDisplayName(testUser.displayName)
            .withGroupDisplayName(testUser.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const otherUser = new GroupMemberBuilder()
            .withUid('other-user-123')
            .withDisplayName('Other User')
            .withGroupDisplayName('Other User')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const lockedSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-123')
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherUser)
            .withAmount(50.0, 'USD')
            .withNote('Test Payment')
            .withIsLocked(true)
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([testUserMember, otherUser])
            .withSettlements([lockedSettlement])
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);

        const groupDetailPage = new GroupDetailPage(page);
        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await groupDetailPage.verifyGroupDetailPageLoaded('Test Group');
        await groupDetailPage.openSettlementHistory();
        await groupDetailPage.verifySettlementVisible('Test Payment');
        await groupDetailPage.verifySettlementEditDisabled('Test Payment', translationEn.settlementHistory.cannotEditTooltip);
    });

    test('should enable edit button when settlement is not locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-456';

        const testUserMember = new GroupMemberBuilder()
            .withUid(testUser.uid)
            .withDisplayName(testUser.displayName)
            .withGroupDisplayName(testUser.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const otherUser = new GroupMemberBuilder()
            .withUid('other-user-456')
            .withDisplayName('Other User')
            .withGroupDisplayName('Other User')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const unlockedSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-456')
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherUser)
            .withAmount(30.0, 'USD')
            .withNote('Normal Payment')
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([testUserMember, otherUser])
            .withSettlements([unlockedSettlement])
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);

        const groupDetailPage = new GroupDetailPage(page);
        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await groupDetailPage.verifyGroupDetailPageLoaded('Test Group');
        await groupDetailPage.openSettlementHistory();
        await groupDetailPage.verifySettlementVisible('Normal Payment');
        await groupDetailPage.verifySettlementEditEnabled('Normal Payment', translationEn.settlementHistory.editPaymentTooltip);
    });

    test('should reactively update when settlement lock status changes', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-789';

        const testUserMember = new GroupMemberBuilder()
            .withUid(testUser.uid)
            .withDisplayName(testUser.displayName)
            .withGroupDisplayName(testUser.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const otherUser = new GroupMemberBuilder()
            .withUid('other-user-789')
            .withDisplayName('Other User')
            .withGroupDisplayName('Other User')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const initialSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-789')
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherUser)
            .withAmount(25.0, 'USD')
            .withNote('Reactive Test Payment')
            .withIsLocked(false)
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();

        await mockGroupDetailApi(
            page,
            groupId,
            new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers([testUserMember, otherUser])
                .withSettlements([initialSettlement])
                .build(),
        );

        const groupDetailPage = new GroupDetailPage(page);
        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await groupDetailPage.verifyGroupDetailPageLoaded('Test Group');
        await groupDetailPage.openSettlementHistory();
        await groupDetailPage.verifySettlementVisible('Reactive Test Payment');
        await groupDetailPage.verifySettlementEditEnabled('Reactive Test Payment', translationEn.settlementHistory.editPaymentTooltip);

        const lockedSettlement = { ...initialSettlement, isLocked: true };
        await mockGroupDetailApi(
            page,
            groupId,
            new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers([testUserMember, otherUser])
                .withSettlements([lockedSettlement])
                .build(),
        );

        await page.goto('/dashboard');
        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await groupDetailPage.verifyGroupDetailPageLoaded('Test Group');
        await groupDetailPage.openSettlementHistory();
        await groupDetailPage.verifySettlementVisible('Reactive Test Payment');
        await groupDetailPage.verifySettlementEditDisabled('Reactive Test Payment', translationEn.settlementHistory.cannotEditTooltip);
    });
});
