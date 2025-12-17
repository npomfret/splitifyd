import { DashboardPage, GroupDTOBuilder, ListGroupsResponseBuilder, SettingsPage } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockActivityFeedApi, mockGenerateShareLinkApi, mockGroupsApi } from '../../utils/mock-firebase-service';

test.describe('Share Link Language Parameter', () => {
    test('should NOT include lang param when user language is English (default)', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('test-group-1')
            .build();

        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'test-group-1');

        // Navigate to dashboard (default language is English)
        await dashboardPage.navigate();
        await dashboardPage.waitForGroupToAppear('Test Group');

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');
        await shareModal.verifyModalOpen();
        await shareModal.verifyShareLinkDisplayed();

        // Verify share link does NOT contain lang param for English
        await shareModal.verifyShareLinkHasNoLangParam();

        await shareModal.clickClose();
    });

    test('should include lang param when user switches to non-English language', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const settingsPage = new SettingsPage(page);
        const dashboardPage = new DashboardPage(page);

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withName('Test Group')
            .withId('test-group-1')
            .build();

        // Set up all mocks before any navigation
        await mockGroupsApi(
            page,
            ListGroupsResponseBuilder
                .responseWithMetadata([group])
                .build(),
        );
        await mockActivityFeedApi(page, []);
        await mockGenerateShareLinkApi(page, 'test-group-1');

        // Navigate to settings and switch language to Ukrainian
        await settingsPage.navigate();
        await settingsPage.selectLanguage('uk');
        await settingsPage.verifyLanguageSelected('uk');

        // Navigate to dashboard
        await page.goto('/dashboard');
        await dashboardPage.waitForGroupToAppear('Test Group');

        const shareModal = await dashboardPage.clickGroupCardInviteButton('Test Group');
        await shareModal.verifyModalOpen();
        await shareModal.verifyShareLinkDisplayed();

        // Verify share link contains lang=uk
        await shareModal.verifyShareLinkContainsLang('uk');

        await shareModal.clickClose();
    });
});
