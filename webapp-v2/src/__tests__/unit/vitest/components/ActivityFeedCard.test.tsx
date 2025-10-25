import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/preact';
import { ActivityFeedCard } from '@/components/dashboard/ActivityFeedCard.tsx';
import { signal, type Signal } from '@preact/signals';
import { ActivityFeedEventTypes, type ActivityFeedItem } from '@splitifyd/shared';

// Mock must be defined inline to avoid hoisting issues
vi.mock('@/app/stores/activity-feed-store', async () => {
    const { signal } = await import('@preact/signals');
    return {
        activityFeedStore: {
            itemsSignal: signal<ActivityFeedItem[]>([]),
            loadingSignal: signal(false),
            initializedSignal: signal(false),
            errorSignal: signal<string | null>(null),
            hasMoreSignal: signal(false),
            loadingMoreSignal: signal(false),
            registerComponent: vi.fn().mockResolvedValue(undefined),
            deregisterComponent: vi.fn(),
            refresh: vi.fn().mockResolvedValue(undefined),
            loadMore: vi.fn().mockResolvedValue(undefined),
            registerListener: vi.fn().mockResolvedValue(undefined),
            deregisterListener: vi.fn(),
            reset: vi.fn(),
        },
    };
});

vi.mock('@/utils/browser-logger', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
}));

// Import the mocked store after mocking
import { activityFeedStore as mockStore } from '@/app/stores/activity-feed-store';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, any>) => {
            const translations: Record<string, string> = {
                'activityFeed.title': 'Recent Activity',
                'activityFeed.loading': 'Loading...',
                'activityFeed.error.loadFailed': 'Failed to load activity feed',
                'activityFeed.actions.retry': 'Retry',
                'activityFeed.actions.loadMore': 'Load More',
                'activityFeed.actions.loadingMore': 'Loading more...',
                'activityFeed.emptyState.title': 'No activity yet',
                'activityFeed.emptyState.description': 'When you or your group members make changes, they will appear here',
                'activityFeed.labels.actorYou': 'You',
                'activityFeed.labels.unknownUser': 'Unknown user',
                'activityFeed.labels.unknownGroup': 'Unknown group',
                'activityFeed.labels.unknownExpense': 'an expense',
                'activityFeed.labels.unknownSettlement': 'a settlement',
                'activityFeed.labels.commentOnExpense': 'on {{description}}',
                'activityFeed.labels.commentOnGroup': 'on the group',
                'activityFeed.events.expense-created': '{{actor}} added {{expense}} in {{group}}',
                'activityFeed.events.expense-updated': '{{actor}} updated {{expense}} in {{group}}',
                'activityFeed.events.expense-deleted': '{{actor}} deleted {{expense}} from {{group}}',
                'activityFeed.events.member-joined': '{{actor}} added {{target}} to {{group}}',
                'activityFeed.events.member-joined-self': '{{actor}} joined {{group}}',
                'activityFeed.events.member-left': '{{actor}} removed {{target}} from {{group}}',
                'activityFeed.events.member-left-self': '{{actor}} left {{group}}',
                'activityFeed.events.comment-added': '{{actor}} commented {{target}} in {{group}}',
                'activityFeed.events.group-updated': '{{actor}} updated {{group}}',
                'activityFeed.events.group-updated-from': '{{actor}} renamed {{previous}} to {{group}}',
                'activityFeed.events.settlement-created': '{{actor}} added {{settlement}} in {{group}}',
                'activityFeed.events.settlement-updated': '{{actor}} updated {{settlement}} in {{group}}',
                'activityFeed.events.generic': '{{actor}} made a change in {{group}}',
            };

            if (params) {
                let result = translations[key] || key;
                Object.entries(params).forEach(([paramKey, paramValue]) => {
                    result = result.replace(`{{${paramKey}}}`, String(paramValue));
                });
                return result;
            }

            return translations[key] || key;
        },
    }),
}));

function buildItem(id: string, eventType: string, overrides?: Partial<ActivityFeedItem>): ActivityFeedItem {
    return {
        id,
        userId: 'user-1',
        groupId: 'group-1',
        groupName: 'Test Group',
        eventType: eventType as any,
        actorId: 'actor-1',
        actorName: 'Alice',
        timestamp: new Date('2024-01-01T12:00:00.000Z').toISOString(),
        details: {},
        createdAt: new Date('2024-01-01T12:00:00.000Z').toISOString(),
        ...overrides,
    };
}

