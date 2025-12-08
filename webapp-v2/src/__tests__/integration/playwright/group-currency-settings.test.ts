import type { ClientUser, CurrencyISOCode, GroupCurrencySettings, GroupId } from '@billsplit-wl/shared';
import { toCurrencyISOCode, toGroupId } from '@billsplit-wl/shared';
import { GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@billsplit-wl/test-support';
import type { Page, Route } from '@playwright/test';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockGroupCommentsApi, mockPendingMembersApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';
import { GroupDetailPage } from '@billsplit-wl/test-support';

interface GroupTestSetupOptions {
    groupId?: GroupId;
    groupName?: string;
    currencySettings?: GroupCurrencySettings;
    onGroupUpdate?: (route: Route, body: Record<string, unknown>) => Promise<boolean> | boolean;
}

function createCurrencySettings(permitted: string[], defaultCurrency: string): GroupCurrencySettings {
    return {
        permitted: permitted.map(c => toCurrencyISOCode(c)),
        default: toCurrencyISOCode(defaultCurrency),
    };
}

async function setupGroupRoutes(page: Page, user: ClientUser, options: GroupTestSetupOptions = {}): Promise<{ groupId: GroupId; groupName: string; }> {
    const groupId = options.groupId ?? toGroupId('group-currency-' + user.uid);
    const groupName = options.groupName ?? 'Test Group';

    const buildFullDetails = () => {
        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withName(groupName)
            .withCreatedBy(user.uid)
            .withCurrencySettings(options.currencySettings)
            .build();

        const selfMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withMemberRole('admin')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        return new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([selfMember])
            .build();
    };

    await page.route(`**/api/groups/${groupId}/full-details**`, async (route) => {
        await fulfillWithSerialization(route, { body: buildFullDetails() });
    });

    await mockGroupCommentsApi(page, groupId);
    await mockPendingMembersApi(page, groupId, []);

    // Mock group update endpoint
    await page.route(`**/api/groups/${groupId}`, async (route) => {
        if (route.request().method() === 'PUT') {
            const body = JSON.parse(route.request().postData() ?? '{}');

            if (options.onGroupUpdate) {
                const handled = await options.onGroupUpdate(route, body);
                if (handled) return;
            }

            await route.fulfill({ status: 204 });
        } else {
            await route.continue();
        }
    });

    return { groupId, groupName };
}

test.describe('Group Settings - Currency Settings', () => {
    test('admin sees currency restrictions toggle in general tab', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, { groupName: 'Currency Test Group' });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Currency Test Group');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Verify currency restrictions toggle is visible for admin
        await modal.verifyCurrencyRestrictionsToggleVisible();
    });

    test('enabling currency restrictions shows permitted currencies section', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, { groupName: 'Enable Currency Test' });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Enable Currency Test');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Toggle currency restrictions on
        await modal.toggleCurrencyRestrictions();

        // Verify add currency button appears
        await modal.verifyAddCurrencyButtonVisible();
    });

    test('admin can add permitted currencies', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, { groupName: 'Add Currency Test' });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Add Currency Test');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Toggle currency restrictions on
        await modal.toggleCurrencyRestrictions();

        // Add USD currency
        await modal.addPermittedCurrency('USD');

        // Verify USD chip appears
        await modal.verifyPermittedCurrencyVisible('USD');
    });

    test('admin can remove permitted currencies', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Remove Currency Test',
            currencySettings: createCurrencySettings(['USD', 'EUR', 'GBP'], 'USD'),
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Remove Currency Test');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Verify existing currencies are shown
        await modal.verifyPermittedCurrencyVisible('EUR');

        // Remove EUR
        await modal.removePermittedCurrency('EUR');

        // Verify EUR is no longer visible
        await modal.verifyPermittedCurrencyNotVisible('EUR');
    });

    test('admin can save currency settings', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        let savedCurrencySettings: Record<string, unknown> | undefined;

        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Save Currency Settings Test',
            onGroupUpdate: async (route, body) => {
                savedCurrencySettings = body.currencySettings as Record<string, unknown> | undefined;
                await route.fulfill({ status: 204 });
                return true;
            },
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Save Currency Settings Test');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Toggle currency restrictions on
        await modal.toggleCurrencyRestrictions();

        // Add currencies
        await modal.addPermittedCurrency('USD');
        await modal.addPermittedCurrency('EUR');

        // Save currency settings
        await modal.saveCurrencySettings();

        // Verify success message
        await modal.verifyCurrencySettingsSuccessVisible();

        // Verify the API was called with currency settings
        expect(savedCurrencySettings).toBeDefined();
        expect(savedCurrencySettings?.permitted).toContain('USD');
        expect(savedCurrencySettings?.permitted).toContain('EUR');
    });

    test('group with existing currency settings displays them correctly', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Existing Settings Test',
            currencySettings: createCurrencySettings(['USD', 'EUR', 'GBP'], 'EUR'),
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Existing Settings Test');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Verify existing currencies are displayed
        await modal.verifyPermittedCurrencyVisible('USD');
        await modal.verifyPermittedCurrencyVisible('EUR');
        await modal.verifyPermittedCurrencyVisible('GBP');

        // Verify default currency
        await modal.verifyDefaultCurrencyValue('EUR');
    });

    test('admin can change default currency', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Change Default Test',
            currencySettings: createCurrencySettings(['USD', 'EUR', 'GBP'], 'USD'),
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Change Default Test');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('general');

        // Verify initial default
        await modal.verifyDefaultCurrencyValue('USD');

        // Change default to GBP
        await modal.setDefaultCurrency('GBP');

        // Verify new default
        await modal.verifyDefaultCurrencyValue('GBP');
    });
});
