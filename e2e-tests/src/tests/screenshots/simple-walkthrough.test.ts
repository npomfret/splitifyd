import { pageTest as test, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting } from '../../helpers';
import path from 'path';

setupConsoleErrorReporting();

test.describe('App Walkthrough Screenshots', () => {
  test('should capture screenshots of main app flow', async ({ 
    page, 
    homepagePage, 
    registerPage,
    loginPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const screenshotsDir = path.join(process.cwd(), '..', 'screenshots', 'walkthrough');
    
    // 1. Homepage
    await homepagePage.navigate();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-homepage.png'),
      fullPage: true 
    });
    
    // 2. Register page with filled form
    await registerPage.navigate();
    await page.waitForLoadState('networkidle');
    // Form should be pre-filled with test data according to CLAUDE.md
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-register-filled.png'),
      fullPage: true 
    });
    
    // 3. Login page with filled form
    await loginPage.navigate();
    await page.waitForLoadState('networkidle');
    // Form should be pre-filled with test data according to CLAUDE.md
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-login-filled.png'),
      fullPage: true 
    });
    
    // 4. Dashboard with content
    // Actually login first
    await loginPage.login('test1@test.com', 'rrRR44$$');
    await expect(page).toHaveURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-dashboard-with-content.png'),
      fullPage: true 
    });
    
    // 5. Group detail page
    // Click on first group if available
    const groupCard = page.locator('[data-testid="group-card"]').first();
    const hasGroups = await groupCard.count() > 0;
    
    if (hasGroups) {
      await groupCard.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ 
        path: path.join(screenshotsDir, '05-group-detail.png'),
        fullPage: true 
      });
      
      // 6. Expense detail (if there are expenses)
      const expenseRow = page.locator('[data-testid="expense-row"], .expense-item').first();
      const hasExpenses = await expenseRow.count() > 0;
      
      if (hasExpenses) {
        await expenseRow.click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ 
          path: path.join(screenshotsDir, '06-expense-detail.png'),
          fullPage: true 
        });
      }
    }
  });
});