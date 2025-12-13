import type { Email, UserId } from '@billsplit-wl/shared';
import type { Locator, Page } from '@playwright/test';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';
import { UserEditorModalPage } from './UserEditorModalPage';

const translation = translationEn.admin.users;

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

    /**
     * Get the table row containing a user by their email
     */
    protected getUserRow(email: Email | string): Locator {
        return this.page.getByRole('row').filter({ hasText: email });
    }

    /**
     * Get the edit button for a user by finding their row first
     */
    protected getEditUserButton(email: Email | string): Locator {
        return this.getUserRow(email).getByRole('button', { name: translation.actions.editUser });
    }

    /**
     * @deprecated Use getEditUserButton(email) instead - uses visible email to locate user
     */
    protected getEditUserButtonByUid(uid: UserId): Locator {
        return this.page.locator(`button[aria-label="${translation.actions.editUser}"]`).filter({
            has: this.page.locator(`[data-uid="${uid}"]`),
        });
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

    /**
     * Click the edit button for a user identified by their email
     */
    async clickEditUser(email: Email | string): Promise<void> {
        await this.clickButtonNoWait(this.getEditUserButton(email), { buttonName: `Edit user ${email}` });
    }

    /**
     * Click edit and wait for the modal to open
     */
    async clickEditUserAndOpenModal(email: Email | string): Promise<UserEditorModalPage> {
        await this.clickEditUser(email);
        const modal = new UserEditorModalPage(this.page);
        await modal.waitForModalToBeVisible();
        return modal;
    }
}
