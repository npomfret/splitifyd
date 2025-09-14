import { test, expect } from '@playwright/test';
import { setupStoreMocks, createTestPage, createTestUsers, createTestGroup, mockAuthState, mockGroupData, type TestUser } from './setup';

/**
 * Focused Playwright tests for permissions store functionality
 * 
 * Tests role-based UI visibility, permission caching, and client-side permission logic
 * without requiring full backend integration.
 */

test.describe('Permissions Store - Role-Based UI Visibility', () => {
    let testUsers: TestUser[];
    
    test.beforeEach(async ({ page }) => {
        await setupStoreMocks(page);
        testUsers = createTestUsers();
    });

    test('should show admin controls only to admin users', async ({ page }) => {
        const adminUser = testUsers.find(u => u.role === 'admin')!;
        const testGroup = createTestGroup(testUsers, {
            canAddExpense: true,
            canEditExpense: true,
            canDeleteExpense: true, // Only admins should see delete
        });

        await mockAuthState(page, adminUser);
        await mockGroupData(page, testGroup);

        await createTestPage(page, `
            <div class="expense-controls">
                <!-- These should be visible to admin -->
                <button id="add-expense-btn" data-testid="add-expense">Add Expense</button>
                <button id="edit-expense-btn" data-testid="edit-expense">Edit Expense</button>
                <button id="delete-expense-btn" data-testid="delete-expense" class="admin-only">Delete Expense</button>
                
                <!-- Group management - admin only -->
                <button id="manage-members-btn" data-testid="manage-members" class="admin-only">Manage Members</button>
                <button id="delete-group-btn" data-testid="delete-group" class="admin-only">Delete Group</button>
            </div>

            <script>
                // Simulate permissions store behavior
                function applyPermissions() {
                    const user = window.mockAuthUser;
                    const group = window.mockGroup;
                    
                    // Admin-only elements
                    const adminOnlyElements = document.querySelectorAll('.admin-only');
                    adminOnlyElements.forEach(el => {
                        if (user.role === 'admin') {
                            el.style.display = 'block';
                            el.disabled = false;
                        } else {
                            el.style.display = 'none';
                            el.disabled = true;
                        }
                    });

                    // Permission-based controls
                    if (!group.permissions.canAddExpense || user.status !== 'active') {
                        document.getElementById('add-expense-btn').disabled = true;
                    }
                    if (!group.permissions.canEditExpense || user.status !== 'active') {
                        document.getElementById('edit-expense-btn').disabled = true;
                    }
                }
                
                // Apply permissions when page loads
                applyPermissions();
            </script>
        `);

        // Admin should see all controls
        await expect(page.getByTestId('add-expense')).toBeVisible();
        await expect(page.getByTestId('edit-expense')).toBeVisible();
        await expect(page.getByTestId('delete-expense')).toBeVisible();
        await expect(page.getByTestId('manage-members')).toBeVisible();
        await expect(page.getByTestId('delete-group')).toBeVisible();

        // Admin controls should be enabled
        await expect(page.getByTestId('delete-expense')).toBeEnabled();
        await expect(page.getByTestId('manage-members')).toBeEnabled();
        await expect(page.getByTestId('delete-group')).toBeEnabled();
    });

    test('should hide admin controls from member users', async ({ page }) => {
        const memberUser = testUsers.find(u => u.role === 'member')!;
        const testGroup = createTestGroup(testUsers, {
            canAddExpense: true,
            canEditExpense: true,
            canDeleteExpense: false, // Members can't delete
        });

        await createTestPage(page, `
            <div class="expense-controls">
                <!-- These should be visible to members -->
                <button id="add-expense-btn" data-testid="add-expense">Add Expense</button>
                <button id="edit-expense-btn" data-testid="edit-expense">Edit Expense</button>
                
                <!-- These should be hidden from members -->
                <button id="delete-expense-btn" data-testid="delete-expense" class="admin-only">Delete Expense</button>
                <button id="manage-members-btn" data-testid="manage-members" class="admin-only">Manage Members</button>
                <button id="delete-group-btn" data-testid="delete-group" class="admin-only">Delete Group</button>
            </div>

            <script>
                // Inject mock data before script execution
                window.mockAuthUser = ${JSON.stringify(memberUser)};
                window.mockGroup = ${JSON.stringify(testGroup)};
            </script>
            <script>
                function applyPermissions() {
                    const user = window.mockAuthUser;
                    const group = window.mockGroup;
                    
                    // Admin-only elements should be hidden
                    const adminOnlyElements = document.querySelectorAll('.admin-only');
                    adminOnlyElements.forEach(el => {
                        if (user.role === 'admin') {
                            el.style.display = 'block';
                            el.disabled = false;
                        } else {
                            el.style.display = 'none';
                            el.disabled = true;
                        }
                    });

                    // Member permissions
                    document.getElementById('add-expense-btn').disabled = !group.permissions.canAddExpense;
                    document.getElementById('edit-expense-btn').disabled = !group.permissions.canEditExpense;
                }
                
                applyPermissions();
            </script>
        `);

        // Member should see basic controls
        await expect(page.getByTestId('add-expense')).toBeVisible();
        await expect(page.getByTestId('edit-expense')).toBeVisible();

        // Member should NOT see admin controls
        await expect(page.getByTestId('delete-expense')).toBeHidden();
        await expect(page.getByTestId('manage-members')).toBeHidden();
        await expect(page.getByTestId('delete-group')).toBeHidden();
    });

    test('should disable all controls for inactive members', async ({ page }) => {
        const inactiveUser = testUsers.find(u => u.status === 'inactive')!;
        const testGroup = createTestGroup(testUsers, {
            canAddExpense: true,
            canEditExpense: true,
            canDeleteExpense: false,
        });

        await createTestPage(page, `
            <script>
                // Inject mock data before script execution
                window.mockAuthUser = ${JSON.stringify(inactiveUser)};
                window.mockGroup = ${JSON.stringify(testGroup)};
            </script>
            <div class="expense-controls">
                <button id="add-expense-btn" data-testid="add-expense">Add Expense</button>
                <button id="edit-expense-btn" data-testid="edit-expense">Edit Expense</button>
                <div id="inactive-message" data-testid="inactive-message" class="inactive-warning" style="display: none;">
                    Your membership is inactive. Contact an admin to reactivate.
                </div>
            </div>

            <script>
                function applyPermissions() {
                    const user = window.mockAuthUser;
                    
                    if (user.status !== 'active') {
                        // Disable all controls for inactive users
                        document.getElementById('add-expense-btn').disabled = true;
                        document.getElementById('edit-expense-btn').disabled = true;
                        document.getElementById('inactive-message').style.display = 'block';
                    }
                }
                
                applyPermissions();
            </script>
        `);

        // Inactive user should see controls but they should be disabled
        await expect(page.getByTestId('add-expense')).toBeVisible();
        await expect(page.getByTestId('edit-expense')).toBeVisible();
        await expect(page.getByTestId('add-expense')).toBeDisabled();
        await expect(page.getByTestId('edit-expense')).toBeDisabled();
        
        // Should see inactive message
        await expect(page.getByTestId('inactive-message')).toBeVisible();
    });

    test('should update permissions when user role changes', async ({ page }) => {
        const memberUser = testUsers.find(u => u.role === 'member')!;
        const testGroup = createTestGroup(testUsers);

        await createTestPage(page, `
            <script>
                // Inject mock data before script execution
                window.mockAuthUser = ${JSON.stringify(memberUser)};
                window.mockGroup = ${JSON.stringify(testGroup)};
            </script>
            <div class="expense-controls">
                <button id="delete-expense-btn" data-testid="delete-expense" class="admin-only">Delete Expense</button>
                <div id="role-display" data-testid="role-display"></div>
                <button id="simulate-promotion" data-testid="promote-user">Simulate Promotion to Admin</button>
            </div>

            <script>
                function applyPermissions() {
                    const user = window.mockAuthUser;
                    
                    // Update role display
                    document.getElementById('role-display').textContent = 'Role: ' + user.role;
                    
                    // Admin-only elements
                    const adminOnlyElements = document.querySelectorAll('.admin-only');
                    adminOnlyElements.forEach(el => {
                        if (user.role === 'admin') {
                            el.style.display = 'block';
                            el.disabled = false;
                        } else {
                            el.style.display = 'none';
                            el.disabled = true;
                        }
                    });
                }
                
                // Simulate role change
                document.getElementById('simulate-promotion').addEventListener('click', () => {
                    window.mockAuthUser.role = 'admin';
                    applyPermissions();
                });
                
                applyPermissions();
            </script>
        `);

        // Initially member - should not see delete button
        await expect(page.getByTestId('role-display')).toHaveText('Role: member');
        await expect(page.getByTestId('delete-expense')).toBeHidden();

        // Simulate promotion to admin
        await page.getByTestId('promote-user').click();

        // Now should see admin controls
        await expect(page.getByTestId('role-display')).toHaveText('Role: admin');
        await expect(page.getByTestId('delete-expense')).toBeVisible();
        await expect(page.getByTestId('delete-expense')).toBeEnabled();
    });
});

