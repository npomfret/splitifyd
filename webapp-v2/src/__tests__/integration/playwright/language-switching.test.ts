import { SettingsPage } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';

test.describe('Language Switching', () => {
    test('should display language selection section on settings page', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        await settingsPage.navigate();

        await settingsPage.verifyLanguageSectionVisible();
        await settingsPage.verifyLanguageSelected('en');
    });

    test('should switch language from English to Arabic and update UI', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        await settingsPage.navigate();

        // Verify starting in English
        await settingsPage.verifyLanguageSelected('en');
        await settingsPage.verifyLanguageSectionHeadingText('Language');

        // Switch to Arabic
        await settingsPage.selectLanguage('ar');

        // Verify language changed
        await settingsPage.verifyLanguageSelected('ar');

        // Verify UI text changed to Arabic - "اللغة" means "Language" in Arabic
        await settingsPage.verifyLanguageSectionHeadingText('اللغة');

        // Verify the page is now RTL
        await settingsPage.verifyPageDirectionIsRTL();
    });

    test('should switch language back from Arabic to English', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const settingsPage = new SettingsPage(page);

        await settingsPage.navigate();

        // Switch to Arabic first
        await settingsPage.selectLanguage('ar');
        await settingsPage.verifyLanguageSelected('ar');
        await settingsPage.verifyLanguageSectionHeadingText('اللغة');

        // Switch back to English
        await settingsPage.selectLanguage('en');

        // Verify language changed back
        await settingsPage.verifyLanguageSelected('en');
        await settingsPage.verifyLanguageSectionHeadingText('Language');

        // Verify the page is now LTR
        await settingsPage.verifyPageDirectionIsLTR();
    });
});
