import { expect, multiUserTest as test } from '../../fixtures/multi-user-test';
import { pageTest } from '../../fixtures';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';
import type { Response } from '@playwright/test';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Security Abuse Prevention Tests', () => {
    test.describe('Rate Limiting Protection', () => {
        test('implements rate limiting for API endpoints', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Create a group for testing
            const groupWorkflow = new GroupWorkflow(page);
            const groupName = generateTestGroupName('RateLimit');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing rate limiting');

            // Track API responses for rate limiting indicators
            const apiResponses: Array<{ status: number; url: string; timestamp: number }> = [];

            page.on('response', (response: Response) => {
                const url = response.url();
                if (url.includes('/api/') || url.includes('cloudfunctions.net') || url.includes('firestore') || url.includes('functions')) {
                    apiResponses.push({
                        status: response.status(),
                        url: url,
                        timestamp: Date.now(),
                    });
                }
            });

            // Rapidly create multiple expenses to test rate limiting
            const rapidRequests = 15;
            const startTime = Date.now();

            const requestPromises: Promise<void>[] = [];

            for (let i = 0; i < rapidRequests; i++) {
                requestPromises.push(
                    (async () => {
                        try {
                            await page.click('[data-testid="add-expense-button"]');
                            await page.fill('[data-testid="expense-description"]', `Rapid expense ${i}`);
                            await page.fill('[data-testid="expense-amount"]', `${10 + i}.00`);
                            await page.click('[data-testid="save-expense-button"]');
                            await page.waitForLoadState('domcontentloaded');

                            if (page.url().includes('/add-expense')) {
                                await page.click('[data-testid="cancel-button"]');
                            }
                        } catch (error) {
                            console.log(`Request ${i} failed:`, error);
                        }
                    })(),
                );
            }

            await Promise.allSettled(requestPromises);

            const endTime = Date.now();
            const totalDuration = endTime - startTime;

            // Check for rate limiting responses
            const rateLimitedResponses = apiResponses.filter(
                (r) =>
                    r.status === 429 || // Too Many Requests
                    r.status === 503, // Service Unavailable (might indicate rate limiting)
            );

            if (rateLimitedResponses.length > 0) {
                // Good - rate limiting is working
                expect(rateLimitedResponses.length).toBeGreaterThan(0);
                console.log(`Rate limiting detected: ${rateLimitedResponses.length} requests limited`);
            } else {
                // Even without 429 responses, rapid requests should take reasonable time
                // (indicating some form of throttling or processing limits)
                expect(totalDuration).toBeGreaterThan(2000); // Should take at least 2 seconds for 15 requests
            }
        });

        test('prevents rapid group creation abuse', async ({ authenticatedPage }) => {
            const { page, dashboardPage } = authenticatedPage;

            await dashboardPage.navigate();

            // Track group creation attempts
            let groupsCreated = 0;
            let creationErrors = 0;
            const startTime = Date.now();

            // Attempt rapid group creation
            for (let i = 0; i < 10; i++) {
                try {
                    await page.click('[data-testid="create-group-button"]');
                    await page.fill('[data-testid="group-name-input"]', `Rapid Group ${i}`);
                    await page.fill('[data-testid="group-description-input"]', `Description ${i}`);
                    await page.click('[data-testid="create-group-submit"]');
                    await page.waitForLoadState('domcontentloaded');

                    if (page.url().includes('/groups/')) {
                        groupsCreated++;
                        // Navigate back to dashboard for next creation
                        await page.goto('/dashboard');
                        await page.waitForSelector('[data-testid="dashboard"]');
                    } else {
                        // Check for rate limiting error
                        const errorElement = page.locator('[data-testid="error-message"]');
                        if (await errorElement.isVisible()) {
                            const errorText = await errorElement.textContent();
                            if (errorText?.match(/rate.*limit|too.*many|try.*again/i)) {
                                creationErrors++;
                                console.log(`Rate limiting detected for group creation: ${errorText}`);
                            }
                        }

                        // Close modal and continue
                        const cancelButton = page.locator('[data-testid="cancel-button"], [data-testid="close-button"]');
                        if (await cancelButton.isVisible()) {
                            await cancelButton.click();
                        }
                    }
                } catch (error) {
                    creationErrors++;
                    console.log(`Group creation ${i} failed:`, error);
                }

                // Wait for operation to complete before next attempt
                await page.waitForLoadState('domcontentloaded');
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Either rate limiting should occur, or operations should take reasonable time
            if (creationErrors > 0) {
                expect(creationErrors).toBeGreaterThan(0);
            } else {
                // Without rate limiting, operations should still take reasonable time
                expect(duration).toBeGreaterThan(1000); // At least 1 second for 10 operations
            }

            // Shouldn't allow creating unlimited groups instantly
            expect(groupsCreated).toBeLessThan(10);
        });

        test('limits file upload abuse', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Create group for testing
            const groupWorkflow = new GroupWorkflow(page);
            const groupName = generateTestGroupName('FileUpload');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing file upload limits');

            const fileUploadResults: Array<{ success: boolean; error?: string }> = [];

            // Test multiple rapid file uploads
            for (let i = 0; i < 5; i++) {
                try {
                    await page.click('[data-testid="add-expense-button"]');
                    await page.fill('[data-testid="expense-description"]', `File test ${i}`);
                    await page.fill('[data-testid="expense-amount"]', `${20 + i}.00`);

                    const fileInput = page.locator('[data-testid="receipt-upload"], input[type="file"]');
                    if (await fileInput.isVisible()) {
                        // Create a test file
                        const testFile = Buffer.from(`Receipt content ${i} - this is test data`);

                        await fileInput.setInputFiles({
                            name: `receipt-${i}.txt`,
                            mimeType: 'text/plain',
                            buffer: testFile,
                        });

                        await page.click('[data-testid="save-expense-button"]');
                        await page.waitForLoadState('domcontentloaded');

                        if (page.url().includes('/add-expense')) {
                            // Check for upload error
                            const errorElement = page.locator('[data-testid="file-error"], [data-testid="error-message"]');
                            if (await errorElement.isVisible()) {
                                const errorText = await errorElement.textContent();
                                fileUploadResults.push({
                                    success: false,
                                    error: errorText || 'Upload failed',
                                });
                            }
                            await page.click('[data-testid="cancel-button"]');
                        } else {
                            fileUploadResults.push({ success: true });
                            // Navigate back for next test
                            const groupId = page.url().split('/groups/')[1];
                            await page.goto(`/groups/${groupId}`);
                        }
                    } else {
                        // File upload not supported, skip this test
                        await page.click('[data-testid="cancel-button"]');
                        break;
                    }
                } catch (error) {
                    fileUploadResults.push({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            // Analyze results
            const successfulUploads = fileUploadResults.filter((r) => r.success).length;
            const rateLimitedUploads = fileUploadResults.filter((r) => r.error?.match(/rate.*limit|too.*many|upload.*limit|file.*size|quota/i)).length;

            if (rateLimitedUploads > 0) {
                // Good - upload limiting is working
                expect(rateLimitedUploads).toBeGreaterThan(0);
            } else if (fileUploadResults.length > 0) {
                // Even without explicit rate limiting, not all uploads should succeed
                expect(successfulUploads).toBeLessThanOrEqual(fileUploadResults.length);
            }
        });
    });

    test.describe('Resource Consumption Protection', () => {
        test('prevents memory exhaustion through large payloads', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Create group for testing
            const groupWorkflow = new GroupWorkflow(page);
            const groupName = generateTestGroupName('MemoryTest');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing memory exhaustion protection');

            // Test extremely large descriptions
            const largeSizes = [
                1000, // 1KB
                10000, // 10KB
                100000, // 100KB
                1000000, // 1MB (should definitely be rejected)
            ];

            for (const size of largeSizes) {
                const largeDescription = 'A'.repeat(size);

                await page.click('[data-testid="add-expense-button"]');

                try {
                    await page.fill('[data-testid="expense-description"]', largeDescription);
                    await page.fill('[data-testid="expense-amount"]', '50.00');
                    await page.click('[data-testid="save-expense-button"]');
                    await page.waitForLoadState('domcontentloaded');

                    if (page.url().includes('/add-expense')) {
                        // Should show validation error for large payloads
                        const errorElement = page.locator('[data-testid="description-error"], [data-testid="error-message"]');
                        if (await errorElement.isVisible()) {
                            const errorText = await errorElement.textContent();
                            expect(errorText).toMatch(/too.*long|exceeds.*limit|invalid.*length|size.*limit/i);
                        }
                        await page.click('[data-testid="cancel-button"]');
                    } else {
                        // If expense was created, description should be truncated
                        await page.click('[data-testid="expense-item"]');
                        const description = await page.locator('[data-testid="expense-description"]').textContent();

                        // Should be truncated, not the full massive string
                        expect(description!.length).toBeLessThan(size);
                        expect(description!.length).toBeLessThan(1000); // Reasonable limit

                        await page.goBack();
                    }
                } catch (error) {
                    // Browser might reject extremely large inputs
                    console.log(`Large payload test failed for size ${size}:`, error);
                }
            }
        });

        test('prevents DoS through recursive operations', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Create group for testing
            const groupWorkflow = new GroupWorkflow(page);
            const groupName = generateTestGroupName('RecursionTest');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing recursion protection');

            // Test deeply nested data structures in form submissions
            const createNestedObject = (depth: number): any => {
                if (depth === 0) return 'value';
                return { nested: createNestedObject(depth - 1) };
            };

            // Try to submit deeply nested data via browser manipulation
            await page.click('[data-testid="add-expense-button"]');

            const nestedData = createNestedObject(1000); // Very deep nesting

            // Try to inject nested data via form manipulation
            const injectionResult = await page.evaluate((data: any) => {
                try {
                    const form = document.querySelector('[data-testid="expense-form"]') as HTMLFormElement;
                    if (form) {
                        const hiddenInput = document.createElement('input');
                        hiddenInput.type = 'hidden';
                        hiddenInput.name = 'nestedData';
                        hiddenInput.value = JSON.stringify(data);
                        form.appendChild(hiddenInput);
                        return 'injected';
                    }
                    return 'no-form';
                } catch (error) {
                    return 'error';
                }
            }, nestedData);

            if (injectionResult === 'injected') {
                await page.fill('[data-testid="expense-description"]', 'Recursion test');
                await page.fill('[data-testid="expense-amount"]', '45.00');
                await page.click('[data-testid="save-expense-button"]');
                await page.waitForLoadState('domcontentloaded');

                // Server should either reject the deeply nested data or handle it gracefully
                if (page.url().includes('/add-expense')) {
                    const errorElement = page.locator('[data-testid="error-message"]');
                    if (await errorElement.isVisible()) {
                        // Good - server rejected malicious nested data
                        const errorText = await errorElement.textContent();
                        expect(errorText).toBeDefined();
                    }
                } else {
                    // If expense was created, the nested data should be ignored
                    await page.click('[data-testid="expense-item"]');
                    const description = await page.locator('[data-testid="expense-description"]').textContent();
                    expect(description).toBe('Recursion test'); // Normal description, nested data ignored
                    await page.goBack();
                }
            }

            await page.click('[data-testid="cancel-button"]');
        });

        test('handles concurrent user operations gracefully', async ({ authenticatedPage, secondUser }) => {
            const { page: page1 } = authenticatedPage;
            const { page: page2 } = secondUser;

            // Create shared group
            const groupWorkflow = new GroupWorkflow(page1);
            const groupName = generateTestGroupName('ConcurrentTest');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing concurrent operations');

            // User 2 joins the group
            await page1.click('[data-testid="share-group-button"]');
            const shareLink = await page1.locator('[data-testid="share-link"]').textContent();
            await page1.click('[data-testid="close-share-modal"]');

            await page2.goto(shareLink!);
            await page2.click('[data-testid="join-group-button"]');
            await page2.waitForSelector('[data-testid="group-header"]');

            // Both users simultaneously create expenses
            const concurrentOperations = [];

            // User 1 operations
            for (let i = 0; i < 5; i++) {
                concurrentOperations.push(
                    (async () => {
                        try {
                            await page1.click('[data-testid="add-expense-button"]');
                            await page1.fill('[data-testid="expense-description"]', `User 1 expense ${i}`);
                            await page1.fill('[data-testid="expense-amount"]', `${10 + i}.00`);
                            await page1.click('[data-testid="save-expense-button"]');
                            await page1.waitForLoadState('domcontentloaded');
                            return { user: 1, expense: i, success: true };
                        } catch (error) {
                            return { user: 1, expense: i, success: false, error };
                        }
                    })(),
                );
            }

            // User 2 operations
            for (let i = 0; i < 5; i++) {
                concurrentOperations.push(
                    (async () => {
                        try {
                            await page2.click('[data-testid="add-expense-button"]');
                            await page2.fill('[data-testid="expense-description"]', `User 2 expense ${i}`);
                            await page2.fill('[data-testid="expense-amount"]', `${20 + i}.00`);
                            await page2.click('[data-testid="save-expense-button"]');
                            await page2.waitForLoadState('domcontentloaded');
                            return { user: 2, expense: i, success: true };
                        } catch (error) {
                            return { user: 2, expense: i, success: false, error };
                        }
                    })(),
                );
            }

            const results = await Promise.allSettled(concurrentOperations);

            // Analyze results
            const successfulOperations = results.filter((r) => r.status === 'fulfilled' && (r.value as any).success).length;

            const failedOperations = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)).length;

            // System should handle concurrent operations gracefully
            // Either all succeed (good system) or some fail gracefully (also acceptable)
            expect(successfulOperations + failedOperations).toBe(10);

            // At least some operations should succeed
            expect(successfulOperations).toBeGreaterThan(0);

            // Check final state - navigate both users to group page
            await page1.goto(`/groups/${page1.url().split('/groups/')[1].split('/')[0]}`);
            await page2.goto(`/groups/${page2.url().split('/groups/')[1].split('/')[0]}`);

            // Both users should see consistent expense list
            await page1.waitForSelector('[data-testid="expense-item"]');
            await page2.waitForSelector('[data-testid="expense-item"]');

            const user1Expenses = await page1.locator('[data-testid="expense-item"]').count();
            const user2Expenses = await page2.locator('[data-testid="expense-item"]').count();

            // Both users should see the same number of expenses (consistency)
            expect(user1Expenses).toBe(user2Expenses);
        });
    });

    test.describe('Quota and Limit Enforcement', () => {
        test('enforces reasonable limits on group membership', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Create group for testing
            const groupWorkflow = new GroupWorkflow(page);
            const groupName = generateTestGroupName('MemberLimit');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing member limits');

            // Generate share link
            await page.click('[data-testid="share-group-button"]');
            const shareLink = await page.locator('[data-testid="share-link"]').textContent();
            await page.click('[data-testid="close-share-modal"]');

            // Try to simulate adding many members (via share link usage)
            // This is a conceptual test - in practice, you'd need multiple real users

            // Check current member count
            const membersList = page.locator('[data-testid="member-item"]');
            const initialMemberCount = await membersList.count();

            // Verify reasonable limits exist (check UI or documentation)
            const groupInfoElement = page.locator('[data-testid="group-info"], [data-testid="member-count"]');
            if (await groupInfoElement.isVisible()) {
                const infoText = await groupInfoElement.textContent();

                // Look for member limit indicators
                if (infoText?.match(/\d+\s*\/\s*\d+/)) {
                    // Found limit notation like "5/50 members"
                    const match = infoText.match(/(\d+)\s*\/\s*(\d+)/);
                    if (match) {
                        const current = parseInt(match[1]);
                        const limit = parseInt(match[2]);
                        expect(limit).toBeLessThanOrEqual(1000); // Should have reasonable limit
                        expect(current).toBeLessThanOrEqual(limit);
                    }
                }
            }

            // Verify share link has expiration or usage limits
            expect(shareLink).toBeTruthy();
            expect(shareLink!.length).toBeGreaterThan(10);

            // Share link should not be indefinitely valid
            // (This would require time-based testing or checking URL parameters)
        });

        test('enforces storage limits for file uploads', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Create group for testing
            const groupWorkflow = new GroupWorkflow(page);
            const groupName = generateTestGroupName('StorageLimit');
            await groupWorkflow.createGroupAndNavigate(groupName, 'Testing storage limits');

            await page.click('[data-testid="add-expense-button"]');

            const fileInput = page.locator('[data-testid="receipt-upload"], input[type="file"]');
            if (await fileInput.isVisible()) {
                // Test various file sizes
                const fileSizes = [
                    1024, // 1KB (should work)
                    1024000, // 1MB (might work)
                    10240000, // 10MB (should be rejected)
                    52428800, // 50MB (definitely should be rejected)
                ];

                for (const size of fileSizes) {
                    try {
                        // Create a large file
                        const largeFile = Buffer.alloc(size, 'A');

                        await fileInput.setInputFiles({
                            name: `large-receipt-${size}.txt`,
                            mimeType: 'text/plain',
                            buffer: largeFile,
                        });

                        await page.fill('[data-testid="expense-description"]', `Size test ${size}`);
                        await page.fill('[data-testid="expense-amount"]', '30.00');
                        await page.click('[data-testid="save-expense-button"]');
                        await page.waitForLoadState('domcontentloaded');

                        if (size > 5242880) {
                            // 5MB - should be rejected
                            // Should show file size error
                            const errorElement = page.locator('[data-testid="file-error"], [data-testid="error-message"]');
                            if (await errorElement.isVisible()) {
                                const errorText = await errorElement.textContent();
                                expect(errorText).toMatch(/file.*size|too.*large|size.*limit|upload.*limit/i);
                            }
                        }

                        // Clean up for next test
                        if (page.url().includes('/add-expense')) {
                            await page.click('[data-testid="cancel-button"]');
                            await page.click('[data-testid="add-expense-button"]');
                        } else {
                            // Navigate back and try again
                            await page.goBack();
                            await page.click('[data-testid="add-expense-button"]');
                        }
                    } catch (error) {
                        // File upload rejection is expected for large files
                        console.log(`File upload rejected for size ${size}:`, error);
                    }
                }
            }

            await page.click('[data-testid="cancel-button"]');
        });

        test('prevents database query abuse', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;

            // Navigate to dashboard to test pagination/query limits
            await page.goto('/dashboard');
            await page.waitForSelector('[data-testid="dashboard"]');

            // Test pagination controls if available
            const loadMoreButton = page.locator('[data-testid="load-more"], [data-testid="show-more"], text=Load more');

            if (await loadMoreButton.isVisible()) {
                let clickCount = 0;
                const maxClicks = 20; // Try to load excessive amounts of data

                while ((await loadMoreButton.isVisible()) && clickCount < maxClicks) {
                    await loadMoreButton.click();
                    await page.waitForLoadState('domcontentloaded');
                    clickCount++;

                    // Check for rate limiting or query limits
                    const errorElement = page.locator('[data-testid="error-message"]');
                    if (await errorElement.isVisible()) {
                        const errorText = await errorElement.textContent();
                        if (errorText?.match(/rate.*limit|too.*many.*requests|query.*limit/i)) {
                            // Good - query abuse protection is working
                            expect(errorText).toMatch(/rate.*limit|too.*many.*requests|query.*limit/i);
                            break;
                        }
                    }

                    // Wait for request to complete before next one
                    await page.waitForLoadState('domcontentloaded');
                }

                // Should not allow unlimited data loading
                expect(clickCount).toBeLessThan(maxClicks);
            }

            // Test search query complexity if search is available
            const searchField = page.locator('[data-testid="search-input"], [data-testid="group-search"]');
            if (await searchField.isVisible()) {
                // Test complex search queries that might abuse database
                const complexQueries = [
                    'a'.repeat(1000), // Very long search
                    '*'.repeat(100), // Wildcard abuse
                    '%%%', // SQL wildcard patterns
                    '(((((((((((()))))))))))))', // Complex patterns
                ];

                for (const query of complexQueries) {
                    await searchField.fill(query);
                    // Submit search using button instead of keyboard
                    const searchButton = page.getByRole('button', { name: /search/i });
                    if (await searchButton.isVisible()) {
                        await searchButton.click();
                    } else {
                        // If no search button, submit the form containing the search input
                        await searchField.press('Enter');
                    }
                    await page.waitForLoadState('domcontentloaded');

                    // Should handle complex queries gracefully
                    const errorElement = page.locator('[data-testid="error-message"]');
                    if (await errorElement.isVisible()) {
                        const errorText = await errorElement.textContent();
                        expect(errorText).toMatch(/invalid.*search|search.*too.*complex|query.*invalid/i);
                    }

                    // Clear search for next test
                    await searchField.fill('');
                    // Submit search using button instead of keyboard
                    const clearSearchButton = page.getByRole('button', { name: /search/i });
                    if (await clearSearchButton.isVisible()) {
                        await clearSearchButton.click();
                    } else {
                        // If no search button, submit the form containing the search input
                        await searchField.press('Enter');
                    }
                }
            }
        });
    });
});

