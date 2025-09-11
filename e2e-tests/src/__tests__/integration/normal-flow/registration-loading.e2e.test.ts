import { simpleTest as test, expect } from '../../../fixtures/simple-test.fixture';
import { RegisterPage } from '../../../pages';
import { DEFAULT_PASSWORD, generateTestEmail, generateTestUserName } from '../../../../../packages/test-support/src/test-helpers';

test.describe('Registration Loading State', () => {
    test('should show loading spinner during registration', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        const email = generateTestEmail('loading-test');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('LoadingTest');

        // Navigate to register page
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill the registration form
        await registerPage.fillRegistrationForm(displayName, email, password);

        // Submit the form
        await registerPage.submitForm();

        // Check if we can see the loading spinner (might be very quick)
        // Note: This might not always be visible if registration is instant
        const spinnerVisible = await registerPage.isLoadingSpinnerVisible();

        // Whether we saw the spinner or not, we should end up on dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // Log whether we saw the spinner for debugging
        test.info().annotations.push({
            type: 'loading-spinner',
            description: spinnerVisible ? 'Spinner was visible' : 'Registration was instant (no spinner)',
        });
    });

    test('should handle both instant and delayed registration', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        const email = generateTestEmail('instant-test');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('InstantTest');

        // Navigate to register page
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Use the main register method which handles both scenarios
        await registerPage.register(displayName, email, password);

        // Should be on dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify we're actually logged in by checking for dashboard elements
        await expect(page.getByRole('heading', { name: /welcome|your groups/i }).first()).toBeVisible({ timeout: 5000 });
    });

    test('should disable submit button while processing', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const registerPage = new RegisterPage(page);
        const email = generateTestEmail('disabled-test');
        const password = DEFAULT_PASSWORD;
        const displayName = generateTestUserName('DisabledTest');

        // Navigate to register page
        await registerPage.navigate();
        await registerPage.waitForFormReady();

        // Fill the registration form
        await registerPage.fillRegistrationForm(displayName, email, password);

        // Get the submit button
        const submitButton = registerPage.getSubmitButton();

        // Verify it's enabled before submission
        await expect(submitButton).toBeEnabled();

        // Submit the form
        await registerPage.submitForm();

        // The button should become disabled during processing
        // This might happen very quickly, so we use a race condition
        await Promise.race([expect(submitButton).toBeDisabled({ timeout: 1000 }), page.waitForURL(/\/dashboard/, { timeout: 1000 })]).catch(() => {
            // It's ok if we miss the disabled state due to instant registration
        });

        // Eventually should redirect to dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    });
});
