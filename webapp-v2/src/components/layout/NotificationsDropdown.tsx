import { useClickOutside } from '@/app/hooks/useClickOutside';
import { notificationsStore } from '@/app/stores/notifications-store';
import { BellIcon } from '@/components/ui/icons';
import { Typography } from '@/components/ui/Typography';
import type { UserId } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { ActivityFeedDropdownContent } from './ActivityFeedDropdownContent';

interface NotificationsDropdownProps {
    userId: UserId;
}

export function NotificationsDropdown({ userId }: NotificationsDropdownProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const hasUnread = useComputed(() => notificationsStore.hasUnreadSignal.value);

    // Initialize notifications store with user
    useEffect(() => {
        notificationsStore.initialize(userId);
    }, [userId]);

    useClickOutside(dropdownRef, () => setIsOpen(false), { enabled: isOpen });

    // Mark as seen when dropdown opens
    useEffect(() => {
        if (isOpen) {
            notificationsStore.markAsSeen();
        }
    }, [isOpen]);

    return (
        <div className='relative z-50' ref={dropdownRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className='relative flex items-center justify-center w-10 h-10 rounded-lg bg-surface-base border border-border-default/60 hover:border-interactive-primary/50 hover:bg-surface-raised transition-all duration-200 shadow-md'
                aria-label={t('notifications.openNotifications')}
                aria-expanded={isOpen}
                aria-haspopup='dialog'
                aria-controls='notifications-dropdown-menu'
            >
                <BellIcon size={20} className='text-text-primary' />
                {hasUnread.value && (
                    <span
                        className='absolute top-1.5 end-1.5 w-2.5 h-2.5 bg-semantic-error rounded-full border-2 border-surface-base'
                        aria-hidden='true'
                    />
                )}
            </button>

            {isOpen && (
                <div
                    id='notifications-dropdown-menu'
                    className='fixed inset-x-4 top-[4.5rem] sm:absolute sm:inset-x-auto sm:top-auto sm:end-0 sm:mt-2 sm:w-96 max-h-[70vh] overflow-y-auto bg-surface-popover border border-border-default rounded-xl shadow-2xl z-9999'
                    role='dialog'
                    aria-label={t('notifications.title')}
                >
                    <div className='px-4 py-3 border-b border-border-default'>
                        <Typography variant='subheading'>{t('notifications.title')}</Typography>
                    </div>
                    <ActivityFeedDropdownContent
                        userId={userId}
                        onItemClick={() => setIsOpen(false)}
                    />
                </div>
            )}
        </div>
    );
}
