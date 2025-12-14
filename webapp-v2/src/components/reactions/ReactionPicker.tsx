import type { ReactionEmoji } from '@billsplit-wl/shared';
import { ReactionEmojis } from '@billsplit-wl/shared';
import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import type { RefObject } from 'preact';

interface ReactionPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (emoji: ReactionEmoji) => void;
    selectedEmojis: ReactionEmoji[];
    triggerRef: RefObject<HTMLElement>;
    disabled?: boolean;
}

interface PickerPosition {
    top: number;
    left: number;
    placement: 'top' | 'bottom';
}

const PICKER_OFFSET = 8;

// Ordered list of emojis for display
const EMOJI_LIST: ReactionEmoji[] = [
    ReactionEmojis.THUMBS_UP,
    ReactionEmojis.HEART,
    ReactionEmojis.LAUGH,
    ReactionEmojis.WOW,
    ReactionEmojis.SAD,
    ReactionEmojis.CELEBRATE,
];

// Translation keys for each emoji
const EMOJI_LABELS: Record<ReactionEmoji, string> = {
    [ReactionEmojis.THUMBS_UP]: 'reactions.thumbsUp',
    [ReactionEmojis.HEART]: 'reactions.heart',
    [ReactionEmojis.LAUGH]: 'reactions.laugh',
    [ReactionEmojis.WOW]: 'reactions.wow',
    [ReactionEmojis.SAD]: 'reactions.sad',
    [ReactionEmojis.CELEBRATE]: 'reactions.celebrate',
};

export function ReactionPicker({
    isOpen,
    onClose,
    onSelect,
    selectedEmojis,
    triggerRef,
    disabled = false,
}: ReactionPickerProps) {
    const { t } = useTranslation();
    const [position, setPosition] = useState<PickerPosition | null>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const calculatePosition = useCallback(() => {
        if (!triggerRef.current || !pickerRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const pickerRect = pickerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Calculate horizontal position (centered on trigger, clamped to viewport)
        let left = triggerRect.left + triggerRect.width / 2 - pickerRect.width / 2;
        const horizontalPadding = 8;
        left = Math.max(horizontalPadding, Math.min(left, viewportWidth - pickerRect.width - horizontalPadding));

        // Prefer showing below, flip to top if no room
        let placement: 'top' | 'bottom' = 'bottom';
        let top = triggerRect.bottom + PICKER_OFFSET;

        if (top + pickerRect.height > viewportHeight) {
            placement = 'top';
            top = triggerRect.top - pickerRect.height - PICKER_OFFSET;
        }

        setPosition({ top, left, placement });
    }, [triggerRef]);

    // Position on open and handle scroll/resize
    useLayoutEffect(() => {
        if (!isOpen) {
            setPosition(null);
            return;
        }

        calculatePosition();

        window.addEventListener('scroll', calculatePosition, true);
        window.addEventListener('resize', calculatePosition);

        return () => {
            window.removeEventListener('scroll', calculatePosition, true);
            window.removeEventListener('resize', calculatePosition);
        };
    }, [isOpen, calculatePosition]);

    // Focus first emoji when opened
    useEffect(() => {
        if (isOpen) {
            setFocusedIndex(0);
            // Focus the picker container after a brief delay to allow portal render
            setTimeout(() => {
                const firstButton = pickerRef.current?.querySelector('button');
                firstButton?.focus();
            }, 0);
        }
    }, [isOpen]);

    // Click outside detection
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                pickerRef.current &&
                !pickerRef.current.contains(target) &&
                triggerRef.current &&
                !triggerRef.current.contains(target)
            ) {
                onClose();
            }
        };

        // Use capture phase to catch clicks before they're consumed
        document.addEventListener('click', handleClickOutside, true);
        return () => document.removeEventListener('click', handleClickOutside, true);
    }, [isOpen, onClose, triggerRef]);

    // Keyboard navigation
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                onClose();
                triggerRef.current?.focus();
                break;
            case 'ArrowRight':
                event.preventDefault();
                setFocusedIndex((i) => (i + 1) % EMOJI_LIST.length);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                setFocusedIndex((i) => (i - 1 + EMOJI_LIST.length) % EMOJI_LIST.length);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                onSelect(EMOJI_LIST[focusedIndex]);
                break;
            case 'Tab':
                // Allow Tab to close the picker naturally
                onClose();
                break;
        }
    }, [focusedIndex, onClose, onSelect, triggerRef]);

    // Focus management for buttons
    useEffect(() => {
        if (!isOpen || !pickerRef.current) return;
        const buttons = pickerRef.current.querySelectorAll('button');
        buttons[focusedIndex]?.focus();
    }, [focusedIndex, isOpen]);

    if (!isOpen || typeof document === 'undefined') {
        return null;
    }

    const handleEmojiClick = (emoji: ReactionEmoji) => {
        if (!disabled) {
            onSelect(emoji);
        }
    };

    const pickerElement = (
        <div
            ref={pickerRef}
            role="listbox"
            aria-label={t('reactions.addReaction')}
            className={`fixed z-50 rounded-lg border border-border-default bg-surface-popover p-1 shadow-lg backdrop-blur-sm transition-opacity duration-150 ${
                position ? 'opacity-100' : 'opacity-0'
            }`}
            style={position ? { top: `${position.top}px`, left: `${position.left}px` } : { top: '-9999px', left: '-9999px' }}
            onKeyDown={handleKeyDown}
        >
            <div className="flex gap-0.5">
                {EMOJI_LIST.map((emoji, index) => {
                    const isSelected = selectedEmojis.includes(emoji);
                    return (
                        <button
                            key={emoji}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            aria-label={t(EMOJI_LABELS[emoji])}
                            disabled={disabled}
                            tabIndex={index === focusedIndex ? 0 : -1}
                            onClick={() => handleEmojiClick(emoji)}
                            className={`rounded p-2 text-xl transition-colors hover:bg-interactive-primary/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary ${
                                isSelected ? 'bg-interactive-primary/20 ring-1 ring-interactive-primary' : ''
                            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                            {emoji}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return createPortal(pickerElement, document.body);
}
