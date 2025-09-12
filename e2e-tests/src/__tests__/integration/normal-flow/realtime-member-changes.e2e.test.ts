import { simpleTest, expect } from '../../../fixtures';
import { GroupDetailPage, JoinGroupPage } from '../../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';

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

    simpleTest('should show member removal in real-time to all viewers', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when removed members lose access to group' });

        // Create four users - Owner (removing), Member1 (being removed), Member2 (group watching), Member3 (dashboard watching)
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: member1Page, dashboardPage: member1DashboardPage, user: member1 } = await newLoggedInBrowser();
        const { page: member2Page, dashboardPage: member2DashboardPage, user: member2 } = await newLoggedInBrowser();
        const { page: member3Page, dashboardPage: member3DashboardPage, user: member3 } = await newLoggedInBrowser();

        // Create page objects
        const member2GroupDetailPage = new GroupDetailPage(member2Page, member2);

        // Get display names
        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const member1DisplayName = await member1DashboardPage.getCurrentUserDisplayName();
        const member2DisplayName = await member2DashboardPage.getCurrentUserDisplayName();
        const member3DisplayName = await member3DashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('MemberRemoveRT');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing real-time member removal');
        const groupId = groupDetailPage.inferGroupId();

        // All members join
        const shareLink = await groupDetailPage.getShareLink();

        const joinGroupPage1 = new JoinGroupPage(member1Page);
        await joinGroupPage1.joinGroupUsingShareLink(shareLink);
        const joinGroupPage2 = new JoinGroupPage(member2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        const joinGroupPage3 = new JoinGroupPage(member3Page);
        await joinGroupPage3.joinGroupUsingShareLink(shareLink);

        // Wait for all 4 members to be present
        await groupDetailPage.waitForMemberCount(4);
        await member2GroupDetailPage.waitForMemberCount(4);

        // Position viewers: Member2 stays on group page, Member3 goes to dashboard
        await member3DashboardPage.navigate();
        await member3DashboardPage.waitForGroupToAppear(groupName);

        // Owner removes Member1
        const removeMember1Modal = await groupDetailPage.clickRemoveMember(member1DisplayName);
        await removeMember1Modal.confirmRemoveMember();

        // CRITICAL TESTS:

        // 1. Member1 (being removed) should get 404 when accessing group
        await expect(async () => {
            const currentUrl = member1Page.url();
            if (currentUrl.includes('/404')) return;
            await member1Page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
            const newUrl = member1Page.url();
            if (newUrl.includes('/404')) return;
            throw new Error(`Expected 404 after removal, got: ${currentUrl}`);
        }).toPass({ timeout: 10000, intervals: [1000] });

        // 2. Member2 (watching group) should see member count decrease to 3 WITHOUT refresh
        await member2GroupDetailPage.waitForMemberCount(3);
        await member2GroupDetailPage.verifyMemberNotVisible(member1DisplayName);

        // 3. Owner should see updated member count
        await groupDetailPage.waitForMemberCount(3);
        await groupDetailPage.verifyMemberNotVisible(member1DisplayName);

        // 4. Member3 (on dashboard) should still see the group but removed member can't access
        await member3DashboardPage.waitForGroupToAppear(groupName);

        console.log('✅ Real-time member removal updates working correctly');
    });

    simpleTest('should handle concurrent member changes', async ({ newLoggedInBrowser }, testInfo) => {
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors and concurrent operations may cause transient errors' });

        // Create five users - Owner, Member1 (being removed), Member2 (leaving), NewMember (joining), Watcher
        const { page: ownerPage, dashboardPage: ownerDashboardPage, user: owner } = await newLoggedInBrowser();
        const { page: member1Page, dashboardPage: member1DashboardPage, user: member1 } = await newLoggedInBrowser();
        const { page: member2Page, dashboardPage: member2DashboardPage, user: member2 } = await newLoggedInBrowser();
        const { page: newMemberPage, dashboardPage: newMemberDashboardPage, user: newMember } = await newLoggedInBrowser();
        const { page: watcherPage, dashboardPage: watcherDashboardPage, user: watcher } = await newLoggedInBrowser();

        // Create page objects
        const member2GroupDetailPage = new GroupDetailPage(member2Page, member2);
        const watcherGroupDetailPage = new GroupDetailPage(watcherPage, watcher);

        // Get display names
        const ownerDisplayName = await ownerDashboardPage.getCurrentUserDisplayName();
        const member1DisplayName = await member1DashboardPage.getCurrentUserDisplayName();
        const member2DisplayName = await member2DashboardPage.getCurrentUserDisplayName();
        const newMemberDisplayName = await newMemberDashboardPage.getCurrentUserDisplayName();
        const watcherDisplayName = await watcherDashboardPage.getCurrentUserDisplayName();

        // Owner creates group
        const groupName = generateTestGroupName('ConcurrentRT');
        const groupDetailPage = await ownerDashboardPage.createGroupAndNavigate(groupName, 'Testing concurrent member changes');
        const groupId = groupDetailPage.inferGroupId();

        // Initial members join (owner, member1, member2, watcher = 4 total)
        const shareLink = await groupDetailPage.getShareLink();

        const joinGroupPage1 = new JoinGroupPage(member1Page);
        await joinGroupPage1.joinGroupUsingShareLink(shareLink);
        const joinGroupPage2 = new JoinGroupPage(member2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);
        const joinGroupPageWatcher = new JoinGroupPage(watcherPage);
        await joinGroupPageWatcher.joinGroupUsingShareLink(shareLink);

        // Wait for initial 4 members
        await groupDetailPage.waitForMemberCount(4);
        await watcherGroupDetailPage.waitForMemberCount(4);

        // CONCURRENT OPERATIONS:
        // 1. Owner removes Member1
        // 2. Member2 leaves group
        // 3. NewMember joins group
        // All happening rapidly in sequence

        // Operation 1: Owner removes Member1
        const removeMemberModal = await groupDetailPage.clickRemoveMember(member1DisplayName);
        await removeMemberModal.confirmRemoveMember();

        // Operation 2: Member2 leaves (almost simultaneously)
        const leaveModal = await member2GroupDetailPage.clickLeaveGroup();
        await leaveModal.confirmLeaveGroup();

        // Operation 3: NewMember joins
        const joinGroupPageNew = new JoinGroupPage(newMemberPage);
        await joinGroupPageNew.joinGroupUsingShareLink(shareLink);

        // FINAL STATE VERIFICATION:
        // Started with: Owner, Member1, Member2, Watcher (4)
        // Removed: Member1, Member2 (-2)
        // Added: NewMember (+1)
        // Final: Owner, Watcher, NewMember (3)

        // Watcher should see final count of 3 members
        await watcherGroupDetailPage.waitForMemberCount(3);

        // Owner should see final count of 3
        await groupDetailPage.waitForMemberCount(3);

        // Verify correct members are present
        await expect(groupDetailPage.getMemberItem(newMemberDisplayName)).toBeVisible();
        await expect(watcherGroupDetailPage.getMemberItem(newMemberDisplayName)).toBeVisible();

        // Verify removed/left members are not present
        await groupDetailPage.verifyMemberNotVisible(member1DisplayName);
        await groupDetailPage.verifyMemberNotVisible(member2DisplayName);

        // Member1 should get 404 (was removed)
        await expect(async () => {
            const currentUrl = member1Page.url();
            if (currentUrl.includes('/404') || currentUrl.includes('/dashboard')) return;
            await member1Page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
            const newUrl = member1Page.url();
            if (newUrl.includes('/404') || newUrl.includes('/dashboard')) return;
            throw new Error(`Expected 404 or dashboard after removal, got: ${currentUrl}`);
        }).toPass({ timeout: 15000, intervals: [1000] });

        // Member2 should be on dashboard (they left voluntarily)
        await expect(async () => {
            const currentUrl = member2Page.url();
            if (currentUrl.includes('/dashboard')) return;
            await member2Page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
            const newUrl = member2Page.url();
            if (newUrl.includes('/dashboard')) return;
            throw new Error(`Expected dashboard after leaving, got: ${currentUrl}`);
        }).toPass({ timeout: 10000, intervals: [1000] });

        console.log('✅ Concurrent member changes handled correctly');
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
