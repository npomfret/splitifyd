import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/app/apiClient', () => ({
    apiClient: {
        getGroupComments: vi.fn(),
        getExpenseComments: vi.fn(),
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
import type { CommentDTO, GroupId, ListCommentsResponse } from '@splitifyd/shared';
import { toCommentId, toGroupId } from '@splitifyd/shared';
import { toISOString } from '@splitifyd/shared';

const mockedApiClient = apiClient as unknown as {
    getGroupComments: Mock;
    getExpenseComments: Mock;
};

function createComment(id: string, message: string): CommentDTO {
    const now = toISOString(new Date().toISOString());
    return {
        id: toCommentId(id),
        text: message,
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
        mockedApiClient.getGroupComments.mockReset();
        mockedApiClient.getExpenseComments.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('replaces comments and resets pagination when switching targets', async () => {
        const first = createComment('1', 'First comment');
        const second = createComment('2', 'Second comment');

        mockedApiClient
            .getGroupComments
            .mockResolvedValueOnce(responseFor([first]))
            .mockResolvedValueOnce(responseFor([second]));

        store.registerComponent(groupTarget('group-1'));

        await mockedApiClient.getGroupComments.mock.results[0]!.value;

        expect(store.comments).toEqual([first]);
        expect(store.groupId).toBe('group-1');

        store.registerComponent(groupTarget('group-2'));

        // Comments should be cleared immediately while new fetch is in-flight
        expect(store.comments).toEqual([]);
        expect(registerConsumerMock).toHaveBeenCalledTimes(1);
        expect(deregisterConsumerMock).not.toHaveBeenCalled();

        await mockedApiClient.getGroupComments.mock.results[1]!.value;

        expect(store.comments).toEqual([second]);
        expect(store.groupId).toBe('group-2');
        expect(store.hasMore).toBe(false);
        expect(mockedApiClient.getGroupComments).toHaveBeenNthCalledWith(1, 'group-1', undefined);
        expect(mockedApiClient.getGroupComments).toHaveBeenNthCalledWith(2, 'group-2', undefined);
    });

    it('does not refetch when registering additional listener for same target', async () => {
        const first = createComment('1', 'Only comment');
        mockedApiClient.getGroupComments.mockResolvedValue(responseFor([first]));

        store.registerComponent(groupTarget('group-1'));
        await mockedApiClient.getGroupComments.mock.results[0]!.value;

        store.registerComponent(groupTarget('group-1'));

        expect(mockedApiClient.getGroupComments).toHaveBeenCalledTimes(1);
        expect(registerConsumerMock).toHaveBeenCalledTimes(1);
        expect(store.comments).toEqual([first]);
    });
});
