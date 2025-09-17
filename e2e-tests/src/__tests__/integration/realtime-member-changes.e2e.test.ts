import { simpleTest, expect } from '../../fixtures';
import { GroupDetailPage, JoinGroupPage } from '../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';

simpleTest.describe('Real-Time Member Changes', () => {
    simpleTest('should show new member joining in real-time to existing members', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Real-time sync may generate expected transient API errors' });

        // Create four users - User1 (owner), User2 (watching group), User3 (watching dashboard), User4 (joining)
        const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
        const { page: user3Page, dashboardPage: user3DashboardPage, user: user3 } = await newLoggedInBrowser();
        const { page: user4Page, dashboardPage: user4DashboardPage, user: user4 } = await newLoggedInBrowser();

        // Create page objects
        const user2GroupDetailPage = new GroupDetailPage(user2Page, user2);

        // Get display names
        const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.getCurrentUserDisplayName();
        const user4DisplayName = await user4DashboardPage.getCurrentUserDisplayName();

        // User1 creates group
        const groupName = generateTestGroupName('MemberJoinRT');
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(groupName, 'Testing real-time member joining');
        const groupId = groupDetailPage.inferGroupId();

        // User2 joins initially
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage2 = new JoinGroupPage(user2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        await expect(user2Page).toHaveURL(groupDetailUrlPattern(groupId));

        // Wait for initial synchronization (2 members)
        await groupDetailPage.waitForMemberCount(2);
        await user2GroupDetailPage.waitForMemberCount(2);

        // User3 goes to dashboard (will join later and watch from there)
        await user3DashboardPage.navigate();

        // SETUP COMPLETE: User1 on group page, User2 on group page, User3 on dashboard
        // Now User4 will join and others should see real-time updates

        // User4 joins the group
        const joinGroupPage4 = new JoinGroupPage(user4Page);
        await joinGroupPage4.joinGroupUsingShareLink(shareLink);
        await expect(user4Page).toHaveURL(groupDetailUrlPattern(groupId));

        // CRITICAL TEST: User1 and User2 should see member count increase to 3 WITHOUT refresh
        await groupDetailPage.waitForMemberCount(3);
        await user2GroupDetailPage.waitForMemberCount(3);

        // Verify all users can see the new member's name
        await expect(groupDetailPage.getMemberItem(user4DisplayName)).toBeVisible();
        await expect(user2GroupDetailPage.getMemberItem(user4DisplayName)).toBeVisible();

        console.log('✅ Real-time member joining updates working correctly');
    });

    simpleTest('should show real-time notifications when user is added to existing group', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Real-time sync may generate expected transient API errors' });

        // Create three users - Owner (adding), ExistingMember (watching), NewMember (being added via invite)
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: existingPage, dashboardPage: existingDashboardPage, user: existing } = await newLoggedInBrowser();
        const { page: newPage, dashboardPage: newDashboardPage, user: newUser } = await newLoggedInBrowser();

        // Create page objects
        const existingGroupDetailPage = new GroupDetailPage(existingPage, existing);

        // Get display names
        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const existingDisplayName = await existingDashboardPage.getCurrentUserDisplayName();
        const newDisplayName = await newDashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('AddNotifyRT');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing add member notifications');
        const groupId = groupDetailPage.inferGroupId();

        // Existing member joins initially
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPageExisting = new JoinGroupPage(existingPage);
        await joinGroupPageExisting.joinGroupUsingShareLink(shareLink);

        // Wait for initial 2 members
        await groupDetailPage.waitForMemberCount(2);
        await existingGroupDetailPage.waitForMemberCount(2);

        // New user starts on dashboard (they'll join via share link)
        await newDashboardPage.navigate();

        // New user joins the group
        const joinGroupPageNew = new JoinGroupPage(newPage);
        await joinGroupPageNew.joinGroupUsingShareLink(shareLink);
        await expect(newPage).toHaveURL(groupDetailUrlPattern(groupId));

        // CRITICAL TESTS:

        // 1. Owner should see member count increase to 3 in real-time
        await groupDetailPage.waitForMemberCount(3);
        await expect(groupDetailPage.getMemberItem(newDisplayName)).toBeVisible();

        // 2. Existing member should see new member appear in real-time
        await existingGroupDetailPage.waitForMemberCount(3);
        await expect(existingGroupDetailPage.getMemberItem(newDisplayName)).toBeVisible();

        // 3. New user should see all existing members
        const newGroupDetailPage = new GroupDetailPage(newPage, newUser);
        await newGroupDetailPage.waitForMemberCount(3);
        await expect(newGroupDetailPage.getMemberItem(ownerDisplayName)).toBeVisible();
        await expect(newGroupDetailPage.getMemberItem(existingDisplayName)).toBeVisible();

        console.log('✅ Real-time member addition notifications working correctly');
    });
});
