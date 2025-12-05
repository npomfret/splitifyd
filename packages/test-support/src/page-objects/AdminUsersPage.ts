import type { Locator, Page } from '@playwright/test';
import type { UserId } from '@billsplit-wl/shared';
import { BasePage } from './BasePage';
import { UserEditorModalPage } from './UserEditorModalPage';

/**
 * Page Object for the Admin Users Tab
 *
 * Handles navigation to the users tab and user management actions.
 */
export class AdminUsersPage extends BasePage {
    readonly url = '/admin?tab=users';

    constructor(page: Page) {
        super(page);
    }

    // ✅ Protected locators - internal use only
    protected getEditUserButton(uid: UserId): Locator {
        return this.page.getByTestId(`edit-user-${uid}`);
    }

    // ✅ Navigation
    async navigate(): Promise<void> {
        await this.page.goto(this.url);
        await this.waitForPageReady();
    }

    async waitForPageReady(): Promise<void> {
        await this.page.waitForLoadState('networkidle');
    }

    // ✅ Action methods
    async clickEditUser(uid: UserId): Promise<void> {
        await this.clickButtonNoWait(this.getEditUserButton(uid), { buttonName: `Edit user ${uid}` });
    }

    async clickEditUserAndOpenModal(uid: UserId): Promise<UserEditorModalPage> {
        await this.clickEditUser(uid);
        const modal = new UserEditorModalPage(this.page);
        await modal.waitForModalToBeVisible();
        return modal;
    }
}
