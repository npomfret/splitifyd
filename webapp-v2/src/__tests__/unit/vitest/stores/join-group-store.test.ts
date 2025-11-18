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
import { toDisplayName } from '@billsplit-wl/shared';

const mockedApiClient = apiClient as unknown as {
    joinGroupByLink: Mock;
    updateGroupMemberDisplayName: Mock;
};

afterEach(() => {
    joinGroupStore.reset();
    vi.clearAllMocks();
});

describe('joinGroupStore', () => {
    it('successfully joins a group with provided display name', async () => {
        mockedApiClient.joinGroupByLink.mockResolvedValue({
            groupId: 'group-123',
            groupName: 'Test Group',
            success: true,
            memberStatus: 'active',
        });

        const response = await joinGroupStore.joinGroup('share-link', toDisplayName('John Doe'));

        expect(response).not.toBeNull();
        expect(response?.groupId).toBe('group-123');
        expect(joinGroupStore.joinSuccess).toBe(true);
        expect(joinGroupStore.joinedGroupId).toBe('group-123');
        expect(mockedApiClient.joinGroupByLink).toHaveBeenCalledWith('share-link', 'John Doe');
    });

    it('throws error when display name conflicts', async () => {
        mockedApiClient.joinGroupByLink.mockRejectedValue({
            code: 'DISPLAY_NAME_CONFLICT',
            message: 'The name "John" is already in use by another member. Please choose a different name.',
        });

        await expect(joinGroupStore.joinGroup('conflict-link', toDisplayName('John'))).rejects.toEqual({
            code: 'DISPLAY_NAME_CONFLICT',
            message: 'The name "John" is already in use by another member. Please choose a different name.',
        });

        expect(joinGroupStore.joinSuccess).toBe(false);
    });

    it('sets an error when the share link has expired', async () => {
        mockedApiClient.joinGroupByLink.mockRejectedValue({
            code: 'LINK_EXPIRED',
            message: 'expired',
        });

        await joinGroupStore.joinGroup('expired-link', toDisplayName('Jane Doe'));

        expect(joinGroupStore.error).toBe('This invitation link is invalid or has expired');
        expect(joinGroupStore.joinSuccess).toBe(false);
    });
});
