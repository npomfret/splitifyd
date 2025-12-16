import { groupActivityFeedStore } from '@/app/stores/group-activity-feed-store';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { routes } from '@/constants/routes';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import type { ActivityFeedItem, GroupId, UserId } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
import type { TFunction } from 'i18next';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface GroupActivityFeedProps {
    groupId: GroupId;
    currentUserId: UserId;
}

export function GroupActivityFeed({ groupId, currentUserId }: GroupActivityFeedProps) {
    const { t } = useTranslation();
    const items = useComputed(() => groupActivityFeedStore.itemsSignal.value);
    const loading = useComputed(() => groupActivityFeedStore.loadingSignal.value);
    const error = useComputed(() => groupActivityFeedStore.errorSignal.value);
    const hasMore = useComputed(() => groupActivityFeedStore.hasMoreSignal.value);
    const loadingMore = useComputed(() => groupActivityFeedStore.loadingMoreSignal.value);

    useEffect(() => {
        void groupActivityFeedStore.load(groupId).catch((loadError) => {
            logError('Failed to load group activity feed', loadError);
        });

        return () => {
            groupActivityFeedStore.reset();
        };
    }, [groupId]);

    const handleRetry = () => {
        void groupActivityFeedStore.load(groupId).catch((loadError) => {
            logError('Failed to retry group activity feed', loadError);
        });
    };

    const handleLoadMore = () => {
        void groupActivityFeedStore.loadMore().catch((loadError) => {
            logError('Failed to load more group activity', loadError);
        });
    };

    if (loading.value && items.value.length === 0) {
        return (
            <div className='py-4 text-center'>
                <span className='help-text animate-pulse'>{t('activityFeed.loading')}</span>
            </div>
        );
    }

    if (error.value) {
        return (
            <div className='py-4'>
                <p className='text-sm text-semantic-error mb-2' role='alert'>
                    {t('activityFeed.error.loadFailed')}
                </p>
                <button
                    type='button'
                    className='text-sm font-medium text-interactive-primary hover:underline'
                    onClick={handleRetry}
                >
                    {t('activityFeed.actions.retry')}
                </button>
            </div>
        );
    }

    if (items.value.length === 0) {
        return (
            <div className='py-4 help-text'>
                <p className='font-medium text-text-primary mb-1'>{t('activityFeed.emptyState.title')}</p>
                <p>{t('activityFeed.emptyState.groupDescription')}</p>
            </div>
        );
    }

    return (
        <nav aria-label={t('activityFeed.title')}>
            <ul className='flex flex-col' style={{ gap: 'var(--space-md, 0.75rem)' }}>
                {items.value.map((item) => {
                    const handleNavigate = getActivityNavigationHandler(item, groupId);
                    const description = renderEventDescription(item, currentUserId, t);

                    const content = (
                        <>
                            <p className='text-sm text-text-primary leading-snug'>{description}</p>
                            {item.details?.commentPreview
                                ? <p className='help-text-xs mt-1 italic line-clamp-2'>{item.details.commentPreview}</p>
                                : null}
                            <RelativeTime date={item.timestamp} className='help-text-xs/70 mt-1 block' />
                        </>
                    );

                    return (
                        <li key={item.id} data-event-type={item.eventType}>
                            {handleNavigate
                                ? (
                                    <button
                                        type='button'
                                        onClick={handleNavigate}
                                        className='group flex w-full items-start gap-2 rounded-md px-2 py-2 text-start transition-colors hover:bg-surface-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary'
                                        aria-label={description}
                                    >
                                        <div className='h-2 w-2 rounded-full mt-1.5 bg-interactive-primary shrink-0' aria-hidden='true' />
                                        <div className='flex-1 min-w-0'>{content}</div>
                                    </button>
                                )
                                : (
                                    <div className='flex items-start gap-2 px-2 py-2'>
                                        <div className='h-2 w-2 rounded-full mt-1.5 bg-interactive-primary shrink-0' aria-hidden='true' />
                                        <div className='flex-1 min-w-0'>{content}</div>
                                    </div>
                                )}
                        </li>
                    );
                })}
            </ul>

            {hasMore.value
                ? (
                    <div className='mt-4'>
                        <button
                            type='button'
                            className='w-full text-sm font-medium text-interactive-primary border border-interactive-primary/20 rounded-md px-3 py-1.5 hover:bg-interactive-primary/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                            onClick={handleLoadMore}
                            disabled={loadingMore.value}
                        >
                            {loadingMore.value ? t('activityFeed.actions.loadingMore') : t('activityFeed.actions.loadMore')}
                        </button>
                    </div>
                )
                : null}
        </nav>
    );
}