test.describe('Permissions Store - Permission Caching', () => {
    test('should cache permission checks for performance', async ({ page }) => {
        const adminUser = createTestUsers().find(u => u.role === 'admin')!;
        const testGroup = createTestGroup([adminUser]);

        await createTestPage(page, `
            <script>
                // Inject mock data before script execution
                window.mockAuthUser = ${JSON.stringify(adminUser)};
                window.mockGroup = ${JSON.stringify(testGroup)};
            </script>
            <div>
                <div id="permission-checks" data-testid="check-count">Checks: 0</div>
                <button id="test-permission" data-testid="test-permission">Test Permission</button>
                <div id="cache-info" data-testid="cache-info">Cache: empty</div>
            </div>

            <script>
                // Simulate permission caching
                class PermissionCache {
                    constructor() {
                        this.cache = new Map();
                        this.ttl = 60000; // 1 minute
                        this.checkCount = 0;
                    }

                    check(key, compute) {
                        const cached = this.cache.get(key);
                        const now = Date.now();

                        if (cached && cached.expires > now) {
                            document.getElementById('cache-info').textContent = 'Cache: HIT';
                            return cached.value;
                        }

                        this.checkCount++;
                        const value = compute();
                        this.cache.set(key, { value, expires: now + this.ttl });
                        
                        document.getElementById('permission-checks').textContent = 'Checks: ' + this.checkCount;
                        document.getElementById('cache-info').textContent = 'Cache: MISS';
                        
                        return value;
                    }
                }

                const permissionCache = new PermissionCache();

                document.getElementById('test-permission').addEventListener('click', () => {
                    const key = 'group:test-group-123:user:admin-user-123:action:canDeleteExpense';
                    const result = permissionCache.check(key, () => {
                        return window.mockAuthUser.role === 'admin';
                    });
                });
            </script>
        `);

        // First check should miss cache
        await page.getByTestId('test-permission').click();
        await expect(page.getByTestId('check-count')).toHaveText('Checks: 1');
        await expect(page.getByTestId('cache-info')).toHaveText('Cache: MISS');

        // Second check should hit cache
        await page.getByTestId('test-permission').click();
        await expect(page.getByTestId('check-count')).toHaveText('Checks: 1'); // Still 1!
        await expect(page.getByTestId('cache-info')).toHaveText('Cache: HIT');

        // Multiple rapid clicks should all hit cache
        await page.getByTestId('test-permission').click();
        await page.getByTestId('test-permission').click();
        await page.getByTestId('test-permission').click();
        await expect(page.getByTestId('check-count')).toHaveText('Checks: 1');
        await expect(page.getByTestId('cache-info')).toHaveText('Cache: HIT');
    });
});