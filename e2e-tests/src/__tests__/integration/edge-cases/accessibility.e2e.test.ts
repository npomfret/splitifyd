import AxeBuilder from '@axe-core/playwright';
import {waitForApp} from "../../../helpers";
import { pageTest as test, expect } from '../../../fixtures/page-fixtures';

// Simplified accessibility test - just basic axe scan
test.describe('Accessibility Tests', () => {
    test('should not have critical accessibility issues', async ({ homepageNavigated }) => {
        const { page } = homepageNavigated;
        await waitForApp(page);

        // Run basic accessibility scan
        const accessibilityScanResults = await new AxeBuilder({ page })
            .disableRules(['color-contrast']) // Disable while design is in flux
            .analyze();

        // Only fail on critical violations
        const criticalViolations = accessibilityScanResults.violations.filter((v) => v.impact === 'critical');
        expect(criticalViolations).toHaveLength(0);
    });
});
