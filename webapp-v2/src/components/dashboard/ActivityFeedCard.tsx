import { activityFeedStore } from '@/app/stores/activity-feed-store.ts';
import { RelativeTime } from '@/components/ui/RelativeTime.tsx';
import { routes } from '@/constants/routes.ts';
import { navigationService } from '@/services/navigation.service.ts';
import { logError } from '@/utils/browser-logger.ts';
import { useComputed } from '@preact/signals';
import type { ActivityFeedItem, UserId } from '@splitifyd/shared';
import type { TFunction } from 'i18next';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface ActivityFeedCardProps {
    userId: UserId;
}

export function ActivityFeedCard({ userId }: ActivityFeedCardProps) {
    const { t } = useTranslation();
    const items = useComputed(() => activityFeedStore.itemsSignal.value);
    const loading = useComputed(() => activityFeedStore.loadingSignal.value);
    const initialized = useComputed(() => activityFeedStore.initializedSignal.value);
    const error = useComputed(() => activityFeedStore.errorSignal.value);
    const hasMore = useComputed(() => activityFeedStore.hasMoreSignal.value);
    const loadingMore = useComputed(() => activityFeedStore.loadingMoreSignal.value);

    useEffect(() => {
        if (!userId) {
            return;
        }

        const componentId = 'activity-feed-card';
        void activityFeedStore.registerComponent(componentId, userId).catch((storeError) => {
            logError('Failed to register activity feed component', storeError);
        });

        return () => {
            activityFeedStore.deregisterComponent(componentId);
        };
    }, [userId]);

    const handleRetry = () => {
        void activityFeedStore.refresh().catch((refreshError) => {
            logError('Failed to refresh activity feed', refreshError);
        });
    };

    const handleLoadMore = () => {
        void activityFeedStore.loadMore().catch((loadError) => {
            logError('Failed to load more activity feed items', loadError);
        });
    };

    return (
        <div className='bg-white rounded-lg shadow-sm border border-gray-200' data-testid='activity-feed-card'>
            <div className='p-6'>
                <div className='flex items-center justify-between mb-4'>
                    <h3 className='text-lg font-semibold text-gray-900'>{t('activityFeed.title')}</h3>
                    {loading.value && !initialized.value ? <span className='text-xs font-medium text-purple-600 animate-pulse'>{t('activityFeed.loading')}</span> : null}
                </div>

                {error.value
                    ? (
                        <div className='bg-red-50 border border-red-200 rounded-md p-4 mb-4'>
                            <p className='text-sm text-red-700 mb-3' role='alert' data-testid='activity-feed-error'>
                                {t('activityFeed.error.loadFailed')}
                            </p>
                            <button
                                type='button'
                                className='text-sm font-medium text-purple-700 hover:text-purple-800'
                                onClick={handleRetry}
                            >
                                {t('activityFeed.actions.retry')}
                            </button>
                        </div>
                    )
                    : null}

                {!error.value && initialized.value && items.value.length === 0
                    ? (
                        <div className='text-sm text-gray-600' data-testid='activity-feed-empty'>
                            <p className='font-medium text-gray-900 mb-1'>{t('activityFeed.emptyState.title')}</p>
                            <p>{t('activityFeed.emptyState.description')}</p>
                        </div>
                    )
                    : null}

                {items.value.length > 0
                    ? (
                        <ul className='space-y-4'>
                            {items.value.map((item) => {
                                const handleNavigate = getActivityNavigationHandler(item);
                                const description = renderEventDescription(item, userId, t);
                                const groupLabel = item.groupName ?? t('activityFeed.labels.unknownGroup');

                                const content = (
                                    <>
                                        <p className='text-sm text-gray-900'>{description}</p>
                                        {item.details?.commentPreview ? (
                                            <p className='text-sm text-gray-600 mt-1 italic truncate'>{item.details.commentPreview}</p>
                                        ) : null}
                                        <div className='mt-2 flex items-center gap-2 text-xs text-gray-500'>
                                            <span className='font-medium text-gray-700'>{groupLabel}</span>
                                            <span aria-hidden='true'>•</span>
                                            <RelativeTime date={item.timestamp} className='text-gray-500' />
                                        </div>
                                    </>
                                );

                                return (
                                    <li key={item.id} className='flex items-start gap-3' data-testid='activity-feed-item' data-event-type={item.eventType}>
                                        <div className='h-2 w-2 rounded-full mt-2 bg-purple-500 flex-shrink-0' aria-hidden='true' />
                                        <div className='flex-1'>
                                            {handleNavigate ? (
                                                <button
                                                    type='button'
                                                    onClick={handleNavigate}
                                                    className='group flex w-full items-start justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left transition-colors duration-150 hover:border-purple-200 hover:bg-purple-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2'
                                                    aria-label={description}
                                                >
                                                    <div className='flex-1'>
                                                        {content}
                                                    </div>
                                                    <span
                                                        className='flex h-5 w-5 items-center justify-center flex-shrink-0 text-purple-500 font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100'
                                                        aria-hidden='true'
                                                    >
                                                        →
                                                    </span>
                                                </button>
                                            ) : (
                                                content
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )
                    : null}

                {hasMore.value
                    ? (
                        <div className='mt-6'>
                            <button
                                type='button'
                                className='w-full text-sm font-medium text-purple-700 border border-purple-200 rounded-md px-4 py-2 hover:bg-purple-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                                onClick={handleLoadMore}
                                disabled={loadingMore.value}
                            >
                                {loadingMore.value ? t('activityFeed.actions.loadingMore') : t('activityFeed.actions.loadMore')}
                            </button>
                        </div>
                    )
                    : null}
            </div>
        </div>
    );
}

function renderEventDescription(item: ActivityFeedItem, currentUserId: string, t: TFunction<'translation'>) {
    const actor = item.actorId === currentUserId ? t('activityFeed.labels.actorYou') : item.actorName ?? t('activityFeed.labels.unknownUser');
    const group = item.groupName ?? t('activityFeed.labels.unknownGroup');
    const expense = item.details?.expenseDescription ? `"${item.details.expenseDescription}"` : t('activityFeed.labels.unknownExpense');
    const settlement = item.details?.settlementDescription ? `"${item.details.settlementDescription}"` : t('activityFeed.labels.unknownSettlement');
    const targetUserId = item.details?.targetUserId;
    const targetUserName = item.details?.targetUserName ?? t('activityFeed.labels.unknownUser');
    const target = targetUserId && targetUserId === currentUserId
        ? t('activityFeed.labels.actorYou')
        : targetUserId
        ? targetUserName
        : targetUserName;

    switch (item.eventType) {
        case 'expense-created':
            return t('activityFeed.events.expense-created', { actor, expense, group });
        case 'expense-updated':
            return t('activityFeed.events.expense-updated', { actor, expense, group });
        case 'expense-deleted':
            return t('activityFeed.events.expense-deleted', { actor, expense, group });
        case 'member-joined': {
            const joinedKey = targetUserId && targetUserId === item.actorId ? 'activityFeed.events.member-joined-self' : 'activityFeed.events.member-joined';
            return t(joinedKey, { actor, target, group });
        }
        case 'member-left': {
            const leftKey = targetUserId && targetUserId === item.actorId ? 'activityFeed.events.member-left-self' : 'activityFeed.events.member-left';
            return t(leftKey, { actor, target, group });
        }
        case 'comment-added': {
            const commentTarget = item.details?.expenseDescription
                ? t('activityFeed.labels.commentOnExpense', { description: item.details.expenseDescription })
                : t('activityFeed.labels.commentOnGroup');
            return t('activityFeed.events.comment-added', { actor, target: commentTarget, group });
        }
        case 'group-updated': {
            const previousName = item.details?.previousGroupName;
            if (previousName && previousName !== group) {
                return t('activityFeed.events.group-updated-from', { actor, group, previous: previousName });
            }
            return t('activityFeed.events.group-updated', { actor, group });
        }
        case 'settlement-created':
            return t('activityFeed.events.settlement-created', { actor, settlement, group });
        case 'settlement-updated':
            return t('activityFeed.events.settlement-updated', { actor, settlement, group });
        default:
            return t('activityFeed.events.generic', { actor, group });
    }
}

function getActivityNavigationHandler(item: ActivityFeedItem) {
    const { groupId, details, eventType } = item;
    if (!groupId) {
        return undefined;
    }

    const expenseId = details?.expenseId;
    const settlementId = details?.settlementId;

    if (expenseId && (eventType === 'expense-created' || eventType === 'expense-updated')) {
        return () => {
            void navigationService.goToExpenseDetail(groupId, expenseId);
        };
    }

    if (expenseId && eventType === 'comment-added') {
        return () => {
            void navigationService.goToExpenseDetail(groupId, expenseId);
        };
    }

    if (eventType === 'comment-added') {
        return () => {
            void navigationService.navigateTo(`${routes.groupDetail(groupId)}#comments`);
        };
    }

    if (settlementId && (eventType === 'settlement-created' || eventType === 'settlement-updated')) {
        return () => {
            void navigationService.navigateTo(`${routes.groupDetail(groupId)}#settlements`);
        };
    }

    return () => {
        void navigationService.goToGroup(groupId);
    };
}
