import { activityFeedStore } from '@/app/stores/activity-feed-store';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronRightIcon, ClockIcon } from '@/components/ui/icons';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { SkeletonActivityItem, SkeletonList } from '@/components/ui/Skeleton';
import { routes } from '@/constants/routes';
import { navigationService } from '@/services/navigation.service';
import { logError } from '@/utils/browser-logger';
import type { ActivityFeedItem, UserId } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
import type { TFunction } from 'i18next';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface ActivityFeedDropdownContentProps {
    userId: UserId;
    onItemClick: () => void;
}

export function ActivityFeedDropdownContent({ userId, onItemClick }: ActivityFeedDropdownContentProps) {
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

        const componentId = 'notifications-dropdown';
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

    const handleNavigate = (item: ActivityFeedItem) => {
        const handler = getActivityNavigationHandler(item);
        if (handler) {
            handler();
            onItemClick();
        }
    };

    return (
        <div className='p-4'>
            {/* Loading skeleton */}
            {loading.value && !initialized.value
                ? <SkeletonList ariaLabel={t('activityFeed.loading')}>{SkeletonActivityItem}</SkeletonList>
                : null}

            {error.value
                ? (
                    <div className='bg-surface-error border border-border-error rounded-md p-3'>
                        <p className='text-sm text-semantic-error mb-2' role='alert'>
                            {t('activityFeed.error.loadFailed')}
                        </p>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={handleRetry}
                        >
                            {t('activityFeed.actions.retry')}
                        </Button>
                    </div>
                )
                : null}

            {!error.value && initialized.value && items.value.length === 0
                ? (
                    <EmptyState
                        icon={<ClockIcon size={40} />}
                        title={t('activityFeed.emptyState.title')}
                        description={t('activityFeed.emptyState.description')}
                        dataTestId='notifications-empty'
                    />
                )
                : null}

            {items.value.length > 0
                ? (
                    <ul className='flex flex-col gap-2'>
                        {items.value.map((item) => {
                            const description = renderEventDescription(item, userId, t);
                            const groupLabel = item.groupName ?? t('activityFeed.labels.unknownGroup');
                            const hasNavigation = !!getActivityNavigationHandler(item);

                            const content = (
                                <>
                                    <p className='text-sm font-medium text-text-primary leading-snug'>{description}</p>
                                    {item.details?.commentPreview ? <p className='help-text-xs mt-1 italic line-clamp-2'>{item.details.commentPreview}</p> : null}
                                    <div className='mt-1.5 flex items-center gap-2 text-xs'>
                                        <span className='font-semibold text-text-primary/80'>{groupLabel}</span>
                                        <span className='text-text-muted/50' aria-hidden='true'>•</span>
                                        <RelativeTime date={item.timestamp} className='text-text-muted/70' />
                                    </div>
                                </>
                            );

                            return (
                                <li key={item.id} data-event-type={item.eventType}>
                                    {hasNavigation
                                        ? (
                                            <button
                                                type='button'
                                                onClick={() => handleNavigate(item)}
                                                className='group flex w-full items-start gap-2.5 rounded-lg border border-border-default/50 bg-surface-raised px-3 py-2.5 text-start transition-all duration-200 hover:border-interactive-primary/40 hover:bg-surface-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary'
                                                aria-label={description}
                                            >
                                                <div className='h-2 w-2 rounded-full mt-1.5 bg-interactive-primary shrink-0' aria-hidden='true' />
                                                <div className='flex-1 min-w-0'>
                                                    {content}
                                                </div>
                                                <ChevronRightIcon
                                                    size={14}
                                                    className='shrink-0 mt-1 text-interactive-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100'
                                                />
                                            </button>
                                        )
                                        : (
                                            <div className='flex items-start gap-2.5 rounded-lg border border-border-default/50 bg-surface-raised px-3 py-2.5'>
                                                <div className='h-2 w-2 rounded-full mt-1.5 bg-interactive-primary shrink-0' aria-hidden='true' />
                                                <div className='flex-1 min-w-0'>
                                                    {content}
                                                </div>
                                            </div>
                                        )}
                                </li>
                            );
                        })}
                    </ul>
                )
                : null}

            {hasMore.value
                ? (
                    <div className='mt-3'>
                        <Button
                            variant='secondary'
                            size='sm'
                            fullWidth
                            onClick={handleLoadMore}
                            loading={loadingMore.value}
                        >
                            {t('activityFeed.actions.loadMore')}
                        </Button>
                    </div>
                )
                : null}
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
            const isSelf = targetUserId && targetUserId === item.actorId;
            return isSelf
                ? t('activityFeed.events.member-joined-self', { actor, target, group })
                : t('activityFeed.events.member-joined', { actor, target, group });
        }
        case 'member-left': {
            const isSelf = targetUserId && targetUserId === item.actorId;
            return isSelf
                ? t('activityFeed.events.member-left-self', { actor, target, group })
                : t('activityFeed.events.member-left', { actor, target, group });
        }
        case 'comment-added': {
            const commentTarget = item.details?.expenseDescription
                ? t('activityFeed.labels.commentOnExpense', { description: item.details.expenseDescription })
                : t('activityFeed.labels.commentOnGroup');
            return t('activityFeed.events.comment-added', { actor, target: commentTarget, group });
        }
        case 'group-created':
            return t('activityFeed.events.group-created', { actor, group });
        case 'group-updated': {
            const previousName = item.details?.previousGroupName;
            if (previousName && previousName !== group) {
                return t('activityFeed.events.group-updated-from', { actor, group, previous: previousName });
            }
            return t('activityFeed.events.group-updated', { actor, group });
        }
        case 'group-locked':
            return t('activityFeed.events.group-locked', { actor, group });
        case 'group-unlocked':
            return t('activityFeed.events.group-unlocked', { actor, group });
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
