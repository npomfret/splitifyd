import { GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementWithMembersBuilder, ThemeBuilder } from '@splitifyd/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import { GroupId } from "@splitifyd/shared";
import { fulfillWithSerialization } from '../../utils/mock-firebase-service';

/**
 * Helper function to mock the group full-details API endpoint with settlements
 */
async function mockGroupFullDetailsApi(page: any, groupId: GroupId, response: any): Promise<void> {
    await page.route(`/api/groups/${groupId}/full-details*`, async (route: any) => {
        await fulfillWithSerialization(route, { body: response });
    });
}

test.describe('Settlement History - Locked Settlement UI', () => {
    test('should display disabled edit button when settlement is locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-123';

        // Create group members for settlement
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

        // Create a locked settlement
        const lockedSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-123')
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherUser)
            .withAmount(50.0, 'USD')
            .withNote('Test Payment')
            .withIsLocked(true) // Mark as locked
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();

        const members = [testUserMember, otherUser];

        // Mock the group full-details API response with locked settlement
        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withSettlements([lockedSettlement])
            .build();

        await mockGroupFullDetailsApi(page, groupId, fullDetails);

        // Navigate to group detail page
        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // Wait for group to load
        await expect(page.getByRole('heading', { name: 'Test Group' })).toBeVisible();

        // Open payment history if not already open
        const showHistoryButton = page.getByRole('button', { name: /show history/i });
        if (await showHistoryButton.isVisible()) {
            await showHistoryButton.click();
        }

        // Wait for settlement to appear
        await expect(page.getByTestId('settlement-item')).toBeVisible();

        // Verify the settlement is displayed
        await expect(page.getByText('Test Payment')).toBeVisible();

        // Find the edit button
        const editButton = page.getByTestId('edit-settlement-button');
        await expect(editButton).toBeVisible();

        // Verify edit button is disabled
        await expect(editButton).toBeDisabled();

        // Verify tooltip is present
        await expect(editButton).toHaveAttribute('title', translationEn.settlementHistory.cannotEditTooltip);
    });

    test('should enable edit button when settlement is not locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-456';

        // Create group members for settlement
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

        // Create an unlocked settlement
        const unlockedSettlement = new SettlementWithMembersBuilder()
            .withId('settlement-456')
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherUser)
            .withAmount(30.0, 'USD')
            .withNote('Normal Payment')
            // isLocked defaults to false
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();

        const members = [testUserMember, otherUser];

        // Mock the group full-details API response with unlocked settlement
        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withSettlements([unlockedSettlement])
            .build();

        await mockGroupFullDetailsApi(page, groupId, fullDetails);

        // Navigate to group detail page
        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // Wait for group to load
        await expect(page.getByRole('heading', { name: 'Test Group' })).toBeVisible();

        // Open payment history if not already open
        const showHistoryButton = page.getByRole('button', { name: /show history/i });
        if (await showHistoryButton.isVisible()) {
            await showHistoryButton.click();
        }

        // Wait for settlement to appear
        await expect(page.getByTestId('settlement-item')).toBeVisible();

        // Verify the settlement is displayed
        await expect(page.getByText('Normal Payment')).toBeVisible();

        // Find the edit button
        const editButton = page.getByTestId('edit-settlement-button');
        await expect(editButton).toBeVisible();

        // Verify edit button is enabled
        await expect(editButton).toBeEnabled();

        // Verify tooltip shows edit message
        await expect(editButton).toHaveAttribute('title', translationEn.settlementHistory.editPaymentTooltip);
    });

    test('should reactively update when settlement lock status changes', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-789';

        // Create group members for settlement
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

        // Create initially unlocked settlement
        const settlement = new SettlementWithMembersBuilder()
            .withId('settlement-789')
            .withGroupId(groupId)
            .withPayer(testUserMember)
            .withPayee(otherUser)
            .withAmount(25.0, 'USD')
            .withNote('Reactive Test Payment')
            .withIsLocked(false) // Start unlocked
            .build();

        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();

        const members = [testUserMember, otherUser];

        // Initial response with unlocked settlement
        await mockGroupFullDetailsApi(
            page,
            groupId,
            new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .withSettlements([settlement])
                .build(),
        );

        // Navigate to group detail page
        await page.goto(`/groups/${groupId}`, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // Wait for group to load
        await expect(page.getByRole('heading', { name: 'Test Group' })).toBeVisible();

        // Open payment history
        const showHistoryButton = page.getByRole('button', { name: /show history/i });
        if (await showHistoryButton.isVisible()) {
            await showHistoryButton.click();
        }

        // Wait for settlement to appear
        await expect(page.getByTestId('settlement-item')).toBeVisible();

        // Verify edit button is initially enabled
        const editButton = page.getByTestId('edit-settlement-button');
        await expect(editButton).toBeVisible();
        await expect(editButton).toBeEnabled();

        // Update the mock to return locked settlement
        const lockedSettlement = { ...settlement, isLocked: true };
        await mockGroupFullDetailsApi(
            page,
            groupId,
            new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .withSettlements([lockedSettlement])
                .build(),
        );

        // Trigger a refresh by navigating away and back
        await page.goto('/dashboard');
        await page.goto(`/groups/${groupId}`, { timeout: 10000 });

        // Wait for group to load again
        await expect(page.getByRole('heading', { name: 'Test Group' })).toBeVisible();

        // Open payment history again
        const showHistoryButtonAgain = page.getByRole('button', { name: /show history/i });
        if (await showHistoryButtonAgain.isVisible()) {
            await showHistoryButtonAgain.click();
        }

        // Wait for settlement to appear
        await expect(page.getByTestId('settlement-item')).toBeVisible();

        // Verify edit button is now disabled (reactively updated)
        await expect(editButton).toBeDisabled();
        await expect(editButton).toHaveAttribute('title', translationEn.settlementHistory.cannotEditTooltip);
    });
});