function renderEventDescription(item: ActivityFeedItem, currentUserId: string, t: TFunction<'translation'>) {
    const actor = item.actorId === currentUserId ? t('activityFeed.labels.actorYou') : item.actorName ?? t('activityFeed.labels.unknownUser');
    const expense = item.details?.expenseDescription ? `"${item.details.expenseDescription}"` : t('activityFeed.labels.unknownExpense');
    const settlement = item.details?.settlementDescription ? `"${item.details.settlementDescription}"` : t('activityFeed.labels.unknownSettlement');
    const targetUserId = item.details?.targetUserId;
    const targetUserName = item.details?.targetUserName ?? t('activityFeed.labels.unknownUser');
    const target = targetUserId && targetUserId === currentUserId
        ? t('activityFeed.labels.actorYou')
        : targetUserName;

    switch (item.eventType) {
        case 'expense-created':
            return t('activityFeed.events.expense-created-short', { actor, expense });
        case 'expense-updated':
            return t('activityFeed.events.expense-updated-short', { actor, expense });
        case 'expense-deleted':
            return t('activityFeed.events.expense-deleted-short', { actor, expense });
        case 'member-joined': {
            const isSelf = targetUserId && targetUserId === item.actorId;
            return isSelf
                ? t('activityFeed.events.member-joined-self-short', { actor, target })
                : t('activityFeed.events.member-joined-short', { actor, target });
        }
        case 'member-left': {
            const isSelf = targetUserId && targetUserId === item.actorId;
            return isSelf
                ? t('activityFeed.events.member-left-self-short', { actor, target })
                : t('activityFeed.events.member-left-short', { actor, target });
        }
        case 'comment-added': {
            const commentTarget = item.details?.expenseDescription
                ? t('activityFeed.labels.commentOnExpense', { description: item.details.expenseDescription })
                : t('activityFeed.labels.commentOnGroup');
            return t('activityFeed.events.comment-added-short', { actor, target: commentTarget });
        }
        case 'group-created':
            return t('activityFeed.events.group-created-short', { actor });
        case 'group-updated': {
            const previousName = item.details?.previousGroupName;
            if (previousName && previousName !== item.groupName) {
                return t('activityFeed.events.group-updated-from-short', { actor, previous: previousName });
            }
            return t('activityFeed.events.group-updated-short', { actor });
        }
        case 'group-locked':
            return t('activityFeed.events.group-locked-short', { actor });
        case 'group-unlocked':
            return t('activityFeed.events.group-unlocked-short', { actor });
        case 'settlement-created':
            return t('activityFeed.events.settlement-created-short', { actor, settlement });
        case 'settlement-updated':
            return t('activityFeed.events.settlement-updated-short', { actor, settlement });
        default:
            return t('activityFeed.events.generic-short', { actor });
    }
}

function getActivityNavigationHandler(item: ActivityFeedItem, currentGroupId: GroupId) {
    const { details, eventType } = item;
    const expenseId = details?.expenseId;

    if (expenseId && (eventType === 'expense-created' || eventType === 'expense-updated' || eventType === 'comment-added')) {
        return () => {
            void navigationService.goToExpenseDetail(currentGroupId, expenseId);
        };
    }

    if (eventType === 'comment-added') {
        return () => {
            void navigationService.navigateTo(`${routes.groupDetail(currentGroupId)}#comments`);
        };
    }

    if (eventType === 'settlement-created' || eventType === 'settlement-updated') {
        return () => {
            void navigationService.navigateTo(`${routes.groupDetail(currentGroupId)}#settlements`);
        };
    }

    // No navigation for other events - we're already on the group page
    return undefined;
}
