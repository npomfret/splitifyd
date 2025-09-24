import { Page } from '@playwright/test';
import { MockResponseBuilder } from '../builders/MockResponseBuilder';

/**
 * Mock object for handling Groups API endpoints in Playwright tests
 * Provides a fluent API for setting up group-related API responses
 */
export class GroupApiMock {
    constructor(private page: Page) {}

    async mockGetGroups(groups: any[]): Promise<void> {
        await this.page.route('**/api/groups', (route) => {
            const response = MockResponseBuilder.success(groups).build();
            route.fulfill(response);
        });
    }

    async mockGetGroupsError(errorMessage: string = 'Failed to load groups'): Promise<void> {
        await this.page.route('**/api/groups', (route) => {
            const response = MockResponseBuilder.serverError(errorMessage).build();
            route.fulfill(response);
        });
    }

    async mockGetGroupsWithDelay(groups: any[], delayMs: number = 200): Promise<void> {
        await this.page.route('**/api/groups', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            const response = MockResponseBuilder.success(groups).build();
            route.fulfill(response);
        });
    }

    async mockGetGroup(groupId: string, group: any): Promise<void> {
        await this.page.route(`**/api/groups/${groupId}`, (route) => {
            const response = MockResponseBuilder.success(group).build();
            route.fulfill(response);
        });
    }

    async mockGetGroupNotFound(groupId: string, message: string = 'Group not found'): Promise<void> {
        await this.page.route(`**/api/groups/${groupId}`, (route) => {
            const response = MockResponseBuilder.notFound(message).build();
            route.fulfill(response);
        });
    }

    async mockGetGroupDeleted(groupId: string): Promise<void> {
        await this.page.route(`**/api/groups/${groupId}`, (route) => {
            const response = MockResponseBuilder.notFound('Group has been deleted').withError('Group has been deleted', 'GROUP_DELETED').build();
            route.fulfill(response);
        });
    }

    async mockGetGroupUserRemoved(groupId: string): Promise<void> {
        await this.page.route(`**/api/groups/${groupId}`, (route) => {
            const response = MockResponseBuilder.forbidden('User removed from group').withError('User removed from group', 'USER_REMOVED_FROM_GROUP').build();
            route.fulfill(response);
        });
    }

    async mockGroupStats(stats: any): Promise<void> {
        await this.page.route('**/api/groups/stats**', (route) => {
            const response = MockResponseBuilder.success(stats).build();
            route.fulfill(response);
        });
    }

    async mockUserGroups(groups: any[]): Promise<void> {
        await this.page.route('**/api/user/groups', (route) => {
            const response = MockResponseBuilder.success(groups).build();
            route.fulfill(response);
        });
    }

    async mockGroupExpenses(groupId: string, expenses: any[]): Promise<void> {
        await this.page.route(`**/api/groups/${groupId}/expenses`, (route) => {
            if (route.request().method() === 'GET') {
                const response = MockResponseBuilder.success(expenses).build();
                route.fulfill(response);
            } else {
                route.continue();
            }
        });
    }

    async mockCreateExpense(groupId: string, expense: any): Promise<void> {
        await this.page.route(`**/api/groups/${groupId}/expenses`, (route) => {
            if (route.request().method() === 'POST') {
                const response = MockResponseBuilder.created(expense).build();
                route.fulfill(response);
            } else {
                route.continue();
            }
        });
    }

    async mockAllGroupsWithScenario(scenario: 'empty' | 'success' | 'error' | 'slow', groups: any[] = []): Promise<void> {
        switch (scenario) {
            case 'empty':
                await this.mockGetGroups([]);
                break;
            case 'success':
                await this.mockGetGroups(groups);
                break;
            case 'error':
                await this.mockGetGroupsError();
                break;
            case 'slow':
                await this.mockGetGroupsWithDelay(groups, 200);
                break;
        }

        await this.mockGroupStats({
            totalGroups: groups.length,
            totalBalance: groups.reduce((sum: number, g: any) => sum + (g.balance || 0), 0),
            activeGroups: groups.filter((g: any) => g.memberCount > 1).length,
        });
    }

    async mockFirebaseFirestoreGroup(groupId: string, group: any): Promise<void> {
        await this.page.route(`**/_mock/firebase-firestore/**`, (route) => {
            const url = route.request().url();

            if (url.includes(`documents/groups/${groupId}`)) {
                const response = MockResponseBuilder.success({
                    name: `documents/groups/${groupId}`,
                    fields: {
                        id: { stringValue: group.id },
                        name: { stringValue: group.name },
                        members: {
                            arrayValue: {
                                values: group.members.map((member: any) => ({
                                    mapValue: {
                                        fields: {
                                            id: { stringValue: member.id },
                                            email: { stringValue: member.email },
                                            displayName: { stringValue: member.displayName },
                                            joinedAt: { timestampValue: member.joinedAt },
                                        },
                                    },
                                })),
                            },
                        },
                    },
                }).build();
                route.fulfill(response);
            } else {
                route.continue();
            }
        });
    }
}
