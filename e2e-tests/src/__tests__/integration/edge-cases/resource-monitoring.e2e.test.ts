import { pageTest, expect } from '../../../fixtures';
import { setupMCPDebugOnFailure } from '../../../helpers';

pageTest.describe('Resource Monitoring', () => {
    pageTest('should load all resources successfully across main pages', async ({ page, homepagePage, loginPage, registerPage, pricingPage }) => {
        const failedRequests: string[] = [];
        const resourceTypes: Map<string, number> = new Map();

        // Monitor all requests and categorize by type
        page.on('response', (response) => {
            const url = response.url();
            const status = response.status();
            
            // Track resource types
            const resourceType = getResourceType(url);
            resourceTypes.set(resourceType, (resourceTypes.get(resourceType) || 0) + 1);
            
            // Track failed requests
            if (status >= 400) {
                failedRequests.push(`${status} - ${url}`);
            }
            
            // No 4xx or 5xx errors should occur
            expect(status).toBeLessThan(400);
        });

        // Visit all main pages
        await homepagePage.navigate();
        await page.waitForLoadState('networkidle');
        
        await loginPage.navigate();
        await page.waitForLoadState('networkidle');
        
        await registerPage.navigate();
        await page.waitForLoadState('networkidle');
        
        await pricingPage.navigate();
        await page.waitForLoadState('networkidle');

        // Verify no failed requests
        expect(failedRequests).toHaveLength(0);

        // Verify reasonable resource counts
        expect(resourceTypes.get('html') || 0).toBeGreaterThan(0);
        expect(resourceTypes.get('javascript') || 0).toBeGreaterThan(0);
        expect(resourceTypes.get('css') || 0).toBeGreaterThan(0);
        
        // Resource count sanity checks
        const totalResources = Array.from(resourceTypes.values()).reduce((sum, count) => sum + count, 0);
        expect(totalResources).toBeLessThan(100); // Reasonable total resource count
    });

    pageTest('should have acceptable response times', async ({ page, homepagePage }) => {
        const responseStartTimes = new Map<string, number>();
        const slowRequests: string[] = [];
        
        page.on('request', (request) => {
            responseStartTimes.set(request.url(), Date.now());
        });
        
        page.on('response', async (response) => {
            const startTime = responseStartTimes.get(response.url());
            if (startTime) {
                const duration = Date.now() - startTime;
                
                // Flag slow requests (over 2 seconds)
                if (duration > 2000) {
                    slowRequests.push(`${response.url()} took ${duration}ms`);
                }
                responseStartTimes.delete(response.url());
            }
        });

        await homepagePage.navigate();
        await page.waitForLoadState('networkidle');

        // Verify no excessively slow requests
        expect(slowRequests).toHaveLength(0);
    });

    pageTest('should not have memory leaks in resource loading', async ({ page, homepagePage }) => {
        // Navigate and reload to check for resource cleanup
        await homepagePage.navigate();
        await page.waitForLoadState('networkidle');
        
        const initialResourceCount = await page.evaluate(() => {
            return performance.getEntriesByType('resource').length;
        });

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const reloadResourceCount = await page.evaluate(() => {
            return performance.getEntriesByType('resource').length;
        });

        // Resource count should be similar (within reasonable bounds)
        expect(Math.abs(reloadResourceCount - initialResourceCount)).toBeLessThan(10);
    });
});

function getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'css';
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return 'image';
    if (url.includes('.woff') || url.includes('.ttf')) return 'font';
    if (url.includes('api/') || url.includes('.json')) return 'api';
    return 'html';
}
