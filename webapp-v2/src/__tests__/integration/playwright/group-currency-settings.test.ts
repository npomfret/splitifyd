import type { ClientUser, GroupCurrencySettings, GroupId, MemberRole } from '@billsplit-wl/shared';
import { toCurrencyISOCode, toExpenseId, toGroupId } from '@billsplit-wl/shared';
import { DashboardPage, ExpenseDTOBuilder, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ListGroupsResponseBuilder, ThemeBuilder } from '@billsplit-wl/test-support';
import { GroupDetailPage } from '@billsplit-wl/test-support';
import type { Page, Route } from '@playwright/test';
import { expect, test } from '../../utils/console-logging-fixture';
import { fulfillWithSerialization, mockActivityFeedApi, mockGroupCommentsApi, mockGroupsApi, mockPendingMembersApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

interface GroupTestSetupOptions {
    groupId?: GroupId;
    groupName?: string;
    currencySettings?: GroupCurrencySettings;
    memberRole?: MemberRole;
    isOwner?: boolean;
    expenses?: ReturnType<ExpenseDTOBuilder['build']>[];
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
    const memberRole = options.memberRole ?? 'admin';
    const isOwner = options.isOwner !== false; // Default to true for backward compatibility

    const buildFullDetails = () => {
        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withName(groupName)
            .withCurrencySettings(options.currencySettings)
            .build();

        const selfMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withMemberRole(memberRole)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        return new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([selfMember])
            .withExpenses(options.expenses ?? [])
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

    test('non-owner member does not see general tab with currency settings', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Member View Test',
            memberRole: 'member',
            isOwner: false, // User is NOT the group owner
            currencySettings: createCurrencySettings(['USD', 'EUR'], 'USD'),
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Member View Test');

        const modal = await groupDetailPage.clickEditGroupAndOpenModal('identity');

        // Non-owner should not see the General tab (currency settings are in General)
        await modal.verifyTabNotVisible('general');
    });

    test('expense form shows only permitted currencies when restrictions enabled', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Expense Form Filter Test',
            currencySettings: createCurrencySettings(['USD', 'EUR'], 'USD'),
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Expense Form Filter Test');

        // Mock expense creation endpoint
        await page.route(`**/api/groups/${groupId}/expenses`, async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({ status: 201, json: { id: 'new-expense-id' } });
            } else {
                await route.continue();
            }
        });

        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm([user.displayName ?? 'Test User']);
        await expenseFormPage.verifyFormModalOpen();

        // Verify USD is available (permitted)
        await expenseFormPage.verifyCurrencyAvailable('USD');

        // Verify EUR is available (permitted)
        await expenseFormPage.verifyCurrencyAvailable('EUR');

        // Verify GBP is not available (not permitted)
        await expenseFormPage.verifyCurrencyNotAvailable('GBP');
    });

    test('expense form uses group default currency for new expenses', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const { groupId } = await setupGroupRoutes(page, user, {
            groupName: 'Default Currency Test',
            currencySettings: createCurrencySettings(['USD', 'EUR', 'GBP'], 'EUR'),
        });

        await setupSuccessfulApiMocks(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Default Currency Test');

        // Mock expense creation endpoint
        await page.route(`**/api/groups/${groupId}/expenses`, async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({ status: 201, json: { id: 'new-expense-id' } });
            } else {
                await route.continue();
            }
        });

        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm([user.displayName ?? 'Test User']);
        await expenseFormPage.verifyFormModalOpen();

        // Verify the form defaults to the group's default currency (EUR)
        await expenseFormPage.verifyCurrencySelected('EUR');
    });

    test('editing expense shows original currency even if not in permitted list', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = toGroupId('group-currency-' + user.uid);

        // Create an expense with JPY currency
        const existingExpense = new ExpenseDTOBuilder()
            .withExpenseId(toExpenseId('existing-expense-1'))
            .withGroupId(groupId)
            .withDescription('Original expense in JPY')
            .withAmount('1000', toCurrencyISOCode('JPY'))
            .withPaidBy(user.uid)
            .withParticipants([user.uid])
            .build();

        // Build group and member for the expense full details response
        const group = new GroupDTOBuilder()
            .withId(groupId)
            .withName('Edit Expense Currency Test')
            .withCurrencySettings(createCurrencySettings(['USD', 'EUR'], 'USD'))
            .build();

        const selfMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName ?? 'Test User')
            .withGroupDisplayName(user.displayName ?? 'Test User')
            .withMemberRole('admin')
            .withTheme(ThemeBuilder.blue().build())
            .build();

        await setupGroupRoutes(page, user, {
            groupId,
            groupName: 'Edit Expense Currency Test',
            // Currency settings that DO NOT include JPY
            currencySettings: createCurrencySettings(['USD', 'EUR'], 'USD'),
            expenses: [existingExpense],
        });

        await setupSuccessfulApiMocks(page);

        // Mock expense full details endpoint (for viewing expense)
        await page.route(`**/api/expenses/${existingExpense.id}/full-details**`, async (route) => {
            await fulfillWithSerialization(route, {
                body: {
                    expense: existingExpense,
                    group: group,
                    members: { members: [selfMember] },
                },
            });
        });

        // Mock expense comments endpoint
        await page.route(`**/api/expenses/${existingExpense.id}/comments**`, async (route) => {
            await fulfillWithSerialization(route, {
                body: { comments: [], totalCount: 0 },
            });
        });

        // Mock expense update endpoint
        await page.route(`**/api/groups/${groupId}/expenses/**`, async (route) => {
            if (route.request().method() === 'PUT') {
                await route.fulfill({ status: 204 });
            } else {
                await route.continue();
            }
        });

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupTitle('Edit Expense Currency Test');

        // Click on the expense to view it
        const expenseDetailPage = await groupDetailPage.clickExpenseToView('Original expense in JPY');

        // Click edit to open the form
        const expenseFormPage = await expenseDetailPage.clickEditExpenseAndReturnForm([user.displayName ?? 'Test User']);

        // Verify the expense still shows JPY even though it's not in the permitted list
        // Note: The currency button shows the current value which should still be JPY
        await expenseFormPage.verifyCurrencySelected('JPY');

        // Note: Full "grandfather" feature (JPY appearing in dropdown when editing)
        // would require additional frontend implementation. For now we just verify
        // the expense retains its original currency when editing.
    });

    test('group creation with currency settings includes settings in request', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const dashboardPage = new DashboardPage(page);

        // Track the create request to verify currency settings
        let capturedRequest: Record<string, unknown> | undefined;

        // Mock list groups (empty initially)
        await mockGroupsApi(
            page,
            new ListGroupsResponseBuilder().build(),
        );
        await mockActivityFeedApi(page, []);

        // Mock create group API - capture the request and return success
        const newGroupId = toGroupId('new-group-with-currency');
        const createdGroup = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(newGroupId)
            .withName('Currency Test Group')
            .withCurrencySettings(createCurrencySettings(['USD', 'EUR'], 'USD'))
            .build();

        await page.route('**/api/groups', async (route) => {
            if (route.request().method() === 'POST') {
                capturedRequest = JSON.parse(route.request().postData() ?? '{}');
                await fulfillWithSerialization(route, { body: createdGroup, status: 201 });
            } else {
                await route.continue();
            }
        });

        // Navigate to dashboard
        await page.goto('/dashboard');
        await dashboardPage.verifyEmptyGroupsState();

        // Open create group modal
        const createGroupModal = await dashboardPage.clickCreateGroup();
        await createGroupModal.verifyModalOpen();

        // Fill basic group info
        await createGroupModal.fillGroupName('Currency Test Group');

        // Enable currency restrictions
        await createGroupModal.toggleCurrencyRestrictions();

        // Verify the add currency button appears
        await createGroupModal.verifyAddCurrencyButtonVisible();

        // Add currencies
        await createGroupModal.addPermittedCurrency('USD');
        await createGroupModal.verifyPermittedCurrencyVisible('USD');

        await createGroupModal.addPermittedCurrency('EUR');
        await createGroupModal.verifyPermittedCurrencyVisible('EUR');

        // Verify default currency is set (should auto-select first added currency)
        await createGroupModal.verifyDefaultCurrencyValue('USD');

        // Change default to EUR
        await createGroupModal.setDefaultCurrency('EUR');
        await createGroupModal.verifyDefaultCurrencyValue('EUR');

        // Submit the form
        await createGroupModal.submitForm();

        // Wait for navigation away from modal (group created)
        await expect(page).toHaveURL(/\/groups\//, { timeout: 10000 });

        // Verify the request included currency settings
        expect(capturedRequest).toBeDefined();
        expect(capturedRequest?.currencySettings).toBeDefined();
        const settings = capturedRequest?.currencySettings as { permitted: string[]; default: string; } | undefined;
        expect(settings?.permitted).toContain('USD');
        expect(settings?.permitted).toContain('EUR');
        expect(settings?.default).toBe('EUR');
    });
});
