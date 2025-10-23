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

vi.mock('@/utils/user-notification-detector', () => ({
    userNotificationDetector: {
        subscribe: vi.fn(),
    },
    UserNotificationDetector: class {},
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
import { CommentsStoreImpl } from '@/stores/comments-store';
import type { UserNotificationDetector } from '@/utils/user-notification-detector';
import type { CommentDTO, ListCommentsResponse } from '@splitifyd/shared';

const mockedApiClient = apiClient as unknown as {
    getGroupComments: Mock;
    getExpenseComments: Mock;
};

function createComment(id: string, message: string): CommentDTO {
    const now = new Date().toISOString();
    return {
        id,
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

describe('CommentsStoreImpl', () => {
    let unsubscribeMock: Mock;
    let subscribeMock: Mock;
    let store: CommentsStoreImpl;

    beforeEach(() => {
        unsubscribeMock = vi.fn();
        subscribeMock = vi.fn().mockReturnValue(unsubscribeMock);

        const notificationDetector = {
            subscribe: subscribeMock,
        } as unknown as UserNotificationDetector;

        store = new CommentsStoreImpl(notificationDetector);
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

        store.registerComponent('group', 'group-1');

        await mockedApiClient.getGroupComments.mock.results[0]!.value;

        expect(store.comments).toEqual([first]);
        expect(store.targetId).toBe('group-1');

        store.registerComponent('group', 'group-2');

        // Comments should be cleared immediately while new fetch is in-flight
        expect(store.comments).toEqual([]);
        expect(unsubscribeMock).toHaveBeenCalledTimes(1);
        expect(subscribeMock).toHaveBeenCalledTimes(2);

        await mockedApiClient.getGroupComments.mock.results[1]!.value;

        expect(store.comments).toEqual([second]);
        expect(store.targetId).toBe('group-2');
        expect(store.hasMore).toBe(false);
        expect(mockedApiClient.getGroupComments).toHaveBeenNthCalledWith(1, 'group-1', undefined);
        expect(mockedApiClient.getGroupComments).toHaveBeenNthCalledWith(2, 'group-2', undefined);
    });

    it('does not refetch when registering additional listener for same target', async () => {
        const first = createComment('1', 'Only comment');
        mockedApiClient.getGroupComments.mockResolvedValue(responseFor([first]));

        store.registerComponent('group', 'group-1');
        await mockedApiClient.getGroupComments.mock.results[0]!.value;

        store.registerComponent('group', 'group-1');

        expect(mockedApiClient.getGroupComments).toHaveBeenCalledTimes(1);
        expect(subscribeMock).toHaveBeenCalledTimes(1);
        expect(store.comments).toEqual([first]);
    });
});
