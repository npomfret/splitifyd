import { ClientUserBuilder } from '@billsplit-wl/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import { createMockFirebase, mockFullyAcceptedPoliciesApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('Email Verification Banner', () => {
    test('should show banner for unverified user', async ({ pageWithLogging }) => {
        // Create an unverified user
        const unverifiedUser = ClientUserBuilder
            .validUser()
            .withEmailVerified(false)
            .build();

        const mockFirebase = await createMockFirebase(pageWithLogging, unverifiedUser);
        await mockFullyAcceptedPoliciesApi(pageWithLogging);
        await setupSuccessfulApiMocks(pageWithLogging, unverifiedUser);

        await pageWithLogging.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // The banner should be visible with the verification message
        const banner = pageWithLogging.getByRole('alert');
        await expect(banner).toBeVisible();
        await expect(banner).toContainText(translationEn.emailVerification.banner.message);

        // The resend button should be visible
        const resendButton = pageWithLogging.getByRole('button', { name: translationEn.emailVerification.banner.resendButton });
        await expect(resendButton).toBeVisible();

        await mockFirebase.dispose();
    });

    test('should not show banner for verified user', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;

        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // The email verification banner should NOT be visible
        // Look for the specific alert with verification message - it should not exist
        const verificationMessage = page.getByText(translationEn.emailVerification.banner.message);
        await expect(verificationMessage).not.toBeVisible();
    });

    test('should show success message after clicking resend button', async ({ pageWithLogging }) => {
        // Create an unverified user
        const unverifiedUser = ClientUserBuilder
            .validUser()
            .withEmailVerified(false)
            .build();

        const mockFirebase = await createMockFirebase(pageWithLogging, unverifiedUser);
        await mockFullyAcceptedPoliciesApi(pageWithLogging);
        await setupSuccessfulApiMocks(pageWithLogging, unverifiedUser);

        // Mock the email verification endpoint
        await pageWithLogging.route('**/api/email-verification', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({}),
            });
        });

        await pageWithLogging.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Click the resend button
        const resendButton = pageWithLogging.getByRole('button', { name: translationEn.emailVerification.banner.resendButton });
        await resendButton.click();

        // The success message should appear
        await expect(pageWithLogging.getByText(translationEn.emailVerification.banner.resendSuccess)).toBeVisible();

        // The resend button should be hidden after success
        await expect(resendButton).not.toBeVisible();

        await mockFirebase.dispose();
    });

    test('should show error message if resend fails', async ({ pageWithLogging }) => {
        // Create an unverified user
        const unverifiedUser = ClientUserBuilder
            .validUser()
            .withEmailVerified(false)
            .build();

        const mockFirebase = await createMockFirebase(pageWithLogging, unverifiedUser);
        await mockFullyAcceptedPoliciesApi(pageWithLogging);
        await setupSuccessfulApiMocks(pageWithLogging, unverifiedUser);

        // Mock the email verification endpoint to fail
        await pageWithLogging.route('**/api/email-verification', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: { code: 'SERVICE_ERROR' } }),
            });
        });

        await pageWithLogging.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Click the resend button
        const resendButton = pageWithLogging.getByRole('button', { name: translationEn.emailVerification.banner.resendButton });
        await resendButton.click();

        // The error message should appear
        await expect(pageWithLogging.getByText(translationEn.emailVerification.banner.resendError)).toBeVisible();

        await mockFirebase.dispose();
    });

    test('should not show banner when user is not logged in', async ({ pageWithLogging }) => {
        // Create mock firebase without a logged-in user
        const mockFirebase = await createMockFirebase(pageWithLogging, null);
        await mockFullyAcceptedPoliciesApi(pageWithLogging);

        await pageWithLogging.goto('/login', { waitUntil: 'domcontentloaded' });

        // The email verification banner should NOT be visible on login page
        const verificationMessage = pageWithLogging.getByText(translationEn.emailVerification.banner.message);
        await expect(verificationMessage).not.toBeVisible();

        await mockFirebase.dispose();
    });
});
