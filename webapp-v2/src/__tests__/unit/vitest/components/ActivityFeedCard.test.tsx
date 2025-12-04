import { ActivityFeedCard } from '@/components/dashboard/ActivityFeedCard.tsx';
import {
    type ActivityFeedAction,
    ActivityFeedActions,
    type ActivityFeedEventType,
    ActivityFeedEventTypes,
    type ActivityFeedItem,
    toCommentId,
    toGroupName,
    toSettlementId,
    toUserId,
} from '@billsplit-wl/shared';
import { ActivityFeedItemBuilder } from '@billsplit-wl/test-support';
import { type ReadonlySignal, type Signal } from '@preact/signals';
import { fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/navigation.service', () => ({
    navigationService: {
        goToGroup: vi.fn().mockResolvedValue(undefined),
        goToExpenseDetail: vi.fn().mockResolvedValue(undefined),
        navigateTo: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock must be defined inline to avoid hoisting issues
vi.mock('@/app/stores/activity-feed-store', async () => {
    const { signal } = await vi.importActual<typeof import('@preact/signals')>('@preact/signals');
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
import { navigationService as mockNavigationService } from '@/services/navigation.service';
import { toGroupId } from '@billsplit-wl/shared';
import { toExpenseId } from '@billsplit-wl/shared';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, any>) => {
            const translations: Record<string, string> = {
                'activityFeed.title': 'Recent Activity',
                'activityFeed.loading': 'Loading...',
                'activityFeed.error.loadFailed': 'We could not load your recent activity right now. Please try again.',
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
                'activityFeed.events.group-created': '{{actor}} created {{group}}',
                'activityFeed.events.group-updated': '{{actor}} updated {{group}}',
                'activityFeed.events.group-updated-from': '{{actor}} renamed {{previous}} to {{group}}',
                'activityFeed.events.expense-created': '{{actor}} added {{expense}} in {{group}}',
                'activityFeed.events.expense-updated': '{{actor}} updated {{expense}} in {{group}}',
                'activityFeed.events.expense-deleted': '{{actor}} deleted {{expense}} from {{group}}',
                'activityFeed.events.member-joined': '{{actor}} added {{target}} to {{group}}',
                'activityFeed.events.member-joined-self': '{{actor}} joined {{group}}',
                'activityFeed.events.member-left': '{{actor}} removed {{target}} from {{group}}',
                'activityFeed.events.member-left-self': '{{actor}} left {{group}}',
                'activityFeed.events.comment-added': '{{actor}} commented {{target}} in {{group}}',
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

function setSignalValue<T>(sig: ReadonlySignal<T>, value: T): void {
    (sig as Signal<T>).value = value;
}

const EVENT_ACTION_MAP: Record<ActivityFeedEventType, ActivityFeedAction> = {
    [ActivityFeedEventTypes.GROUP_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.GROUP_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.EXPENSE_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.EXPENSE_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.EXPENSE_DELETED]: ActivityFeedActions.DELETE,
    [ActivityFeedEventTypes.MEMBER_JOINED]: ActivityFeedActions.JOIN,
    [ActivityFeedEventTypes.MEMBER_LEFT]: ActivityFeedActions.LEAVE,
    [ActivityFeedEventTypes.COMMENT_ADDED]: ActivityFeedActions.COMMENT,
    [ActivityFeedEventTypes.SETTLEMENT_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.SETTLEMENT_UPDATED]: ActivityFeedActions.UPDATE,
};

function buildItem(id: string, eventType: ActivityFeedEventType | string, overrides?: Partial<ActivityFeedItem>): ActivityFeedItem {
    const action = EVENT_ACTION_MAP[eventType as ActivityFeedEventType] ?? ActivityFeedActions.UPDATE;
    const timestamp = new Date('2024-01-01T12:00:00.000Z').toISOString();

    const baseItem = ActivityFeedItemBuilder
        .create()
        .withId(id)
        .withUserId('user-1')
        .withGroupId(toGroupId('group-1'))
        .withGroupName(toGroupName('Test Group'))
        .withEventType(eventType as ActivityFeedEventType)
        .withAction(action)
        .withActorName('Alice')
        .withTimestamp(timestamp)
        .withCreatedAt(timestamp)
        .build();

    return {
        ...baseItem,
        ...overrides,
    };
}

describe('ActivityFeedCard', () => {
    beforeEach(() => {
        // Reset all mocks and signals
        vi.clearAllMocks();
        setSignalValue(mockStore.itemsSignal, []);
        setSignalValue(mockStore.loadingSignal, false);
        setSignalValue(mockStore.initializedSignal, false);
        setSignalValue(mockStore.errorSignal, null);
        setSignalValue(mockStore.hasMoreSignal, false);
        setSignalValue(mockStore.loadingMoreSignal, false);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('registers component on mount', () => {
            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(mockStore.registerComponent).toHaveBeenCalledWith('activity-feed-card', 'user-1');
        });

        it('deregisters component on unmount', () => {
            const { unmount } = render(<ActivityFeedCard userId={toUserId('user-1')} />);

            unmount();

            expect(mockStore.deregisterComponent).toHaveBeenCalledWith('activity-feed-card');
        });

        it('does not register when userId is empty', () => {
            render(<ActivityFeedCard userId={toUserId('')} />);

            expect(mockStore.registerComponent).not.toHaveBeenCalled();
        });
    });

    describe('Loading States', () => {
        it('shows loading state during initial load', () => {
            setSignalValue(mockStore.loadingSignal, true);
            setSignalValue(mockStore.initializedSignal, false);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('does not show loading state after initialization', () => {
            setSignalValue(mockStore.loadingSignal, false);
            setSignalValue(mockStore.initializedSignal, true);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        it('shows loading more state on load more button', () => {
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            setSignalValue(mockStore.hasMoreSignal, true);
            setSignalValue(mockStore.loadingMoreSignal, true);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Loading more...')).toBeInTheDocument();
        });
    });

    describe('Error States', () => {
        it('shows error message when error occurs', () => {
            setSignalValue(mockStore.errorSignal, 'Network error');

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByTestId('activity-feed-error')).toBeInTheDocument();
            expect(screen.getByText('We could not load your recent activity right now. Please try again.')).toBeInTheDocument();
        });

        it('shows retry button when error occurs', () => {
            setSignalValue(mockStore.errorSignal, 'Network error');

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        });

        it('calls refresh when retry button clicked', async () => {
            setSignalValue(mockStore.errorSignal, 'Network error');

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const retryButton = screen.getByRole('button', { name: 'Retry' });
            fireEvent.click(retryButton);

            expect(mockStore.refresh).toHaveBeenCalledTimes(1);
        });
    });

    describe('Empty State', () => {
        it('shows empty state when initialized with no items', () => {
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, []);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
            expect(screen.getByText('No activity yet')).toBeInTheDocument();
            expect(screen.getByText('When you or your group members make changes, they will appear here')).toBeInTheDocument();
        });

        it('does not show empty state when items exist', () => {
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.queryByTestId('activity-feed-empty')).not.toBeInTheDocument();
        });

        it('does not show empty state before initialization', () => {
            setSignalValue(mockStore.initializedSignal, false);
            setSignalValue(mockStore.itemsSignal, []);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.queryByTestId('activity-feed-empty')).not.toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('navigates to expense detail for expense-created events', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                details: { expenseId: toExpenseId('expense-1'), expenseDescription: 'Lunch' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const eventButton = screen.getByRole('button', { name: 'Alice added "Lunch" in Test Group' });
            fireEvent.click(eventButton);

            expect(mockNavigationService.goToExpenseDetail).toHaveBeenCalledWith('group-1', 'expense-1');
        });

        it('navigates to expense detail when comment targets an expense', () => {
            const item = buildItem('1', ActivityFeedEventTypes.COMMENT_ADDED, {
                details: { expenseId: toExpenseId('expense-2'), expenseDescription: 'Brunch' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const eventButton = screen.getByRole('button', { name: 'Alice commented on Brunch in Test Group' });
            fireEvent.click(eventButton);

            expect(mockNavigationService.goToExpenseDetail).toHaveBeenCalledWith('group-1', 'expense-2');
        });

        it('navigates to the settlements section for settlement events', () => {
            const item = buildItem('1', ActivityFeedEventTypes.SETTLEMENT_CREATED, {
                details: { settlementId: toSettlementId('settlement-1'), settlementDescription: 'Dinner payback' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const eventButton = screen.getByRole('button', { name: 'Alice added "Dinner payback" in Test Group' });
            fireEvent.click(eventButton);

            expect(mockNavigationService.navigateTo).toHaveBeenCalledWith('/groups/group-1#settlements');
        });

        it('navigates to the comments section when a comment targets the group', () => {
            const item = buildItem('1', ActivityFeedEventTypes.COMMENT_ADDED, {
                details: { commentId: toCommentId('comment-1') },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const eventButton = screen.getByRole('button', { name: 'Alice commented on the group in Test Group' });
            fireEvent.click(eventButton);

            expect(mockNavigationService.navigateTo).toHaveBeenCalledWith('/groups/group-1#comments');
        });

        it('falls back to group detail when specific target is unavailable', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                details: { targetUserName: 'Bob' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const eventButton = screen.getByRole('button', { name: 'Alice added Bob to Test Group' });
            fireEvent.click(eventButton);

            expect(mockNavigationService.goToGroup).toHaveBeenCalledWith('group-1');
        });
    });

    describe('Event Type Rendering', () => {
        it('renders expense-created event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                details: { expenseDescription: 'Lunch' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice added "Lunch" in Test Group')).toBeInTheDocument();
        });

        it('renders expense-updated event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_UPDATED, {
                details: { expenseDescription: 'Dinner' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice updated "Dinner" in Test Group')).toBeInTheDocument();
        });

        it('renders expense-deleted event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_DELETED, {
                details: { expenseDescription: 'Coffee' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice deleted "Coffee" from Test Group')).toBeInTheDocument();
        });

        it('renders member-joined event (someone else)', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                details: { targetUserId: toUserId('other-user'), targetUserName: 'Bob' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice added Bob to Test Group')).toBeInTheDocument();
        });

        it('renders member-joined event (self)', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                actorId: toUserId('actor-1'),
                details: { targetUserId: toUserId('actor-1') },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice joined Test Group')).toBeInTheDocument();
        });

        it('renders member-left event (someone else)', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_LEFT, {
                details: { targetUserId: toUserId('other-user'), targetUserName: 'Bob' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice removed Bob from Test Group')).toBeInTheDocument();
        });

        it('renders member-left event (self)', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_LEFT, {
                actorId: toUserId('actor-1'),
                details: { targetUserId: toUserId('actor-1') },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice left Test Group')).toBeInTheDocument();
        });

        it('renders comment-added event on expense', () => {
            const item = buildItem('1', ActivityFeedEventTypes.COMMENT_ADDED, {
                details: { expenseDescription: 'Groceries', commentPreview: 'Thanks for picking this up!' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice commented on Groceries in Test Group')).toBeInTheDocument();
            expect(screen.getByText('Thanks for picking this up!')).toBeInTheDocument();
        });

        it('renders comment-added event on group', () => {
            const item = buildItem('1', ActivityFeedEventTypes.COMMENT_ADDED, {
                details: { commentPreview: 'Great group!' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice commented on the group in Test Group')).toBeInTheDocument();
            expect(screen.getByText('Great group!')).toBeInTheDocument();
        });

        it('renders group-updated event with name change', () => {
            const item = buildItem('1', ActivityFeedEventTypes.GROUP_UPDATED, {
                details: { previousGroupName: toGroupName('Old Group Name') },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice renamed Old Group Name to Test Group')).toBeInTheDocument();
        });

        it('renders group-updated event without name change', () => {
            const item = buildItem('1', ActivityFeedEventTypes.GROUP_UPDATED, {
                details: {},
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice updated Test Group')).toBeInTheDocument();
        });

        it('renders settlement-created event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.SETTLEMENT_CREATED, {
                details: { settlementDescription: 'Payment to Bob' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice added "Payment to Bob" in Test Group')).toBeInTheDocument();
        });

        it('renders settlement-updated event', () => {
            const item = buildItem('1', ActivityFeedEventTypes.SETTLEMENT_UPDATED, {
                details: { settlementDescription: 'Updated payment' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice updated "Updated payment" in Test Group')).toBeInTheDocument();
        });
    });

    describe('Actor Name Resolution', () => {
        it('shows "You" when actor is current user', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                actorId: toUserId('user-1'),
                details: { expenseDescription: 'Lunch' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('You added "Lunch" in Test Group')).toBeInTheDocument();
        });

        it('shows actor name when actor is different user', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                actorId: toUserId('actor-1'),
                actorName: 'Alice',
                details: { expenseDescription: 'Lunch' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-2')} />);

            expect(screen.getByText('Alice added "Lunch" in Test Group')).toBeInTheDocument();
        });
    });

    describe('Target Name Resolution', () => {
        it('shows "You" when target is current user', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                actorId: toUserId('actor-1'),
                actorName: 'Alice',
                details: { targetUserId: toUserId('user-1'), targetUserName: 'You' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice added You to Test Group')).toBeInTheDocument();
        });

        it('shows target name when target is different user', () => {
            const item = buildItem('1', ActivityFeedEventTypes.MEMBER_JOINED, {
                details: { targetUserId: toUserId('other-user'), targetUserName: 'Bob' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Alice added Bob to Test Group')).toBeInTheDocument();
        });
    });

    describe('Pagination', () => {
        it('shows load more button when hasMore is true', () => {
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            setSignalValue(mockStore.hasMoreSignal, true);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByRole('button', { name: 'Load More' })).toBeInTheDocument();
        });

        it('does not show load more button when hasMore is false', () => {
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            setSignalValue(mockStore.hasMoreSignal, false);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
        });

        it('calls loadMore when load more button clicked', async () => {
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            setSignalValue(mockStore.hasMoreSignal, true);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const loadMoreButton = screen.getByRole('button', { name: 'Load More' });
            fireEvent.click(loadMoreButton);

            expect(mockStore.loadMore).toHaveBeenCalledTimes(1);
        });

        it('disables load more button when loading more', () => {
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);
            setSignalValue(mockStore.hasMoreSignal, true);
            setSignalValue(mockStore.loadingMoreSignal, true);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

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
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, items);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const itemElements = screen.getAllByTestId('activity-feed-item');
            expect(itemElements).toHaveLength(3);
        });

        it('displays group name for each item', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED, {
                groupName: toGroupName('Travel Group'),
                details: { expenseDescription: 'Hotel' },
            });
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByText('Travel Group')).toBeInTheDocument();
        });

        it('displays event type as data attribute', () => {
            const item = buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED);
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [item]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            const itemElement = screen.getByTestId('activity-feed-item');
            expect(itemElement).toHaveAttribute('data-event-type', ActivityFeedEventTypes.EXPENSE_CREATED);
        });
    });

    describe('Component Structure', () => {
        it('has proper semantic structure', () => {
            setSignalValue(mockStore.initializedSignal, true);
            setSignalValue(mockStore.itemsSignal, [buildItem('1', ActivityFeedEventTypes.EXPENSE_CREATED)]);

            render(<ActivityFeedCard userId={toUserId('user-1')} />);

            expect(screen.getByTestId('activity-feed-card')).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
        });
    });
});