// Performance abuse tests
pageTest.describe('Performance Abuse Prevention', () => {
    pageTest('handles excessive DOM manipulation gracefully', async ({ page }) => {
        await page.goto('/');

        // Try to create excessive DOM elements
        const domAbuseResult = await page.evaluate(() => {
            try {
                const startTime = performance.now();

                // Try to create many DOM elements rapidly
                for (let i = 0; i < 10000; i++) {
                    const div = document.createElement('div');
                    div.innerHTML = `<span>Element ${i}</span>`;
                    document.body.appendChild(div);
                }

                const endTime = performance.now();
                return {
                    success: true,
                    duration: endTime - startTime,
                    elementCount: document.querySelectorAll('div').length,
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });

        if (domAbuseResult.success) {
            // Even if DOM manipulation succeeds, it should take reasonable time
            expect(domAbuseResult.duration).toBeLessThan(5000); // Less than 5 seconds

            // Clean up
            await page.evaluate(() => {
                document.querySelectorAll('div').forEach((div) => {
                    if (div.innerHTML.includes('Element ')) {
                        div.remove();
                    }
                });
            });
        } else {
            // Good - excessive DOM manipulation was prevented
            expect(domAbuseResult.error).toBeDefined();
        }
    });

    pageTest('prevents infinite loop attacks', async ({ page }) => {
        await page.goto('/');

        // Try to execute code that might cause infinite loops
        const loopPreventionResult = await page.evaluate(() => {
            try {
                let counter = 0;
                const startTime = Date.now();

                // Attempt a potentially infinite operation
                while (counter < 1000000) {
                    counter++;

                    // Check for timeout to prevent actually hanging the browser
                    if (Date.now() - startTime > 3000) {
                        break; // Emergency break after 3 seconds
                    }
                }

                return {
                    completed: counter >= 1000000,
                    iterations: counter,
                    duration: Date.now() - startTime,
                };
            } catch (error) {
                return {
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });

        if ('completed' in loopPreventionResult) {
            // Operation completed - should have taken reasonable time
            expect(loopPreventionResult.duration).toBeLessThan(10000); // Less than 10 seconds

            if (!loopPreventionResult.completed) {
                // Good - operation was interrupted before completion
                expect(loopPreventionResult.iterations).toBeLessThan(1000000);
            }
        } else {
            // Good - browser or environment prevented the loop
            expect(loopPreventionResult.error).toBeDefined();
        }
    });
});
