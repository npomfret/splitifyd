import {expect, multiUserTest as test} from '../../fixtures/multi-user-test';
import {setupMCPDebugOnFailure} from '../../helpers';
import {GroupWorkflow} from '../../workflows';
import {generateTestGroupName} from '../../utils/test-helpers';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Security Authorization Tests', () => {
  test.describe('Cross-Tenant Data Access Prevention', () => {
    test('prevents unauthorized access to private groups', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // User 1 creates a private group
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('Private');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Private group - no unauthorized access');
      
      const groupUrl = page1.url();
      const groupId = groupUrl.split('/groups/')[1];
      
      // User 2 attempts direct access to User 1's private group
      await page2.goto(groupUrl);
      await page2.waitForLoadState('domcontentloaded');
      
      // Should redirect to 404 (security by obscurity - don't reveal group exists)
      await page2.waitForURL('**/404', { timeout: 5000 });
      expect(page2.url()).toContain('/404');
      
      // Verify 404 page content
      const heading = await page2.locator('h1').textContent();
      expect(heading).toBe('404');
      
      // Group name should NOT be visible to unauthorized users
      await expect(page2.locator(`text=${groupName}`)).not.toBeVisible();
      
      // Try direct API-like navigation patterns
      const directUrls = [
        `/groups/${groupId}/expenses`,
        `/groups/${groupId}/add-expense`,
        `/groups/${groupId}/members`,
        `/groups/${groupId}/settings`
      ];
      
      for (const url of directUrls) {
        await page2.goto(`${page2.context().browser()?.contexts()[0]?.pages()[0]?.url().split('/')[0]}://${page2.url().split('://')[1].split('/')[0]}${url}`);
        await page2.waitForLoadState('domcontentloaded');
        // Should redirect to 404 for all unauthorized group URLs
        await expect(page2.locator('h1')).toHaveText('404');
      }
    });

    test('prevents access to expenses from non-member users', async ({ authenticatedPage, secondUser }) => {
      const { page: page1, dashboardPage: dashboard1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // User 1 creates a group and expense
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('ExpenseAccess');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing expense access control');
      
      // Add an expense
      await page1.click('[data-testid="add-expense-button"]');
      await page1.fill('[data-testid="expense-description"]', 'Private expense');
      await page1.fill('[data-testid="expense-amount"]', '50.00');
      await page1.click('[data-testid="save-expense-button"]');
      await page1.waitForSelector('[data-testid="expense-item"]');
      
      // Get the expense URL
      await page1.click('[data-testid="expense-item"]');
      const expenseUrl = page1.url();
      
      // User 2 attempts to access the expense directly
      await page2.goto(expenseUrl);
      await page2.waitForLoadState('domcontentloaded');
      
      // Should be redirected to 404 or access denied
      await page2.waitForURL('**/404', { timeout: 5000 });
      expect(page2.url()).toContain('/404');
      
      // Expense details should not be visible
      await expect(page2.locator('text=Private expense')).not.toBeVisible();
      await expect(page2.locator('text=$50.00')).not.toBeVisible();
    });
  });

  test.describe('Permission Escalation Prevention', () => {
    test('prevents non-admin users from accessing admin functions', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // User 1 creates a group (becomes admin)
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('AdminTest');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing admin privileges');
      
      // Get share link for User 2 to join
      await page1.click('[data-testid="share-group-button"]');
      const shareLink = await page1.locator('[data-testid="share-link"]').textContent();
      await page1.click('[data-testid="close-share-modal"]');
      
      // User 2 joins the group as a regular member
      await page2.goto(shareLink!);
      await page2.waitForSelector('[data-testid="join-group-button"]');
      await page2.click('[data-testid="join-group-button"]');
      await page2.waitForSelector('[data-testid="group-header"]');
      
      // User 2 should NOT see admin-only controls
      await expect(page2.locator('[data-testid="edit-group-button"]')).not.toBeVisible();
      await expect(page2.locator('[data-testid="delete-group-button"]')).not.toBeVisible();
      await expect(page2.locator('[data-testid="group-settings-button"]')).not.toBeVisible();
      
      // User 2 should NOT be able to remove other members
      const memberItems = page2.locator('[data-testid="member-item"]');
      const memberCount = await memberItems.count();
      
      for (let i = 0; i < memberCount; i++) {
        const memberItem = memberItems.nth(i);
        await expect(memberItem.locator('[data-testid="remove-member-button"]')).not.toBeVisible();
      }
      
      // Try direct navigation to admin functions (should be blocked)
      const groupId = page2.url().split('/groups/')[1];
      const adminUrls = [
        `/groups/${groupId}/settings`,
        `/groups/${groupId}/admin`,
        `/groups/${groupId}/manage-members`
      ];
      
      for (const url of adminUrls) {
        await page2.goto(`${page2.url().split('/groups')[0]}${url}`);
        await page2.waitForLoadState('domcontentloaded');
        // Should redirect away from admin pages
        expect(page2.url()).not.toContain('/settings');
        expect(page2.url()).not.toContain('/admin');
        expect(page2.url()).not.toContain('/manage-members');
      }
    });

    test('prevents users from editing expenses they did not create', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // Create shared group
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('ExpenseEdit');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing expense edit permissions');
      
      // Get share link for User 2
      await page1.click('[data-testid="share-group-button"]');
      const shareLink = await page1.locator('[data-testid="share-link"]').textContent();
      await page1.click('[data-testid="close-share-modal"]');
      
      // User 2 joins
      await page2.goto(shareLink!);
      await page2.click('[data-testid="join-group-button"]');
      await page2.waitForSelector('[data-testid="group-header"]');
      
      // User 1 creates an expense
      await page1.click('[data-testid="add-expense-button"]');
      await page1.fill('[data-testid="expense-description"]', 'User 1 expense');
      await page1.fill('[data-testid="expense-amount"]', '30.00');
      await page1.click('[data-testid="save-expense-button"]');
      await page1.waitForSelector('[data-testid="expense-item"]');
      
      // User 2 tries to edit User 1's expense
      await page2.click('[data-testid="expense-item"]');
      await page2.waitForSelector('[data-testid="expense-detail"]');
      
      // Edit button should NOT be visible to User 2
      await expect(page2.locator('[data-testid="edit-expense-button"]')).not.toBeVisible();
      await expect(page2.locator('[data-testid="delete-expense-button"]')).not.toBeVisible();
      
      // Try direct navigation to edit URL (should be blocked)
      const expenseId = page2.url().split('/expenses/')[1];
      const groupId = page2.url().split('/groups/')[1].split('/')[0];
      const editUrl = `/groups/${groupId}/add-expense?id=${expenseId}&edit=true`;
      
      await page2.goto(`${page2.url().split('/groups')[0]}${editUrl}`);
      await page2.waitForLoadState('domcontentloaded');
      
      // Should be redirected away from edit page or show error
      if (page2.url().includes('add-expense')) {
        // If on edit page, it should show access denied or readonly
        await expect(page2.locator('text=Access denied')).toBeVisible();
      } else {
        // Should be redirected away from edit functionality
        expect(page2.url()).not.toContain('edit=true');
      }
    });
  });

  test.describe('Token and Session Security', () => {
    test('handles expired or invalid sessions gracefully', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Navigate to a protected page first
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="dashboard"]');
      
      // Simulate token expiration by clearing storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        // Clear cookies
        document.cookie.split(";").forEach((c) => {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substr(0, eqPos) : c;
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        });
      });
      
      // Try to access protected content
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      
      // Should be redirected to login page
      await page.waitForURL('**/login', { timeout: 5000 });
      expect(page.url()).toContain('/login');
      
      // Should show appropriate message
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('prevents cross-tab session sharing vulnerabilities', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // User 1 logged in, User 2 logged in with different account
      await page1.goto('/dashboard');
      await page1.waitForSelector('[data-testid="dashboard"]');
      
      await page2.goto('/dashboard');
      await page2.waitForSelector('[data-testid="dashboard"]');
      
      // Users should see their own data, not each other's
      const user1Groups = await page1.locator('[data-testid="group-card"]').count();
      const user2Groups = await page2.locator('[data-testid="group-card"]').count();
      
      // Create a group with User 1
      const groupWorkflow = new GroupWorkflow(page1);
      await groupWorkflow.createGroupAndNavigate(generateTestGroupName('SessionTest'), 'Session isolation test');
      
      // User 1 should see the new group
      await page1.goto('/dashboard');
      await page1.waitForSelector('[data-testid="group-card"]');
      const user1NewGroupCount = await page1.locator('[data-testid="group-card"]').count();
      expect(user1NewGroupCount).toBe(user1Groups + 1);
      
      // User 2 should NOT see User 1's new group
      await page2.goto('/dashboard');
      await page2.waitForLoadState('domcontentloaded');
      const user2AfterGroupCount = await page2.locator('[data-testid="group-card"]').count();
      expect(user2AfterGroupCount).toBe(user2Groups);
    });
  });

  test.describe('Input Validation and Injection Prevention', () => {
    test('prevents XSS injection in expense descriptions', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create a group first
      const groupWorkflow = new GroupWorkflow(page);
      const groupName = generateTestGroupName('XSSTest');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing XSS prevention');
      
      // Attempt XSS injection in expense description
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
        '<svg onload="alert(1)">',
        '"><script>alert(1)</script>',
        '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e'
      ];
      
      for (const payload of xssPayloads) {
        await page.click('[data-testid="add-expense-button"]');
        await page.fill('[data-testid="expense-description"]', payload);
        await page.fill('[data-testid="expense-amount"]', '25.00');
        
        // Try to save the expense
        await page.click('[data-testid="save-expense-button"]');
        
        // Should either reject the input or sanitize it
        await page.waitForLoadState('domcontentloaded');
        
        if (page.url().includes('/add-expense')) {
          // If still on add expense page, should show validation error
          await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
          await page.click('[data-testid="cancel-button"]');
        } else {
          // If expense was created, description should be sanitized
          await page.click('[data-testid="expense-item"]');
          const description = await page.locator('[data-testid="expense-description"]').textContent();
          
          expect(description).not.toContain('<script>');
          expect(description).not.toContain('javascript:');
          expect(description).not.toContain('onerror=');
          expect(description).not.toContain('onload=');
          
          await page.goBack();
        }
      }
    });

    test('prevents XSS injection in group names', async ({ authenticatedPage }) => {
      const { page, dashboardPage } = authenticatedPage;
      
      await dashboardPage.navigate();
      
      const xssPayload = '<script>alert("group-xss")</script>';
      
      // Try to create group with XSS payload
      await page.click('[data-testid="create-group-button"]');
      await page.fill('[data-testid="group-name-input"]', xssPayload);
      await page.fill('[data-testid="group-description-input"]', 'Test description');
      await page.click('[data-testid="create-group-submit"]');
      
      // Should either reject the input or sanitize it
      await page.waitForLoadState('domcontentloaded');
      
      if (page.url().includes('/dashboard')) {
        // If still on dashboard, group creation might have failed
        const errorMessage = page.locator('[data-testid="error-message"]');
        if (await errorMessage.isVisible()) {
          // Good - dangerous content was rejected
          expect(await errorMessage.textContent()).toMatch(/invalid|dangerous|not allowed/i);
        } else {
          // If group was created, name should be sanitized
          const groupCards = page.locator('[data-testid="group-card"]');
          const lastGroup = groupCards.last();
          const groupName = await lastGroup.locator('[data-testid="group-name"]').textContent();
          
          expect(groupName).not.toContain('<script>');
          expect(groupName).not.toContain('javascript:');
        }
      }
    });

    test('validates expense amount inputs properly', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create a group first
      const groupWorkflow = new GroupWorkflow(page);
      await groupWorkflow.createGroupAndNavigate(generateTestGroupName('AmountTest'), 'Testing amount validation');
      
      const invalidAmounts = [
        '-100',        // Negative
        '0',           // Zero
        'abc',         // Non-numeric
        '999999999',   // Too large
        '1.234',       // Too many decimals
        '',            // Empty
        '  ',          // Whitespace only
      ];
      
      for (const amount of invalidAmounts) {
        await page.click('[data-testid="add-expense-button"]');
        await page.fill('[data-testid="expense-description"]', 'Test expense');
        await page.fill('[data-testid="expense-amount"]', amount);
        await page.click('[data-testid="save-expense-button"]');
        
        // Should show validation error for invalid amounts
        await expect(page.locator('[data-testid="amount-error"]')).toBeVisible();
        
        await page.click('[data-testid="cancel-button"]');
        await page.waitForSelector('[data-testid="group-header"]');
      }
    });
  });

  test.describe('Rate Limiting and Abuse Prevention', () => {
    test('handles rapid successive operations gracefully', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create a group
      const groupWorkflow = new GroupWorkflow(page);
      await groupWorkflow.createGroupAndNavigate(generateTestGroupName('RateTest'), 'Testing rate limiting');
      
      // Rapidly create multiple expenses
      const promises: Promise<void>[] = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push((async () => {
          await page.click('[data-testid="add-expense-button"]');
          await page.fill('[data-testid="expense-description"]', `Rapid expense ${i}`);
          await page.fill('[data-testid="expense-amount"]', '10.00');
          await page.click('[data-testid="save-expense-button"]');
          await page.waitForLoadState('domcontentloaded');
        })());
      }
      
      // All operations should either succeed or fail gracefully
      const results = await Promise.allSettled(promises);
      
      // No unhandled errors should occur
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.log(`Expense ${index} failed:`, result.reason);
          // Should be a proper error, not a crash
          expect(result.reason).toBeDefined();
        }
      });
    });

    test('prevents excessive data creation', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create a group
      const groupWorkflow = new GroupWorkflow(page);
      await groupWorkflow.createGroupAndNavigate(generateTestGroupName('ExcessTest'), 'Testing excessive data prevention');
      
      // Try to create an expense with extremely long description
      const veryLongDescription = 'A'.repeat(10000); // 10KB description
      
      await page.click('[data-testid="add-expense-button"]');
      await page.fill('[data-testid="expense-description"]', veryLongDescription);
      await page.fill('[data-testid="expense-amount"]', '50.00');
      await page.click('[data-testid="save-expense-button"]');
      
      // Should either reject or truncate the excessive data
      await page.waitForLoadState('domcontentloaded');
      
      if (page.url().includes('/add-expense')) {
        // If still on add page, should show validation error
        await expect(page.locator('[data-testid="description-error"]')).toBeVisible();
      } else {
        // If expense was created, description should be truncated
        await page.click('[data-testid="expense-item"]');
        const description = await page.locator('[data-testid="expense-description"]').textContent();
        expect(description!.length).toBeLessThan(1000); // Should be truncated
      }
    });
  });
});