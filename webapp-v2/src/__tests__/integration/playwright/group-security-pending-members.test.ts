import type { Page } from '@playwright/test';
import {ClientUser, GroupId, GroupMembershipDTO, toGroupId, toGroupName} from '@splitifyd/shared';
import { MemberRoles, MemberStatuses, UserId } from '@splitifyd/shared';
import type { GroupName } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import { GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, GroupMembershipDTOBuilder } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi } from '../../utils/mock-firebase-service';

interface PendingEntry {
    uid: string;
    displayName: DisplayName;
    membership: GroupMembershipDTO;
    memberDetail: ReturnType<GroupMemberBuilder['build']>;
}

interface ManagedGroupSetupResult {
    groupId: GroupId;
    groupName: GroupName;
    pendingEntries: PendingEntry[];
}

function createPendingEntry(groupId: GroupId, displayName: DisplayName, invitedBy: UserId): PendingEntry {
    const uid = `pending-${displayName.toLowerCase().replace(/\s+/g, '-')}`;

    const memberDetail = new GroupMemberBuilder()
        .withUid(uid)
        .withDisplayName(displayName)
        .withGroupDisplayName(displayName)
        .asMember()
        .asPending()
        .build();

    const membership = new GroupMembershipDTOBuilder()
        .withUid(uid)
        .withGroupId(groupId)
        .withGroupDisplayName(displayName)
        .withTheme(memberDetail.themeColor)
        .withInvitedBy(invitedBy)
        .asMember()
        .asPending()
        .build();

    return {
        uid,
        displayName,
        membership,
        memberDetail,
    };
}

async function setupManagedGroupRoutes(page: Page, user: ClientUser): Promise<ManagedGroupSetupResult> {
    const groupId = toGroupId(`group-security-${user.uid}`);
    const groupName = toGroupName('Pending Approval Test Group');

    const group = new GroupDTOBuilder()
        .withId(groupId)
        .withName(groupName)
        .withCreatedBy(user.uid)
        .withPermissions({
            memberApproval: 'admin-required',
            memberInvitation: 'admin-only',
            expenseEditing: 'owner-and-admin',
            expenseDeletion: 'admin-only',
            settingsManagement: 'admin-only',
        })
        .build();

    const ownerMember = new GroupMemberBuilder()
        .withUid(user.uid)
        .withDisplayName(user.displayName ?? 'Test Admin')
        .withGroupDisplayName(user.displayName ?? 'Test Admin')
        .asAdmin()
        .asActive()
        .build();

    const pendingEntries = [
        createPendingEntry(groupId, 'Pending Member Alpha', user.uid),
        createPendingEntry(groupId, 'Pending Member Bravo', user.uid),
    ];

    const pendingMap = new Map(pendingEntries.map((entry) => [entry.uid, entry]));

    let activeMembers = [ownerMember];
    let pendingMembers = pendingEntries.map((entry) => entry.membership);

    const buildFullDetails = () =>
        new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(activeMembers.map((member) => ({ ...member })))
            .build();

    await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
        if (route.request().method() === 'GET') {
            await fulfillWithSerialization(route, { body: buildFullDetails() });
            return;
        }

        await route.fallback();
    });

    await mockGroupCommentsApi(page, groupId);

    await page.route(`**/api/groups/${groupId}/members/pending`, async (route) => {
        if (route.request().method() === 'GET') {
            await fulfillWithSerialization(route, { body: { members: pendingMembers } });
            return;
        }

        await route.fallback();
    });

    await page.route(`**/api/groups/${groupId}/members/*/approve`, async (route) => {
        const match = route.request().url().match(/members\/([^/]+)\/approve/);
        const memberId = match?.[1];

        if (!memberId || !pendingMap.has(memberId)) {
            await route.abort();
            return;
        }

        const entry = pendingMap.get(memberId)!;
        pendingMap.delete(memberId);
        pendingMembers = pendingMembers.filter((member) => member.uid !== memberId);

        const activeVersion = {
            ...entry.memberDetail,
            memberStatus: MemberStatuses.ACTIVE,
        };

        activeMembers = [...activeMembers.filter((member) => member.uid !== memberId), activeVersion];

        await fulfillWithSerialization(route, { body: { message: 'Member approved successfully' } });
    });

    await page.route(`**/api/groups/${groupId}/members/*/reject`, async (route) => {
        const match = route.request().url().match(/members\/([^/]+)\/reject/);
        const memberId = match?.[1];

        if (!memberId || !pendingMap.has(memberId)) {
            await route.abort();
            return;
        }

        pendingMap.delete(memberId);
        pendingMembers = pendingMembers.filter((member) => member.uid !== memberId);
        activeMembers = activeMembers.filter((member) => member.uid !== memberId);

        await fulfillWithSerialization(route, { body: { message: 'Member rejected successfully' } });
    });

    return {
        groupId,
        groupName,
        pendingEntries,
    };
}

test.describe('Group security pending members', () => {
    test('allows admins to approve and reject pending members', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const { groupId, groupName, pendingEntries } = await setupManagedGroupRoutes(page, user);

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle(groupName);
        await groupDetailPage.waitForMemberCount(1); // owner only

        let settingsModal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        const pendingList = pendingEntries.map((entry) => entry);

        for (const entry of pendingList) {
            await expect(settingsModal.getPendingApproveButton(entry.uid)).toBeVisible();
            await expect(settingsModal.getPendingRejectButton(entry.uid)).toBeVisible();
            await expect(settingsModal.getModalContainer().getByText(entry.displayName)).toBeVisible();
        }

        const [firstPending, secondPending] = pendingList;

        await settingsModal.approvePendingMember(firstPending.uid);
        await expect(settingsModal.getPendingApproveButton(firstPending.uid)).toHaveCount(0);
        await expect(settingsModal.getPendingRejectButton(firstPending.uid)).toHaveCount(0);
        await expect(settingsModal.getPendingApproveButton(secondPending.uid)).toBeVisible();

        await settingsModal.rejectPendingMember(secondPending.uid);
        await expect(settingsModal.getPendingRejectButton(secondPending.uid)).toHaveCount(0);
        await expect(settingsModal.getModalContainer().getByText(secondPending.displayName)).toHaveCount(0);
        await expect(settingsModal.getModalContainer().getByText('No pending requests right now.')).toBeVisible();

        await settingsModal.clickFooterClose();

        await groupDetailPage.waitForMemberCount(2);
        await expect(groupDetailPage.getMemberItem(firstPending.displayName)).toBeVisible();
        await expect(groupDetailPage.getMemberCards()).toHaveCount(2);
    });
});
