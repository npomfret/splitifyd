import { Page } from '@playwright/test';
import { UserProfileBuilder, MockGroupBuilder, GroupMemberBuilder } from '@splitifyd/test-support';

/**
 * Shared setup utilities for focused store testing using project builders
 */

export interface TestUser {
    uid: string;
    email: string;
    displayName: string;
    role: 'admin' | 'member' | 'viewer';
    status: 'active' | 'inactive';
}

export interface TestGroup {
    id: string;
    name: string;
    members: TestUser[];
    permissions: {
        canAddExpense: boolean;
        canEditExpense: boolean;
        canDeleteExpense: boolean;
        canViewGroup: boolean;
        canManageMembers?: boolean;
        canChangeRoles?: boolean;
    };
}

/**
 * Create test users with different roles using UserProfileBuilder
 */
export function createTestUsers(): TestUser[] {
    // Create base user profiles using the project's builder
    const adminProfile = new UserProfileBuilder()
        .withUid('admin-user-123')
        .withEmail('admin@test.com')
        .withDisplayName('Admin User')
        .build();
        
    const memberProfile = new UserProfileBuilder()
        .withUid('member-user-456')
        .withEmail('member@test.com')
        .withDisplayName('Member User')
        .build();
        
    const viewerProfile = new UserProfileBuilder()
        .withUid('viewer-user-789')
        .withEmail('viewer@test.com')
        .withDisplayName('Viewer User')
        .build();
        
    const inactiveProfile = new UserProfileBuilder()
        .withUid('inactive-user-000')
        .withEmail('inactive@test.com')
        .withDisplayName('Inactive User')
        .build();

    // Convert to TestUser format with roles and statuses
    return [
        {
            uid: adminProfile.uid,
            email: adminProfile.email,
            displayName: adminProfile.displayName,
            role: 'admin',
            status: 'active',
        },
        {
            uid: memberProfile.uid,
            email: memberProfile.email,
            displayName: memberProfile.displayName,
            role: 'member',
            status: 'active',
        },
        {
            uid: viewerProfile.uid,
            email: viewerProfile.email,
            displayName: viewerProfile.displayName,
            role: 'viewer',
            status: 'active',
        },
        {
            uid: inactiveProfile.uid,
            email: inactiveProfile.email,
            displayName: inactiveProfile.displayName,
            role: 'member',
            status: 'inactive',
        },
    ];
}

/**
 * Create a test group with specified permissions using MockGroupBuilder as base
 */
export function createTestGroup(users: TestUser[], permissions: Partial<TestGroup['permissions']> = {}): TestGroup {
    // Use the existing MockGroupBuilder as a starting point
    const mockGroup = new MockGroupBuilder().build();
    
    return {
        id: 'test-group-123',
        name: 'Test Group',
        members: users,
        permissions: {
            canAddExpense: true,
            canEditExpense: true,
            canDeleteExpense: false,
            canViewGroup: true,
            canManageMembers: false,
            canChangeRoles: false,
            ...permissions,
        },
    };
}

/**
 * Setup minimal mocks for store testing
 */
export async function setupStoreMocks(page: Page) {
    // Mock console to avoid noise in tests
    await page.addInitScript(() => {
        window.console.log = () => {};
        window.console.warn = () => {};
        window.console.info = () => {};
    });

    // Mock browser APIs that might be used by stores
    await page.addInitScript(() => {
        // Mock localStorage if not available
        if (typeof Storage === 'undefined') {
            (window as any).localStorage = {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
                clear: () => {},
            };
        }

        // Mock performance API
        if (!window.performance) {
            (window as any).performance = {
                now: () => Date.now(),
            };
        }
    });
}

/**
 * Create a minimal test page with basic HTML structure
 */
export async function createTestPage(page: Page, content: string = '') {
    await page.setContent(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Store Test</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .hidden { display: none !important; }
                .disabled { opacity: 0.5; cursor: not-allowed; }
                .error { color: red; border-color: red; }
                .success { color: green; border-color: green; }
                /* Basic form styling */
                input, select, textarea, button {
                    padding: 8px;
                    margin: 4px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                button { cursor: pointer; background: #007bff; color: white; }
                button:disabled { background: #ccc; cursor: not-allowed; }
                .dropdown { 
                    position: relative; 
                    display: inline-block; 
                }
                .dropdown-menu { 
                    position: absolute; 
                    top: 100%; 
                    left: 0; 
                    background: white; 
                    border: 1px solid #ccc; 
                    border-radius: 4px;
                    max-height: 200px;
                    overflow-y: auto;
                    z-index: 1000;
                }
                .dropdown-item { 
                    padding: 8px 12px; 
                    cursor: pointer; 
                }
                .dropdown-item:hover, .dropdown-item.highlighted { 
                    background: #f0f0f0; 
                }
            </style>
        </head>
        <body>
            <div id="test-container">
                ${content}
            </div>
        </body>
        </html>
    `);
}

/**
 * Mock authentication state for tests
 */
export async function mockAuthState(page: Page, user: TestUser | null) {
    await page.addInitScript((userData) => {
        (window as any).mockAuthUser = userData;
    }, user);
}

/**
 * Mock group data for permissions testing
 */
export async function mockGroupData(page: Page, group: TestGroup) {
    await page.addInitScript((groupData) => {
        (window as any).mockGroup = groupData;
    }, group);
}

/**
 * Wait for a specific condition with timeout
 */
export async function waitForCondition(
    page: Page,
    condition: () => Promise<boolean>,
    timeout: number = 5000,
    errorMsg: string = 'Condition not met within timeout'
): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return;
        }
        await page.waitForTimeout(100);
    }
    throw new Error(errorMsg);
}

/**
 * Create a mock API client for testing
 */
export function createMockApiResponses() {
    return {
        getGroup: (groupId: string) => ({
            id: groupId,
            name: 'Test Group',
            members: createTestUsers(),
        }),
        createExpense: (data: any) => ({
            id: 'test-expense-123',
            ...data,
            createdAt: new Date().toISOString(),
        }),
        updateExpense: (id: string, data: any) => ({
            id,
            ...data,
            updatedAt: new Date().toISOString(),
        }),
    };
}