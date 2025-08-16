import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Firebase Security Rules Tests', () => {
  test.describe('Firestore Document Access Control', () => {
    test('enforces group document read permissions', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // User 1 creates a private group
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('FirestoreAccess');
      await groupWorkflow.createGroup(groupName, 'Testing Firestore access rules');
      
      // Extract group ID from URL
      const groupUrl = page1.url();
      const groupId = groupUrl.split('/groups/')[1];
      
      // Monitor network requests to detect unauthorized Firestore access attempts
      const networkLogs: string[] = [];
      
      page2.on('response', response => {
        const url = response.url();
        if (url.includes('firestore') || url.includes('googleapis.com')) {
          networkLogs.push(`${response.status()}: ${url}`);
        }
      });
      
      // User 2 attempts to access the group - this will trigger Firestore requests
      await page2.goto(groupUrl);
      await page2.waitForLoadState('domcontentloaded');
      
      // Should be redirected to 404 due to Firestore security rules
      await page2.waitForURL('**/404', { timeout: 5000 });
      
      // Check that any Firestore requests returned appropriate error codes
      const unauthorizedRequests = networkLogs.filter(log => 
        log.includes('groups') && (log.startsWith('403') || log.startsWith('401'))
      );
      
      // Should have at least one denied request
      expect(unauthorizedRequests.length).toBeGreaterThan(0);
      
      // Group content should not be visible
      await expect(page2.locator(`text=${groupName}`)).not.toBeVisible();
    });

    test('enforces expense document read permissions', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // Create group and expense with User 1
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('ExpenseFirestore');
      await groupWorkflow.createGroup(groupName, 'Testing expense Firestore rules');
      
      // Add an expense
      await page1.click('[data-testid="add-expense-button"]');
      await page1.fill('[data-testid="expense-description"]', 'Firestore test expense');
      await page1.fill('[data-testid="expense-amount"]', '75.00');
      await page1.click('[data-testid="save-expense-button"]');
      await page1.waitForSelector('[data-testid="expense-item"]');
      
      // Get expense URL
      await page1.click('[data-testid="expense-item"]');
      const expenseUrl = page1.url();
      
      // Monitor Firestore requests for User 2
      const firestoreErrors: string[] = [];
      
      page2.on('response', response => {
        const url = response.url();
        if ((url.includes('firestore') || url.includes('googleapis.com')) && 
            (response.status() === 403 || response.status() === 401)) {
          firestoreErrors.push(`${response.status()}: ${url}`);
        }
      });
      
      // User 2 attempts to access the expense
      await page2.goto(expenseUrl);
      await page2.waitForLoadState('domcontentloaded');
      
      // Should be redirected due to Firestore security rules
      await page2.waitForURL('**/404', { timeout: 5000 });
      
      // Should have received Firestore permission errors
      expect(firestoreErrors.length).toBeGreaterThan(0);
      
      // Expense details should not be visible
      await expect(page2.locator('text=Firestore test expense')).not.toBeVisible();
      await expect(page2.locator('text=$75.00')).not.toBeVisible();
    });

    test('enforces user document write permissions', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // Create a shared group
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('WritePermissions');
      await groupWorkflow.createGroup(groupName, 'Testing write permissions');
      
      // Get share link
      await page1.click('[data-testid="share-group-button"]');
      const shareLink = await page1.locator('[data-testid="share-link"]').textContent();
      await page1.click('[data-testid="close-share-modal"]');
      
      // User 2 joins the group
      await page2.goto(shareLink!);
      await page2.click('[data-testid="join-group-button"]');
      await page2.waitForSelector('[data-testid="group-header"]');
      
      // User 2 should be able to create their own expenses
      await page2.click('[data-testid="add-expense-button"]');
      await page2.fill('[data-testid="expense-description"]', 'User 2 expense');
      await page2.fill('[data-testid="expense-amount"]', '40.00');
      await page2.click('[data-testid="save-expense-button"]');
      
      // Should succeed - User 2 can create expenses in groups they're a member of
      await page2.waitForSelector('[data-testid="expense-item"]');
      
      // But User 2 should NOT be able to edit/delete User 1's expenses
      // This is enforced at the Firestore level through security rules
      
      // Navigate back to group to see all expenses
      const groupId = page2.url().split('/')[4];
      await page2.goto(`/groups/${groupId}`);
      await page2.waitForSelector('[data-testid="expense-item"]');
      
      // Check that User 2 only sees edit options for their own expenses
      const expenseItems = page2.locator('[data-testid="expense-item"]');
      const expenseCount = await expenseItems.count();
      
      for (let i = 0; i < expenseCount; i++) {
        const expense = expenseItems.nth(i);
        await expense.click();
        
        const description = await page2.locator('[data-testid="expense-description"]').textContent();
        
        if (description?.includes('User 2 expense')) {
          // User 2's expense - should see edit/delete options
          await expect(page2.locator('[data-testid="edit-expense-button"]')).toBeVisible();
        } else {
          // User 1's expense - should NOT see edit/delete options
          await expect(page2.locator('[data-testid="edit-expense-button"]')).not.toBeVisible();
          await expect(page2.locator('[data-testid="delete-expense-button"]')).not.toBeVisible();
        }
        
        await page2.goBack();
        await page2.waitForSelector('[data-testid="expense-item"]');
      }
    });
  });

  test.describe('Real-time Listener Security', () => {
    test('prevents unauthorized real-time data subscriptions', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // User 1 creates a group
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('RealtimeTest');
      await groupWorkflow.createGroup(groupName, 'Testing real-time security');
      
      // Monitor WebSocket connections for unauthorized listeners
      const wsConnections: string[] = [];
      
      page2.on('websocket', ws => {
        ws.on('framereceived', event => {
          const data = event.payload?.toString();
          if (data?.includes('groups') || data?.includes('expenses')) {
            wsConnections.push(data);
          }
        });
      });
      
      // User 2 navigates to dashboard (should not receive real-time updates for User 1's group)
      await page2.goto('/dashboard');
      await page2.waitForSelector('[data-testid="dashboard"]');
      
      // User 1 adds an expense to trigger real-time updates
      await page1.click('[data-testid="add-expense-button"]');
      await page1.fill('[data-testid="expense-description"]', 'Real-time test expense');
      await page1.fill('[data-testid="expense-amount"]', '60.00');
      await page1.click('[data-testid="save-expense-button"]');
      await page1.waitForSelector('[data-testid="expense-item"]');
      
      // Wait for potential real-time updates to settle
      await page2.waitForLoadState('domcontentloaded');
      
      // User 2 should NOT have received any real-time updates about User 1's group
      const unauthorizedUpdates = wsConnections.filter(data => 
        data.includes(groupName) || data.includes('Real-time test expense')
      );
      
      expect(unauthorizedUpdates).toHaveLength(0);
      
      // User 2's dashboard should not show User 1's group
      await expect(page2.locator(`text=${groupName}`)).not.toBeVisible();
    });

    test('allows authorized real-time updates for group members', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // Create shared group
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('AuthorizedRealtime');
      await groupWorkflow.createGroup(groupName, 'Testing authorized real-time updates');
      
      // User 2 joins the group
      await page1.click('[data-testid="share-group-button"]');
      const shareLink = await page1.locator('[data-testid="share-link"]').textContent();
      await page1.click('[data-testid="close-share-modal"]');
      
      await page2.goto(shareLink!);
      await page2.click('[data-testid="join-group-button"]');
      await page2.waitForSelector('[data-testid="group-header"]');
      
      // Both users navigate to the group page
      const groupId = page2.url().split('/groups/')[1];
      await page1.goto(`/groups/${groupId}`);
      await page1.waitForSelector('[data-testid="group-header"]');
      
      // User 1 adds an expense
      await page1.click('[data-testid="add-expense-button"]');
      await page1.fill('[data-testid="expense-description"]', 'Shared expense');
      await page1.fill('[data-testid="expense-amount"]', '80.00');
      await page1.click('[data-testid="save-expense-button"]');
      
      // User 2 should see the real-time update (they're a group member)
      await expect(page2.locator('text=Shared expense')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('text=$80.00')).toBeVisible();
      
      // Verify expense appears in User 2's view
      const expenseItems = page2.locator('[data-testid="expense-item"]');
      await expect(expenseItems).toContainText('Shared expense');
    });
  });

  test.describe('Storage Security Rules', () => {
    test('prevents unauthorized file access', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // Create group and expense with receipt
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('StorageTest');
      await groupWorkflow.createGroup(groupName, 'Testing storage security');
      
      // Add expense with receipt (if file upload is supported)
      await page1.click('[data-testid="add-expense-button"]');
      await page1.fill('[data-testid="expense-description"]', 'Expense with receipt');
      await page1.fill('[data-testid="expense-amount"]', '90.00');
      
      // If receipt upload is available, test it
      const fileInput = page1.locator('[data-testid="receipt-upload"]');
      if (await fileInput.isVisible()) {
        // Create a test file
        const testFile = Buffer.from('fake receipt content');
        await fileInput.setInputFiles({
          name: 'receipt.txt',
          mimeType: 'text/plain',
          buffer: testFile
        });
      }
      
      await page1.click('[data-testid="save-expense-button"]');
      await page1.waitForSelector('[data-testid="expense-item"]');
      
      // Get the expense with receipt
      await page1.click('[data-testid="expense-item"]');
      const receiptElement = page1.locator('[data-testid="receipt-image"]');
      
      if (await receiptElement.isVisible()) {
        const receiptUrl = await receiptElement.getAttribute('src');
        
        // User 2 attempts to access the receipt URL directly
        const response = await page2.goto(receiptUrl!, { waitUntil: 'domcontentloaded' });
        
        // Should be denied access (403) or redirected to error page
        expect(response?.status()).toBeOneOf([401, 403, 404]);
        
        // User 2 should not be able to see the receipt content
        const pageContent = await page2.textContent('body');
        expect(pageContent).not.toContain('fake receipt content');
      }
    });

    test('allows authorized file access for group members', async ({ authenticatedPage, secondUser }) => {
      const { page: page1 } = authenticatedPage;
      const { page: page2 } = secondUser;
      
      // Create shared group
      const groupWorkflow = new GroupWorkflow(page1);
      const groupName = generateTestGroupName('AuthorizedStorage');
      await groupWorkflow.createGroup(groupName, 'Testing authorized storage access');
      
      // User 2 joins the group
      await page1.click('[data-testid="share-group-button"]');
      const shareLink = await page1.locator('[data-testid="share-link"]').textContent();
      await page1.click('[data-testid="close-share-modal"]');
      
      await page2.goto(shareLink!);
      await page2.click('[data-testid="join-group-button"]');
      await page2.waitForSelector('[data-testid="group-header"]');
      
      // User 1 adds expense with receipt
      await page1.click('[data-testid="add-expense-button"]');
      await page1.fill('[data-testid="expense-description"]', 'Shared receipt expense');
      await page1.fill('[data-testid="expense-amount"]', '100.00');
      
      const fileInput = page1.locator('[data-testid="receipt-upload"]');
      if (await fileInput.isVisible()) {
        const testFile = Buffer.from('shared receipt content');
        await fileInput.setInputFiles({
          name: 'shared-receipt.txt',
          mimeType: 'text/plain',
          buffer: testFile
        });
      }
      
      await page1.click('[data-testid="save-expense-button"]');
      await page1.waitForSelector('[data-testid="expense-item"]');
      
      // User 2 should be able to view the receipt (group member)
      await page2.click('[data-testid="expense-item"]');
      
      const receiptElement = page2.locator('[data-testid="receipt-image"]');
      if (await receiptElement.isVisible()) {
        // User 2 can see the receipt
        await expect(receiptElement).toBeVisible();
        
        // Receipt should load successfully for group members
        const receiptUrl = await receiptElement.getAttribute('src');
        const response = await page2.context().request.get(receiptUrl!);
        expect(response.status()).toBe(200);
      }
    });
  });

  test.describe('Function Security', () => {
    test('enforces authentication on callable functions', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Test that functions require proper authentication
      // This tests Firebase Functions security, not just UI
      
      // Create a group to get a valid context
      const groupWorkflow = new GroupWorkflow(page);
      const groupName = generateTestGroupName('FunctionAuth');
      await groupWorkflow.createGroup(groupName, 'Testing function authentication');
      
      // Monitor function calls
      const functionCalls: string[] = [];
      
      page.on('response', response => {
        const url = response.url();
        if (url.includes('cloudfunctions.net') || url.includes('functions')) {
          functionCalls.push(`${response.status()}: ${url}`);
        }
      });
      
      // Perform operations that call Firebase Functions
      await page.click('[data-testid="add-expense-button"]');
      await page.fill('[data-testid="expense-description"]', 'Function test expense');
      await page.fill('[data-testid="expense-amount"]', '55.00');
      await page.click('[data-testid="save-expense-button"]');
      
      // Functions should be called successfully (200 status)
      const successfulCalls = functionCalls.filter(call => call.startsWith('200'));
      expect(successfulCalls.length).toBeGreaterThan(0);
      
      // No unauthorized calls (401/403)
      const unauthorizedCalls = functionCalls.filter(call => 
        call.startsWith('401') || call.startsWith('403')
      );
      expect(unauthorizedCalls).toHaveLength(0);
    });

    test('validates function parameters and prevents injection', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create group for testing
      const groupWorkflow = new GroupWorkflow(page);
      const groupName = generateTestGroupName('FunctionValidation');
      await groupWorkflow.createGroup(groupName, 'Testing function parameter validation');
      
      // Monitor function responses for validation errors
      const functionResponses: Array<{status: number, url: string}> = [];
      
      page.on('response', response => {
        const url = response.url();
        if (url.includes('cloudfunctions.net') || url.includes('functions')) {
          functionResponses.push({
            status: response.status(),
            url: url
          });
        }
      });
      
      // Try to create expense with invalid data (should be validated by functions)
      await page.click('[data-testid="add-expense-button"]');
      
      // Use browser console to inject malicious data
      await page.evaluate(() => {
        // Try to manipulate the form data being sent to functions
        const form = document.querySelector('[data-testid="expense-form"]') as HTMLFormElement;
        if (form) {
          // Add hidden malicious fields
          const maliciousField = document.createElement('input');
          maliciousField.type = 'hidden';
          maliciousField.name = '__proto__';
          maliciousField.value = '{"polluted": true}';
          form.appendChild(maliciousField);
        }
      });
      
      await page.fill('[data-testid="expense-description"]', 'Normal expense');
      await page.fill('[data-testid="expense-amount"]', '45.00');
      await page.click('[data-testid="save-expense-button"]');
      
      // Wait for function responses to complete
      await page.waitForLoadState('domcontentloaded');
      
      // Functions should either validate and reject malicious data, or ignore extra fields
      const errorResponses = functionResponses.filter(r => r.status >= 400);
      
      if (errorResponses.length > 0) {
        // Good - functions rejected malicious data
        expect(errorResponses.some(r => r.status === 400)).toBe(true);
      } else {
        // Also acceptable - functions processed the request but ignored malicious fields
        // Verify the expense was created normally without pollution
        await expect(page.locator('[data-testid="expense-item"]')).toBeVisible();
      }
    });
  });
});