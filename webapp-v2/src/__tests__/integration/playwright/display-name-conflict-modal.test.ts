import type { Page } from '@playwright/test';
import type { ClientUser, GroupId } from '@splitifyd/shared';
import type { GroupName } from '@splitifyd/shared';
import { DisplayNameConflictModalPage, JoinGroupPage, JoinGroupResponseBuilder, PreviewGroupResponseBuilder, TEST_TIMEOUTS } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupPreviewApi, mockJoinGroupApi, mockUpdateGroupDisplayNameApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';
import {toGroupId} from "@splitifyd/shared";

interface ConflictModalOptions {
    groupName?: string;
    groupId?: string;
    linkId?: string;
}

interface ConflictModalContext {
    joinGroupPage: JoinGroupPage;
    conflictModal: DisplayNameConflictModalPage;
    groupId: GroupId;
    groupName: GroupName;
    userDisplayName: string;
    page: Page;
}

async function openConflictModal(authenticatedPage: { page: Page; user: ClientUser; }, options: ConflictModalOptions = {},): Promise<ConflictModalContext> {
    const { page, user } = authenticatedPage;
    const groupName = options.groupName ?? 'Design Team';
    const groupId = options.groupId ?? 'group-conflict-123';
    const linkId = options.linkId ?? 'test-link-123';

    await setupSuccessfulApiMocks(page);

    const previewResponse = PreviewGroupResponseBuilder
        .newMember()
        .withGroupName(groupName)
        .build();
    await mockGroupPreviewApi(page, previewResponse);

    const joinResponse = new JoinGroupResponseBuilder()
        .withGroupId(groupId)
        .withGroupName(groupName)
        .withDisplayNameConflict(true)
        .build();
    await mockJoinGroupApi(page, joinResponse);

    const joinGroupPage = new JoinGroupPage(page);
    await page.goto(`/join?linkId=${encodeURIComponent(linkId)}`);
    await joinGroupPage.verifyJoinGroupHeadingVisible();

    await joinGroupPage.clickJoinGroupButton();
    const conflictModal = await joinGroupPage.openDisplayNameConflictModal();

    return {
        joinGroupPage,
        conflictModal,
        groupId: toGroupId(groupId),
        groupName,
        userDisplayName: user.displayName,
        page,
    };
}

test.describe('DisplayNameConflictModal', () => {
    test('shows group context and focuses input when opened', async ({ authenticatedPage }) => {
        const { conflictModal, userDisplayName, groupName } = await openConflictModal(authenticatedPage);

        await conflictModal.verifyTitleContains(groupName);
        await conflictModal.verifyDescriptionContains(userDisplayName);
        await conflictModal.verifyCurrentNameVisible(userDisplayName);
        await conflictModal.verifyInputFocused();
    });

    test('prevents submitting unchanged display name', async ({ authenticatedPage }) => {
        const { conflictModal } = await openConflictModal(authenticatedPage);

        await conflictModal.submit();
        await conflictModal.verifyValidationErrorContains('Choose a different name than your current one.');
    });

    test('requires a non-empty display name and clears validation error when typing', async ({ authenticatedPage }) => {
        const { conflictModal } = await openConflictModal(authenticatedPage);

        await conflictModal.fillDisplayName('');
        await conflictModal.submit();
        await conflictModal.verifyValidationErrorContains('Enter a display name.');

        await conflictModal.fillDisplayName('New Unique Name');
        await conflictModal.verifyNoValidationError();
    });

    test('enforces maximum display name length', async ({ authenticatedPage }) => {
        const { conflictModal } = await openConflictModal(authenticatedPage);

        await conflictModal.fillDisplayName('A'.repeat(51));
        await conflictModal.submit();
        await conflictModal.verifyValidationErrorContains('Display name must be 50 characters or fewer.');
    });

    test('resolves conflict when a new name is provided', async ({ authenticatedPage }) => {
        const context = await openConflictModal(authenticatedPage);
        const { conflictModal, joinGroupPage, page, groupId } = context;

        await mockUpdateGroupDisplayNameApi(page, groupId, { message: 'ok' }, { once: true });

        await conflictModal.fillDisplayName('Product Hero');
        await conflictModal.submit();
        await conflictModal.waitForClose(TEST_TIMEOUTS.API_RESPONSE);

        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
        await joinGroupPage.verifySuccessHeadingContains('Welcome');
    });

    test('shows server error and clears it after editing', async ({ authenticatedPage }) => {
        const context = await openConflictModal(authenticatedPage);
        const { conflictModal, joinGroupPage, page, groupId } = context;

        await mockUpdateGroupDisplayNameApi(page, groupId, { message: 'ok' });
        await mockUpdateGroupDisplayNameApi(
            page,
            groupId,
            { message: 'This name is already taken.' },
            { status: 400, once: true },
        );

        await conflictModal.fillDisplayName('Existing Member');
        await conflictModal.submit();

        await expect(conflictModal.getServerError()).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });

        await conflictModal.fillDisplayName('Another Unique Name');
        await conflictModal.verifyNoServerError();
        await conflictModal.submit();
        await conflictModal.waitForClose(TEST_TIMEOUTS.API_RESPONSE);

        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
    });

    test('cancels conflict flow via cancel button', async ({ authenticatedPage }) => {
        const context = await openConflictModal(authenticatedPage);
        const { conflictModal, joinGroupPage } = context;

        await conflictModal.clickCancel();
        await conflictModal.waitForClose();

        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
    });

    test('cancels conflict flow via escape key', async ({ authenticatedPage }) => {
        const context = await openConflictModal(authenticatedPage);
        const { conflictModal, joinGroupPage, page } = context;

        await page.keyboard.press('Escape');
        await conflictModal.waitForClose();

        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
    });

    test('disables controls while saving the new name', async ({ authenticatedPage }) => {
        const context = await openConflictModal(authenticatedPage);
        const { conflictModal, joinGroupPage, page, groupId } = context;

        await mockUpdateGroupDisplayNameApi(page, groupId, { message: 'ok' }, { delayMs: 500 });

        await conflictModal.fillDisplayName('Delayed Update');
        await conflictModal.submit();
        await conflictModal.verifySavingStateVisible();

        await conflictModal.waitForClose(TEST_TIMEOUTS.API_RESPONSE);

        await joinGroupPage.verifyJoinSuccessIndicatorVisible();
    });
});