describe('ActivityFeedCard', () => {
    beforeEach(() => {
        // Reset all mocks and signals
        vi.clearAllMocks();
        mockStore.itemsSignal.value = [];
        mockStore.loadingSignal.value = false;
        mockStore.initializedSignal.value = false;
        mockStore.errorSignal.value = null;
        mockStore.hasMoreSignal.value = false;
        mockStore.loadingMoreSignal.value = false;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('registers component on mount', () => {
            render(<ActivityFeedCard userId='user-1' />);

            expect(mockStore.registerComponent).toHaveBeenCalledWith('activity-feed-card', 'user-1');
        });

        it('deregisters component on unmount', () => {
            const { unmount } = render(<ActivityFeedCard userId='user-1' />);

            unmount();

            expect(mockStore.deregisterComponent).toHaveBeenCalledWith('activity-feed-card');
        });

        it('does not register when userId is empty', () => {
            render(<ActivityFeedCard userId='' />);

            expect(mockStore.registerComponent).not.toHaveBeenCalled();
        });
    });

    describe('Loading States', () => {
        it('shows loading state during initial load', () => {
            mockStore.loadingSignal.value = true;
            mockStore.initializedSignal.value = false;

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('does not show loading state after initialization', () => {
            mockStore.loadingSignal = signal(false);
            mockStore.initializedSignal = signal(true);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        it('shows loading more state on load more button', () => {
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            mockStore.hasMoreSignal = signal(true);
            mockStore.loadingMoreSignal = signal(true);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Loading more...')).toBeInTheDocument();
        });
    });

    describe('Error States', () => {
        it('shows error message when error occurs', () => {
            mockStore.errorSignal = signal('Network error');

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByTestId('activity-feed-error')).toBeInTheDocument();
            expect(screen.getByText('Failed to load activity feed')).toBeInTheDocument();
        });

        it('shows retry button when error occurs', () => {
            mockStore.errorSignal = signal('Network error');

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        });

        it('calls refresh when retry button clicked', async () => {
            mockStore.errorSignal = signal('Network error');

            render(<ActivityFeedCard userId='user-1' />);

            const retryButton = screen.getByRole('button', { name: 'Retry' });
            fireEvent.click(retryButton);

            expect(mockStore.refresh).toHaveBeenCalledTimes(1);
        });
    });

    describe('Empty State', () => {
        it('shows empty state when initialized with no items', () => {
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
            expect(screen.getByText('No activity yet')).toBeInTheDocument();
            expect(screen.getByText('When you or your group members make changes, they will appear here')).toBeInTheDocument();
        });

        it('does not show empty state when items exist', () => {
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.queryByTestId('activity-feed-empty')).not.toBeInTheDocument();
        });

        it('does not show empty state before initialization', () => {
            mockStore.initializedSignal = signal(false);
            mockStore.itemsSignal = signal([]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.queryByTestId('activity-feed-empty')).not.toBeInTheDocument();
        });
    });

    describe('Event Type Rendering', () => {
        it('renders expense-created event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                details: { expenseDescription: 'Lunch' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice added "Lunch" in Test Group')).toBeInTheDocument();
        });

        it('renders expense-updated event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_UPDATED, {
                details: { expenseDescription: 'Dinner' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice updated "Dinner" in Test Group')).toBeInTheDocument();
        });

        it('renders expense-deleted event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_DELETED, {
                details: { expenseDescription: 'Coffee' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice deleted "Coffee" from Test Group')).toBeInTheDocument();
        });

        it('renders member-joined event (someone else)', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                details: { targetUserId: 'other-user', targetUserName: 'Bob' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice added Bob to Test Group')).toBeInTheDocument();
        });

        it('renders member-joined event (self)', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                actorId: 'actor-1',
                details: { targetUserId: 'actor-1' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice joined Test Group')).toBeInTheDocument();
        });

        it('renders member-left event (someone else)', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_LEFT, {
                details: { targetUserId: 'other-user', targetUserName: 'Bob' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice removed Bob from Test Group')).toBeInTheDocument();
        });

        it('renders member-left event (self)', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_LEFT, {
                actorId: 'actor-1',
                details: { targetUserId: 'actor-1' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice left Test Group')).toBeInTheDocument();
        });

        it('renders comment-added event on expense', () => {
            const item = buildItem('1', ActivityFeedEventTypes.COMMENT_ADDED, {
                details: { expenseDescription: 'Groceries', commentPreview: 'Thanks for picking this up!' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice commented on Groceries in Test Group')).toBeInTheDocument();
            expect(screen.getByText('Thanks for picking this up!')).toBeInTheDocument();
        });

        it('renders comment-added event on group', () => {
            const item = buildItem('1', ActivityFeedEventTypes.COMMENT_ADDED, {
                details: { commentPreview: 'Great group!' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice commented on the group in Test Group')).toBeInTheDocument();
            expect(screen.getByText('Great group!')).toBeInTheDocument();
        });

        it('renders group-updated event with name change', () => {
            const item = buildItem('1', ActivityFeedEventTypes.GROUP_UPDATED, {
                details: { previousGroupName: 'Old Group Name' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice renamed Old Group Name to Test Group')).toBeInTheDocument();
        });

        it('renders group-updated event without name change', () => {
            const item = buildItem('1', ActivityFeedEventTypes.GROUP_UPDATED, {
                details: {},
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice updated Test Group')).toBeInTheDocument();
        });

        it('renders settlement-created event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.SETTLEMENT_CREATED, {
                details: { settlementDescription: 'Payment to Bob' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice added "Payment to Bob" in Test Group')).toBeInTheDocument();
        });

        it('renders settlement-updated event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.SETTLEMENT_UPDATED, {
                details: { settlementDescription: 'Updated payment' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice updated "Updated payment" in Test Group')).toBeInTheDocument();
        });
    });

    describe('Actor Name Resolution', () => {
        it('shows "You" when actor is current user', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                actorId: 'user-1',
                details: { expenseDescription: 'Lunch' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('You added "Lunch" in Test Group')).toBeInTheDocument();
        });

        it('shows actor name when actor is different user', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                actorId: 'actor-1',
                actorName: 'Alice',
                details: { expenseDescription: 'Lunch' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-2' />);

            expect(screen.getByText('Alice added "Lunch" in Test Group')).toBeInTheDocument();
        });
    });

    describe('Target Name Resolution', () => {
        it('shows "You" when target is current user', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                actorId: 'actor-1',
                actorName: 'Alice',
                details: { targetUserId: 'user-1', targetUserName: 'You' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice added You to Test Group')).toBeInTheDocument();
        });

        it('shows target name when target is different user', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                details: { targetUserId: 'other-user', targetUserName: 'Bob' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Alice added Bob to Test Group')).toBeInTheDocument();
        });
    });

    describe('Pagination', () => {
        it('shows load more button when hasMore is true', () => {
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            mockStore.hasMoreSignal = signal(true);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByRole('button', { name: 'Load More' })).toBeInTheDocument();
        });

        it('does not show load more button when hasMore is false', () => {
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            mockStore.hasMoreSignal = signal(false);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
        });

        it('calls loadMore when load more button clicked', async () => {
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            mockStore.hasMoreSignal = signal(true);

            render(<ActivityFeedCard userId='user-1' />);

            const loadMoreButton = screen.getByRole('button', { name: 'Load More' });
            fireEvent.click(loadMoreButton);

            expect(mockStore.loadMore).toHaveBeenCalledTimes(1);
        });

        it('disables load more button when loading more', () => {
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            mockStore.hasMoreSignal = signal(true);
            mockStore.loadingMoreSignal = signal(true);

            render(<ActivityFeedCard userId='user-1' />);

            const loadMoreButton = screen.getByRole('button', { name: 'Loading more...' });
            expect(loadMoreButton).toBeDisabled();
        });
    });

    describe('Item Display', () => {
        it('displays multiple items in order', () => {
            const items = [
                buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, { details: { expenseDescription: 'First' } }),
                buildItem('2', ActivityFeedEventTypes.EXPENSE_CREATED, { details: { expenseDescription: 'Second' } }),
                buildItem('3', ActivityFeedEventTypes.EXPENSE_CREATED, { details: { expenseDescription: 'Third' } }),
            ];
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal(items);

            render(<ActivityFeedCard userId='user-1' />);

            const itemElements = screen.getAllByTestId('activity-feed-item');
            expect(itemElements).toHaveLength(3);
        });

        it('displays group name for each item', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                groupName: 'Travel Group',
                details: { expenseDescription: 'Hotel' },
            });
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByText('Travel Group')).toBeInTheDocument();
        });

        it('displays event type as data attribute', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED);
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([item]);

            render(<ActivityFeedCard userId='user-1' />);

            const itemElement = screen.getByTestId('activity-feed-item');
            expect(itemElement).toHaveAttribute('data-event-type', ActivityFeedEventTypes.EXPENSE_CREATED);
        });
    });

    describe('Component Structure', () => {
        it('has proper semantic structure', () => {
            mockStore.initializedSignal = signal(true);
            mockStore.itemsSignal = signal([buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);

            render(<ActivityFeedCard userId='user-1' />);

            expect(screen.getByTestId('activity-feed-card')).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
        });
    });
});
