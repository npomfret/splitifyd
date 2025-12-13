import { useStaggeredReveal } from '@/app/hooks/useScrollReveal';
import { activityFeedStore } from '@/app/stores/activity-feed-store.ts';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronRightIcon, ClockIcon } from '@/components/ui/icons';
import { RelativeTime } from '@/components/ui/RelativeTime.tsx';
import { SkeletonActivityItem } from '@/components/ui/Skeleton';
import { Stack } from '@/components/ui/Stack';
import { Typography } from '@/components/ui/Typography';
import { routes } from '@/constants/routes.ts';
import { navigationService } from '@/services/navigation.service.ts';
import { logError } from '@/utils/browser-logger.ts';
import type { ActivityFeedItem, UserId } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
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

    // Staggered reveal animation for activity items
    const { ref: listRef, visibleIndices } = useStaggeredReveal(items.value.length, 60);

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
        <section className='glass-panel border-border-default rounded-lg shadow-lg border border-border-default' aria-labelledby='activity-feed-heading'>
            <div className='p-6'>
                <div className='flex items-center justify-between mb-4'>
                    <Typography variant='subheading' id='activity-feed-heading'>{t('activityFeed.title')}</Typography>
                </div>

                {/* Loading skeleton */}
                {loading.value && !initialized.value
                    ? (
                        <Stack spacing='md' aria-busy='true' aria-label={t('activityFeed.loading')}>
                            <SkeletonActivityItem />
                            <SkeletonActivityItem />
                            <SkeletonActivityItem />
                        </Stack>
                    )
                    : null}

                {error.value
                    ? (
                        <div className='bg-surface-error border border-border-error rounded-md p-4 mb-4'>
                            <p className='text-sm text-semantic-error mb-3' role='alert'>
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
                            icon={<ClockIcon size={48} />}
                            title={t('activityFeed.emptyState.title')}
                            description={t('activityFeed.emptyState.description')}
                            dataTestId='activity-feed-empty'
                        />
                    )
                    : null}

                {items.value.length > 0
                    ? (
                        <ul className='flex flex-col' style={{ gap: 'var(--space-md, 0.75rem)' }} ref={listRef}>
                            {items.value.map((item, index) => {
                                const handleNavigate = getActivityNavigationHandler(item);
                                const description = renderEventDescription(item, userId, t);
                                const groupLabel = item.groupName ?? t('activityFeed.labels.unknownGroup');

                                const content = (
                                    <>
                                        <p className='text-sm font-medium text-text-primary leading-snug'>{description}</p>
                                        {item.details?.commentPreview ? <p className='help-text-xs mt-1.5 italic line-clamp-2'>{item.details.commentPreview}</p> : null}
                                        <div className='mt-2 flex items-center gap-2 text-xs'>
                                            <span className='font-semibold text-text-primary/80'>{groupLabel}</span>
                                            <span className='text-text-muted/50' aria-hidden='true'>•</span>
                                            <RelativeTime date={item.timestamp} className='text-text-muted/70' />
                                        </div>
                                    </>
                                );

                                return (
                                    <li
                                        key={item.id}
                                        className={`relative fade-up ${visibleIndices.has(index) ? 'fade-up-visible' : ''}`}
                                        data-event-type={item.eventType}
                                    >
                                        {handleNavigate
                                            ? (
                                                <button
                                                    type='button'
                                                    onClick={handleNavigate}
                                                    className='group flex w-full items-start gap-3 rounded-lg border border-border-default/50 bg-surface-base/30 backdrop-blur-xs px-4 py-3 text-start transition-all duration-200 hover:border-interactive-primary/40 hover:bg-surface-base/50 hover:shadow-md hover:-translate-y-0.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:ring-offset-2'
                                                    aria-label={description}
                                                >
                                                    <div className='h-2.5 w-2.5 rounded-full mt-1.5 bg-interactive-primary shrink-0 shadow-sm shadow-interactive-primary/50' aria-hidden='true' />
                                                    <div className='flex-1 min-w-0'>
                                                        {content}
                                                    </div>
                                                    <ChevronRightIcon
                                                        size={16}
                                                        className='shrink-0 mt-1 text-interactive-primary opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5'
                                                    />
                                                </button>
                                            )
                                            : (
                                                <div className='flex items-start gap-3 rounded-lg border border-border-default/50 bg-surface-base/30 backdrop-blur-xs px-4 py-3'>
                                                    <div className='h-2.5 w-2.5 rounded-full mt-1.5 bg-interactive-primary shrink-0 shadow-sm shadow-interactive-primary/50' aria-hidden='true' />
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
                        <div className='mt-6'>
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
        </section>
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
        case 'group-created':
            return t('activityFeed.events.group-created', { actor, group });
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
