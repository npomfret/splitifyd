import { ActivityFeedActions, ActivityFeedEventTypes, ClientUser, GroupId, GroupMembershipDTO, toGroupId, toGroupName, toUserId } from '@billsplit-wl/shared';
import { MemberStatuses, UserId } from '@billsplit-wl/shared';
import type { GroupName } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { ActivityFeedItemBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, GroupMembershipDTOBuilder, GroupPermissionsBuilder } from '@billsplit-wl/test-support';
import type { Page } from '@playwright/test';
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
        .withUid(toUserId(uid))
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
        
        .withPermissions(GroupPermissionsBuilder.adminOnly().build())
        .build();

    const ownerMember = new GroupMemberBuilder()
        .withUid(user.uid)
        .withDisplayName(user.displayName ?? 'Test Admin')
        .withGroupDisplayName(user.displayName ?? 'Test Admin')
        .asAdmin()
        .asActive()
        .build();

    const pendingEntries = [
        createPendingEntry(groupId, toDisplayName('Pending Member Alpha'), user.uid),
        createPendingEntry(groupId, toDisplayName('Pending Member Bravo'), user.uid),
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
            await fulfillWithSerialization(route, { body: pendingMembers });
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

        await route.fulfill({ status: 204 });
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

        await route.fulfill({ status: 204 });
    });

    return {
        groupId,
        groupName,
        pendingEntries,
    };
}

test.describe('Group security pending members', () => {
    test('allows admins to approve and reject pending members', async ({ authenticatedPage }) => {
        const { page, user, mockFirebase } = authenticatedPage;
        const { groupId, groupName, pendingEntries } = await setupManagedGroupRoutes(page, user);

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle(groupName);
        await groupDetailPage.waitForMemberCount(1); // owner only

        let settingsModal = await groupDetailPage.clickEditGroupAndOpenModal('security');
        const pendingList = pendingEntries.map((entry) => entry);

        for (const entry of pendingList) {
            await expect(settingsModal.getPendingApproveButtonLocator(entry.uid)).toBeVisible();
            await expect(settingsModal.getPendingRejectButtonLocator(entry.uid)).toBeVisible();
            await expect(settingsModal.getModalContainerLocator().getByText(entry.displayName)).toBeVisible();
        }

        const [firstPending, secondPending] = pendingList;

        await settingsModal.approveMember(firstPending.uid);
        await expect(settingsModal.getPendingApproveButtonLocator(firstPending.uid)).toHaveCount(0);
        await expect(settingsModal.getPendingRejectButtonLocator(firstPending.uid)).toHaveCount(0);
        await expect(settingsModal.getPendingApproveButtonLocator(secondPending.uid)).toBeVisible();

        await settingsModal.rejectMember(secondPending.uid);
        await expect(settingsModal.getPendingRejectButtonLocator(secondPending.uid)).toHaveCount(0);
        await expect(settingsModal.getModalContainerLocator().getByText(secondPending.displayName)).toHaveCount(0);
        await expect(settingsModal.getModalContainerLocator().getByText('No pending requests right now.')).toBeVisible();

        await settingsModal.clickFooterClose();

        // Emit activity feed event to trigger real-time refresh (simulates what SSE does in production)
        await mockFirebase.emitActivityFeedItems(
            user.uid,
            [
                ActivityFeedItemBuilder
                    .forEvent(
                        `member-approved-${firstPending.uid}`,
                        user.uid,
                        groupId,
                        groupName,
                        ActivityFeedEventTypes.MEMBER_ROLE_CHANGED,
                        ActivityFeedActions.UPDATE,
                        user.displayName ?? 'Admin',
                        { targetUserId: toUserId(firstPending.uid), targetUserName: firstPending.displayName },
                    )
                    .build(),
            ],
        );

        await groupDetailPage.waitForMemberCount(2);
        await expect(groupDetailPage.getMemberItemLocator(firstPending.displayName)).toBeVisible();
        await expect(groupDetailPage.getMemberCardsLocator()).toHaveCount(2);
    });
});
