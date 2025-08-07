# Task: Remove /v2 URLs

The following files contain `/v2` URLs that need to be removed.

## Webapp

-   `package-lock.json`:
    -   L1690: `"integrity": "sha512-y9D1ntS1ruO/pZ/V2FtLE+JXLQe28XoRpZ7QCCo0T8LdQladzdcOVQZH/IWLVJvCw12OGMb6hYOeOAjntCmJRQ=="`
-   `public/robots.txt`:
    -   L17: # Block private areas served under /v2/ prefix
    -   L18: Disallow: /v2/dashboard
    -   L19: Disallow: /v2/groups/
    -   L20: Disallow: /v2/group/
    -   L21: Disallow: /v2/add-expense
    -   L22: Disallow: /v2/expenses/
    -   L23: Disallow: /v2/join
-   `src/App.tsx`:
    -   L18: // In production, we're served at /v2/ so we need to handle that prefix
    -   L19: const prefix = import.meta.env.PROD ? '/v2' : '';
    -   L57: <Route path="/v2/pricing" component={PricingPage} />
    -   L60: <Route path="/v2/terms-of-service" component={TermsOfServicePage} />
    -   L63: <Route path="/v2/terms" component={TermsOfServicePage} />
    -   L66: <Route path="/v2/privacy-policy" component={PrivacyPolicyPage} />
    -   L69: <Route path="/v2/privacy" component={PrivacyPolicyPage} />
    -   L72: <Route path="/v2/cookies-policy" component={CookiePolicyPage} />
    -   L75: <Route path="/v2/cookies" component={CookiePolicyPage} />
-   `src/__tests__/integration/App.integration.test.tsx`:
    -   L73: // Test that both /pricing and /v2/pricing work
    -   L79: window.history.replaceState({}, '', '/v2/pricing');
-   `src/components/__tests__/StaticPageLayout.navigation.test.tsx`:
    -   L19: expect(pricingLink).toHaveAttribute('href', '/v2/pricing');
    -   L30: expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/v2/terms');
    -   L31: expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/v2/privacy');
    -   L32: expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute('href', '/v2/cookies');
-   `src/components/__tests__/StaticPageLayout.test.tsx`:
    -   L36: expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/v2/pricing');
    -   L47: expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/v2/terms');
    -   L48: expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/v2/privacy');
    -   L49: expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute('href', '/v2/cookies');
-   `src/components/layout/Footer.tsx`:
    -   L19: <a href="/v2/pricing" class="text-sm text-gray-600 hover:text-purple-600 transition-colors">
    -   L31: <a href="/v2/terms" class="text-sm text-gray-600 hover:text-purple-600 transition-colors">
    -   L36: <a href="/v2/privacy" class="text-sm text-gray-600 hover:text-purple-600 transition-colors">
    -   L41: <a href="/v2/cookies" class="text-sm text-gray-600 hover:text-purple-600 transition-colors">
-   `src/pages/RegisterPage.tsx`:
    -   L177: href="/v2/terms"
    -   L198: href="/v2/cookies"
-   `src/pages/static/CookiePolicyPage.tsx`:
    -   L9: const canonical = `${baseUrl}/v2/cookies`;
-   `src/pages/static/PricingPage.tsx`:
    -   L5: const canonical = `${baseUrl}/v2/pricing`;
-   `src/pages/static/PrivacyPolicyPage.tsx`:
    -   L9: const canonical = `${baseUrl}/v2/privacy-policy`;
-   `src/pages/static/TermsOfServicePage.tsx`:
    -   L9: const canonical = `${baseUrl}/v2/terms`;

## E2E Tests

-   `src/helpers/emulator-utils.ts`:
    -   L9: export const EMULATOR_URL = `http://localhost:${HOSTING_PORT}`; // App uses root URLs, not /v2 prefix
-   `src/pages/dashboard.page.ts`:
    -   L8: readonly url = '/v2/dashboard';
-   `src/pages/login.page.ts`:
    -   L6: readonly url = '/v2/login';
-   `src/pages/register.page.ts`:
    -   L6: readonly url = '/v2/register';
-   `src/tests/error-testing/duplicate-registration.e2e.test.ts`:
    -   L118: return path === '/' || path === '/login' || path === '/home' || path === '/v2';
    -   L179: return path === '/' || path === '/login' || path === '/home' || path === '/v2';
-   `src/tests/normal-flow/terms-acceptance.e2e.test.ts`:
    -   L22: await expect(page.locator('a[href="/v2/terms"]').first()).toBeVisible();
    -   L23: await expect(page.locator('a[href="/v2/cookies"]').first()).toBeVisible();
-   `src/tests/run-mcp-debug.ts`:
    -   L30: npx tsx e2e/run-mcp-debug.ts --test "should show form fields on login page" --url "http://localhost:${HOSTING_PORT}/v2/login"
    -   L51: const url = args.url || `http://localhost:${HOSTING_PORT}/v2`;
