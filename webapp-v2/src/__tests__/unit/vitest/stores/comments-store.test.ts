import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/app/apiClient', () => ({
    apiClient: {
        listGroupComments: vi.fn(),
        listExpenseComments: vi.fn(),
        createGroupComment: vi.fn(),
        createExpenseComment: vi.fn(),
    },
}));

vi.mock('@/utils/browser-logger', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('@/app/stores/auth-store', () => ({
    getAuthStore: vi.fn().mockResolvedValue({
        user: {
            uid: 'test-user-id',
            email: 'test@example.com',
            displayName: 'Test User',
        },
    }),
}));

const matchMediaMock = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
}));

vi.stubGlobal('matchMedia', matchMediaMock);

if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
    });
}

import { apiClient } from '@/app/apiClient';
import type { ActivityFeedRealtimeService } from '@/app/services/activity-feed-realtime-service';
import { CommentsStoreImpl } from '@/stores/comments-store';
import type { CommentsStoreTarget } from '@/stores/comments-store';
import { CommentDTO, GroupId, ListCommentsResponse, toCommentText } from '@billsplit-wl/shared';
import { toCommentId, toGroupId } from '@billsplit-wl/shared';
import { toISOString } from '@billsplit-wl/shared';

const mockedApiClient = apiClient as unknown as {
    listGroupComments: Mock;
    listExpenseComments: Mock;
};

function createComment(id: string, message: string): CommentDTO {
    const now = toISOString(new Date().toISOString());
    return {
        id: toCommentId(id),
        text: toCommentText(message),
        createdAt: now,
        updatedAt: now,
        authorId: `user-${id}`,
        authorName: `User ${id}`,
    };
}

function responseFor(comments: CommentDTO[]): ListCommentsResponse {
    return {
        comments,
        hasMore: false,
        nextCursor: undefined,
    };
}

const groupTarget = (groupId: GroupId | string): CommentsStoreTarget => ({
    type: 'group',
    groupId: typeof groupId === 'string' ? toGroupId(groupId) : groupId,
});

describe('CommentsStoreImpl', () => {
    let registerConsumerMock: Mock;
    let deregisterConsumerMock: Mock;
    let activityFeedMock: ActivityFeedRealtimeService;
    let store: CommentsStoreImpl;

    beforeEach(() => {
        registerConsumerMock = vi.fn().mockResolvedValue(undefined);
        deregisterConsumerMock = vi.fn();

        activityFeedMock = {
            registerConsumer: registerConsumerMock,
            deregisterConsumer: deregisterConsumerMock,
            reset: vi.fn(),
        } as unknown as ActivityFeedRealtimeService;

        store = new CommentsStoreImpl(activityFeedMock);
        mockedApiClient.listGroupComments.mockReset();
        mockedApiClient.listExpenseComments.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('replaces comments and resets pagination when switching targets', async () => {
        const first = createComment('1', 'First comment');
        const second = createComment('2', 'Second comment');

        mockedApiClient
            .listGroupComments
            .mockResolvedValueOnce(responseFor([first]))
            .mockResolvedValueOnce(responseFor([second]));

        store.registerComponent(groupTarget('group-1'));

        // Wait for the async API call to complete
        await vi.waitFor(() => {
            expect(mockedApiClient.listGroupComments).toHaveBeenCalledTimes(1);
        });

        expect(store.comments).toEqual([first]);
        expect(store.groupId).toBe('group-1');

        store.registerComponent(groupTarget('group-2'));

        // Comments should be cleared immediately while new fetch is in-flight
        expect(store.comments).toEqual([]);
        expect(registerConsumerMock).toHaveBeenCalledTimes(1);
        expect(deregisterConsumerMock).not.toHaveBeenCalled();

        // Wait for the second async API call to complete
        await vi.waitFor(() => {
            expect(mockedApiClient.listGroupComments).toHaveBeenCalledTimes(2);
        });

        expect(store.comments).toEqual([second]);
        expect(store.groupId).toBe('group-2');
        expect(store.hasMore).toBe(false);
        expect(mockedApiClient.listGroupComments).toHaveBeenNthCalledWith(1, 'group-1', undefined);
        expect(mockedApiClient.listGroupComments).toHaveBeenNthCalledWith(2, 'group-2', undefined);
    });

    it('does not refetch when registering additional listener for same target', async () => {
        const first = createComment('1', 'Only comment');
        mockedApiClient.listGroupComments.mockResolvedValue(responseFor([first]));

        store.registerComponent(groupTarget('group-1'));

        // Wait for the async API call to complete
        await vi.waitFor(() => {
            expect(mockedApiClient.listGroupComments).toHaveBeenCalledTimes(1);
        });

        store.registerComponent(groupTarget('group-1'));

        expect(mockedApiClient.listGroupComments).toHaveBeenCalledTimes(1);
        expect(registerConsumerMock).toHaveBeenCalledTimes(1);
        expect(store.comments).toEqual([first]);
    });
});
