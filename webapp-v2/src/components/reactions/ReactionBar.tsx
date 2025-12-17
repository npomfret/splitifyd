import type { ReactionCounts, ReactionEmoji } from '@billsplit-wl/shared';
import { ReactionEmojis } from '@billsplit-wl/shared';
import { useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { ReactionPicker } from './ReactionPicker';

interface ReactionBarProps {
    counts: ReactionCounts | undefined;
    userReactions: ReactionEmoji[] | undefined;
    onToggle: (emoji: ReactionEmoji) => void;
    disabled?: boolean;
    size?: 'sm' | 'md';
}

// Ordered list for consistent display
const EMOJI_ORDER: ReactionEmoji[] = [
    ReactionEmojis.THUMBS_UP,
    ReactionEmojis.HEART,
    ReactionEmojis.LAUGH,
    ReactionEmojis.WOW,
    ReactionEmojis.SAD,
    ReactionEmojis.CELEBRATE,
];

export function ReactionBar({
    counts,
    userReactions = [],
    onToggle,
    disabled = false,
    size = 'md',
}: ReactionBarProps) {
    const { t } = useTranslation();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [togglingEmoji, setTogglingEmoji] = useState<ReactionEmoji | null>(null);
    const addButtonRef = useRef<HTMLButtonElement>(null);

    // Get emojis with counts > 0 in consistent order
    const activeEmojis = EMOJI_ORDER.filter((emoji) => (counts?.[emoji] ?? 0) > 0);

    const handleToggle = async (emoji: ReactionEmoji) => {
        if (disabled || togglingEmoji) return;

        setTogglingEmoji(emoji);
        setIsPickerOpen(false);

        try {
            await onToggle(emoji);
        } finally {
            setTogglingEmoji(null);
        }
    };

    const handlePickerSelect = (emoji: ReactionEmoji) => {
        handleToggle(emoji);
    };

    // Size-based classes
    const sizeClasses = size === 'sm'
        ? 'text-xs px-1.5 py-0.5 gap-0.5'
        : 'text-sm px-2 py-0.5 gap-1';

    const addButtonSizeClasses = size === 'sm'
        ? 'text-xs px-1.5 py-0.5'
        : 'text-sm px-2 py-0.5';

    return (
        <div className='flex flex-wrap items-center gap-1' role='group' aria-label={t('reactions.reactionBarLabel')}>
            {activeEmojis.map((emoji) => {
                const count = counts?.[emoji] ?? 0;
                const isUserReaction = userReactions.includes(emoji);
                const isToggling = togglingEmoji === emoji;

                return (
                    <button
                        key={emoji}
                        type='button'
                        onClick={() => handleToggle(emoji)}
                        disabled={disabled || !!togglingEmoji}
                        aria-label={isUserReaction ? t('reactions.removeReaction') : t('reactions.addReaction')}
                        aria-pressed={isUserReaction}
                        className={`inline-flex items-center rounded-full transition-colors ${sizeClasses} ${
                            isUserReaction
                                ? 'bg-interactive-primary/20 text-interactive-primary hover:bg-interactive-primary/30'
                                : 'bg-surface-muted text-text-primary hover:bg-surface-raised'
                        } ${
                            disabled || isToggling
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                        } focus:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary`}
                    >
                        <span className={isToggling ? 'animate-pulse' : ''}>{emoji}</span>
                        <span>{count}</span>
                    </button>
                );
            })}

            {/* Add reaction button */}
            <button
                ref={addButtonRef}
                type='button'
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                disabled={disabled || !!togglingEmoji}
                aria-label={t('reactions.addReaction')}
                aria-expanded={isPickerOpen}
                aria-haspopup='listbox'
                className={`inline-flex items-center justify-center rounded-full bg-surface-muted text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary ${addButtonSizeClasses} ${
                    disabled || togglingEmoji
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer'
                } focus:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary`}
            >
                <span aria-hidden='true'>+</span>
            </button>

            <ReactionPicker
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={handlePickerSelect}
                selectedEmojis={userReactions}
                triggerRef={addButtonRef}
                disabled={disabled || !!togglingEmoji}
            />
        </div>
    );
}
