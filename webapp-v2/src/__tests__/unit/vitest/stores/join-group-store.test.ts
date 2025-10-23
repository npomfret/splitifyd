import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/app/apiClient', () => {
    return {
        apiClient: {
            joinGroupByLink: vi.fn(),
            updateGroupMemberDisplayName: vi.fn(),
        },
        ApiError: class MockApiError extends Error {
            code: string;
            constructor(message: string, code: string) {
                super(message);
                this.code = code;
            }
        },
    };
});

import { apiClient } from '@/app/apiClient';
import { joinGroupStore } from '@/app/stores/join-group-store';

const mockedApiClient = apiClient as unknown as {
    joinGroupByLink: Mock;
    updateGroupMemberDisplayName: Mock;
};

afterEach(() => {
    joinGroupStore.reset();
    vi.clearAllMocks();
});

describe('joinGroupStore', () => {
    it('sets conflict state when join response indicates display name conflict', async () => {
        mockedApiClient.joinGroupByLink.mockResolvedValue({
            groupId: 'group-123',
            groupName: 'Test Group',
            success: true,
            displayNameConflict: true,
        });

        const response = await joinGroupStore.joinGroup('share-link');

        expect(response).not.toBeNull();
        expect(response?.displayNameConflict).toBe(true);
        expect(joinGroupStore.displayNameConflict).toBe(true);
        expect(joinGroupStore.joinSuccess).toBe(false);
        expect(joinGroupStore.joinedGroupId).toBe('group-123');
    });

    it('resolves conflict by updating display name and marking join success', async () => {
        mockedApiClient.joinGroupByLink.mockResolvedValue({
            groupId: 'group-456',
            groupName: 'Design Squad',
            success: true,
            displayNameConflict: true,
        });
        mockedApiClient.updateGroupMemberDisplayName.mockResolvedValue({ message: 'ok' });

        await joinGroupStore.joinGroup('conflict-link');

        expect(joinGroupStore.displayNameConflict).toBe(true);

        await joinGroupStore.resolveDisplayNameConflict('UI Specialist');

        expect(mockedApiClient.updateGroupMemberDisplayName).toHaveBeenCalledWith('group-456', 'UI Specialist');
        expect(joinGroupStore.displayNameConflict).toBe(false);
        expect(joinGroupStore.joinSuccess).toBe(true);
        expect(joinGroupStore.displayNameUpdateError).toBeNull();
    });
});
