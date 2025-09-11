import { simpleTest as test, expect } from '../../../fixtures/simple-test.fixture';
import { HomepagePage } from '../../../pages';
import { waitForApp } from '../../../helpers';

test.describe('Performance Benchmarks', () => {
    test('should meet Web Core Vitals metrics', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigate();
        await waitForApp(page);

        // Measure performance metrics using Navigation Timing API
        const performanceMetrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType('paint');
            
            return {
                // Time to First Byte
                ttfb: navigation.responseStart - navigation.fetchStart,
                // DOM Content Loaded
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
                // First Contentful Paint
                fcp: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
                // Load Complete
                loadComplete: navigation.loadEventEnd - navigation.fetchStart,
                // DNS Lookup Time
                dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
                // Connection Time
                connectionTime: navigation.connectEnd - navigation.connectStart
            };
        });

        // Web Core Vitals thresholds
        expect(performanceMetrics.ttfb).toBeLessThan(600); // TTFB under 600ms is good
        expect(performanceMetrics.fcp).toBeLessThan(1800); // FCP under 1.8s is good
        expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // DOM ready under 2s
        expect(performanceMetrics.loadComplete).toBeLessThan(3000); // Full load under 3s

        // Network performance
        expect(performanceMetrics.dnsTime).toBeLessThan(100); // DNS should be fast locally
        expect(performanceMetrics.connectionTime).toBeLessThan(100); // Connection fast locally
    });

    test('should have acceptable bundle size impact', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigate();
        await waitForApp(page);

        // Count resource requests and measure transfer sizes
        const resourceMetrics = await page.evaluate(() => {
            const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
            
            const scripts = resources.filter(r => r.name.includes('.js'));
            const styles = resources.filter(r => r.name.includes('.css'));
            
            return {
                totalRequests: resources.length,
                scriptCount: scripts.length,
                styleCount: styles.length,
                totalTransferSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
                scriptSize: scripts.reduce((sum, r) => sum + (r.transferSize || 0), 0),
                styleSize: styles.reduce((sum, r) => sum + (r.transferSize || 0), 0)
            };
        });

        // Performance budgets
        expect(resourceMetrics.totalRequests).toBeLessThan(50); // Reasonable request count
        expect(resourceMetrics.scriptCount).toBeLessThan(10); // Not too many script files
        expect(resourceMetrics.totalTransferSize).toBeLessThan(1024 * 1024); // Under 1MB total
        expect(resourceMetrics.scriptSize).toBeLessThan(512 * 1024); // JS under 512KB
    });

    test('should render without layout shifts', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const homepagePage = new HomepagePage(page);
        await homepagePage.navigate();
        
        // Monitor for layout shifts during initial load
        const layoutShifts = await page.evaluate(() => {
            return new Promise((resolve) => {
                let shifts: any[] = [];
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'layout-shift') {
                            shifts.push(entry);
                        }
                    }
                });
                
                observer.observe({ entryTypes: ['layout-shift'] });
                
                // Wait for initial render to complete
                setTimeout(() => {
                    observer.disconnect();
                    resolve(shifts);
                }, 2000);
            });
        });

        // Cumulative Layout Shift should be minimal (< 0.1 is good)
        const totalShift = (layoutShifts as any[]).reduce((sum, shift) => sum + shift.value, 0);
        expect(totalShift).toBeLessThan(0.1);
    });
});
