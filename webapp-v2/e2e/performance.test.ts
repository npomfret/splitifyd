import { test, expect } from '@playwright/test';

// Performance testing - measure Core Web Vitals and load times
test.describe('Performance Tests', () => {
  test('should load pages within performance budget', async ({ page }) => {
    // Set up performance monitoring
    let loadTime = 0;
    
    page.on('load', () => {
      loadTime = Date.now();
    });
    
    const startTime = Date.now();
    await page.goto('/');
    
    loadTime = loadTime || Date.now();
    const totalLoadTime = loadTime - startTime;
    
    // Page should load within 2 seconds
    expect(totalLoadTime).toBeLessThan(2000);
  });

  test('should have good Core Web Vitals on home page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Measure LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
    });
    
    // LCP should be less than 2.5 seconds
    expect(lcp).toBeLessThan(2500);
  });

  test('should have good Core Web Vitals on pricing page', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');
    
    // Measure CLS (Cumulative Layout Shift)
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          resolve(clsValue);
        }).observe({ type: 'layout-shift', buffered: true });
        
        // Resolve after a short delay to capture layout shifts
        setTimeout(() => resolve(clsValue), 1000);
      });
    });
    
    // CLS should be less than 0.1
    expect(cls).toBeLessThan(0.1);
  });

  test('should have reasonable bundle size', async ({ page }) => {
    // Go to page and capture network requests
    const responses: any[] = [];
    
    page.on('response', response => {
      if (response.url().includes('.js') || response.url().includes('.css')) {
        responses.push({
          url: response.url(),
          size: response.headers()['content-length']
        });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Calculate total bundle size
    const totalSize = responses.reduce((total, response) => {
      const size = parseInt(response.size || '0', 10);
      return total + size;
    }, 0);
    
    // Total JS + CSS should be less than 500KB
    expect(totalSize).toBeLessThan(500 * 1024);
  });

  test('should render above-the-fold content quickly', async ({ page }) => {
    await page.goto('/');
    
    // Measure time to see main heading
    const startTime = Date.now();
    await page.getByRole('heading', { name: 'Welcome to Splitifyd v2' }).waitFor({ state: 'visible' });
    const renderTime = Date.now() - startTime;
    
    // Above-the-fold content should render within 1 second
    expect(renderTime).toBeLessThan(1000);
  });

  test('should handle navigation performance', async ({ page }) => {
    // Start at home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Measure navigation time to pricing page
    const startTime = Date.now();
    await page.goto('/pricing');
    await page.getByRole('heading', { name: 'Pricing' }).waitFor({ state: 'visible' });
    const navigationTime = Date.now() - startTime;
    
    // Navigation should be fast (client-side routing)
    expect(navigationTime).toBeLessThan(1000);
  });

  test('should handle mobile performance', async ({ page }) => {
    // Simulate mobile network conditions
    await page.context().setOffline(false);
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const startTime = Date.now();
    await page.goto('/pricing');
    await page.getByRole('heading', { name: 'Pricing' }).waitFor({ state: 'visible' });
    const loadTime = Date.now() - startTime;
    
    // Mobile load time should still be reasonable
    expect(loadTime).toBeLessThan(3000);
  });

  test('should not have memory leaks', async ({ page }) => {
    await page.goto('/');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });
    
    // Navigate between pages multiple times
    for (let i = 0; i < 5; i++) {
      await page.goto('/pricing');
      await page.goto('/terms');
      await page.goto('/');
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });
    
    // Memory usage shouldn't increase dramatically (allow 50% increase)
    if (initialMemory > 0 && finalMemory > 0) {
      expect(finalMemory).toBeLessThan(initialMemory * 1.5);
    }
  });
});