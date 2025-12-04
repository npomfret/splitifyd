import { apiClient } from '@/app/apiClient.ts';
import { Button, LoadingSpinner, Tooltip } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { Modal } from '@/components/ui/Modal';
import { logError } from '@/utils/browser-logger.ts';
import { formatDateTimeInUserTimeZone } from '@/utils/dateUtils.ts';
import { GroupId } from '@billsplit-wl/shared';
import { toISOString } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { QRCodeCanvas } from 'qrcode.react';
import { useTranslation } from 'react-i18next';

interface ShareGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: GroupId;
    groupName: string;
}

const SHARE_LINK_EXPIRATION_OPTIONS = [
    { id: '15m', durationMs: 15 * 60 * 1000, translationKey: 'shareGroupModal.expirationOptions.15m' },
    { id: '1h', durationMs: 60 * 60 * 1000, translationKey: 'shareGroupModal.expirationOptions.1h' },
    { id: '1d', durationMs: 24 * 60 * 60 * 1000, translationKey: 'shareGroupModal.expirationOptions.1d' },
    { id: '5d', durationMs: 5 * 24 * 60 * 60 * 1000, translationKey: 'shareGroupModal.expirationOptions.5d' },
] as const;

type ShareLinkExpirationOption = typeof SHARE_LINK_EXPIRATION_OPTIONS[number];
type ShareLinkExpirationOptionId = ShareLinkExpirationOption['id'];

const DEFAULT_EXPIRATION_OPTION_ID: ShareLinkExpirationOptionId = '1d';

const getExpirationOption = (id: ShareLinkExpirationOptionId): ShareLinkExpirationOption => {
    return SHARE_LINK_EXPIRATION_OPTIONS.find((option) => option.id === id)
        ?? SHARE_LINK_EXPIRATION_OPTIONS.find((option) => option.id === DEFAULT_EXPIRATION_OPTION_ID)!;
};

export function ShareGroupModal({ isOpen, onClose, groupId, groupName }: ShareGroupModalProps) {
    const { t } = useTranslation();

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [shareLinkSignal] = useState(() => signal<string>(''));
    const [loadingSignal] = useState(() => signal(false));
    const [errorSignal] = useState(() => signal<string | null>(null));
    const [copiedSignal] = useState(() => signal(false));
    const [showToastSignal] = useState(() => signal(false));
    const [selectedExpirationIdSignal] = useState(() => signal<ShareLinkExpirationOptionId>(DEFAULT_EXPIRATION_OPTION_ID));
    const [expiresAtSignal] = useState(() => signal<string | null>(null));
    const [refreshCounterSignal] = useState(() => signal(0));

    // Extract signal values for use in render
    const shareLink = shareLinkSignal.value;
    const loading = loadingSignal.value;
    const error = errorSignal.value;
    const copied = copiedSignal.value;
    const showToast = showToastSignal.value;
    const selectedExpirationId = selectedExpirationIdSignal.value;
    const expiresAt = expiresAtSignal.value;
    const refreshCounter = refreshCounterSignal.value;

    const linkInputRef = useRef<HTMLInputElement>(null);
    const copiedTimerRef = useRef<number | null>(null);
    const toastTimerRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);
    const expirationContainerClass = shareLink ? 'space-y-2 border-t border-border-default pt-4' : 'space-y-2 pt-4';
    const normalizedGroupName = groupName.trim();

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) {
                clearTimeout(copiedTimerRef.current);
            }
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen || !groupId) {
            return;
        }

        if (copiedTimerRef.current) {
            clearTimeout(copiedTimerRef.current);
            copiedTimerRef.current = null;
        }
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }

        shareLinkSignal.value = '';
        expiresAtSignal.value = null;
        errorSignal.value = null;
        copiedSignal.value = false;
        showToastSignal.value = false;
        selectedExpirationIdSignal.value = DEFAULT_EXPIRATION_OPTION_ID;
    }, [isOpen, groupId]);

    useEffect(() => {
        if (!isOpen || !groupId) {
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        loadingSignal.value = true;
        errorSignal.value = null;
        shareLinkSignal.value = '';
        expiresAtSignal.value = null;
        copiedSignal.value = false;
        showToastSignal.value = false;

        const { durationMs } = getExpirationOption(selectedExpirationId);
        const requestedExpiresAt = toISOString(new Date(Date.now() + durationMs).toISOString());
        const errorMessage = t('shareGroupModal.errors.generateLinkFailed');

        (async () => {
            try {
                const response = await apiClient.generateShareableLink(groupId, requestedExpiresAt);
                if (requestIdRef.current !== requestId) {
                    return;
                }

                const fullUrl = `${window.location.origin}${response.shareablePath}`;
                shareLinkSignal.value = fullUrl;
                expiresAtSignal.value = response.expiresAt;
            } catch (err) {
                if (requestIdRef.current !== requestId) {
                    return;
                }

                logError('Failed to generate share link', err);
                errorSignal.value = errorMessage;
            } finally {
                if (requestIdRef.current === requestId) {
                    loadingSignal.value = false;
                }
            }
        })();
    }, [isOpen, groupId, selectedExpirationId, refreshCounter, t]);

    const copyToClipboard = async () => {
        if (!shareLink) return;

        // Clear any existing timers
        if (copiedTimerRef.current) {
            clearTimeout(copiedTimerRef.current);
        }
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }

        try {
            await navigator.clipboard.writeText(shareLink);
            copiedSignal.value = true;
            showToastSignal.value = true;

            copiedTimerRef.current = window.setTimeout(() => {
                copiedSignal.value = false;
                copiedTimerRef.current = null;
            }, 2000);

            toastTimerRef.current = window.setTimeout(() => {
                showToastSignal.value = false;
                toastTimerRef.current = null;
            }, 3000);
        } catch (err) {
            if (linkInputRef.current) {
                linkInputRef.current.select();
                document.execCommand('copy');
                copiedSignal.value = true;
                showToastSignal.value = true;

                copiedTimerRef.current = window.setTimeout(() => {
                    copiedSignal.value = false;
                    copiedTimerRef.current = null;
                }, 2000);

                toastTimerRef.current = window.setTimeout(() => {
                    showToastSignal.value = false;
                    toastTimerRef.current = null;
                }, 3000);
            }
        }
    };

    return (
        <>
            <Modal
                open={isOpen}
                onClose={onClose}
                size='sm'
                labelledBy='share-modal-title'
            >
                {/* Modal Header */}
                <div class='px-6 py-4 border-b border-border-default'>
                    <div class='flex items-center justify-between'>
                        <div class='flex flex-col space-y-1'>
                            <div class='flex items-center space-x-2'>
                                <svg class='w-5 h-5 text-interactive-primary' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                    <path
                                        stroke-linecap='round'
                                        stroke-linejoin='round'
                                        stroke-width='2'
                                        d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
                                    />
                                </svg>
                                <h3 id='share-modal-title' class='text-lg font-semibold text-text-primary'>
                                    {t('shareGroupModal.title')}
                                </h3>
                            </div>
                            {normalizedGroupName && (
                                <p class='text-sm text-text-primary/70' data-testid='share-group-name'>
                                    {normalizedGroupName}
                                </p>
                            )}
                        </div>
                        <Tooltip content={t('shareGroupModal.closeButtonAriaLabel')}>
                            <Clickable
                                as='button'
                                type='button'
                                onClick={onClose}
                                className='text-text-muted/80 hover:text-text-muted transition-colors rounded-full p-1 hover:bg-surface-muted'
                                data-testid='close-share-modal-button'
                                aria-label={t('shareGroupModal.closeButtonAriaLabel')}
                                eventName='modal_close'
                                eventProps={{ modalName: 'share_group', method: 'x_button' }}
                            >
                                <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                                </svg>
                            </Clickable>
                        </Tooltip>
                    </div>
                </div>

                {/* Modal Content */}
                <div class='max-h-[70vh] overflow-y-auto px-6 py-5'>
                        <p class='text-sm text-text-primary/70 mb-3'>{t('shareGroupModal.description')}</p>

                        {loading && (
                            <div class='flex justify-center py-8'>
                                <LoadingSpinner size='lg' />
                            </div>
                        )}

                        {error && (
                            <div class='bg-surface-error border border-border-error rounded-md p-3 mb-4'>
                                <p class='text-sm text-semantic-error' role='alert' data-testid='share-group-error-message'>
                                    {error}
                                </p>
                            </div>
                        )}

                        <div class='space-y-4'>
                            {shareLink && !loading && (
                                <>
                                    {/* Share link input with inline copy button */}
                                    <div class='relative'>
                                        <input
                                            ref={linkInputRef}
                                            type='text'
                                            value={shareLink}
                                            readOnly={true}
                                            class='w-full pl-3 pr-12 py-3 border border-border-default rounded-lg bg-surface-raised backdrop-blur-sm text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:border-transparent'
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                            data-testid='share-link-input'
                                            autoComplete='off'
                                        />
                                        <Tooltip content={copied ? t('shareGroupModal.linkCopied') : t('shareGroupModal.copyLinkTitle')}>
                                            <Button
                                                type='button'
                                                onClick={copyToClipboard}
                                                variant='ghost'
                                                size='sm'
                                                data-testid='copy-link-button'
                                                ariaLabel={t('shareGroupModal.copyLinkAriaLabel')}
                                                className='absolute right-2 top-1/2 -translate-y-1/2'
                                            >
                                                {copied
                                                    ? (
                                                        <svg class='w-5 h-5 text-semantic-success' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
                                                        </svg>
                                                    )
                                                    : (
                                                        <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                                            <path
                                                                stroke-linecap='round'
                                                                stroke-linejoin='round'
                                                                stroke-width='2'
                                                                d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                                                            />
                                                        </svg>
                                                    )}
                                            </Button>
                                        </Tooltip>
                                    </div>

                                    {/* QR Code section */}
                                    <div class='flex flex-col items-center py-2'>
                                        <div class='p-3 bg-white rounded-lg border border-border-default'>
                                            <QRCodeCanvas value={shareLink} size={120} />
                                        </div>
                                        <p class='text-xs text-text-primary/70 mt-2'>{t('shareGroupModal.qrCodeDescription')}</p>
                                        <div class='w-full flex justify-end mt-2'>
                                            <Tooltip content={t('shareGroupModal.generateNew')}>
                                                <Button
                                                    type='button'
                                                    onClick={() => { refreshCounterSignal.value = refreshCounterSignal.value + 1; }}
                                                    variant='ghost'
                                                    size='sm'
                                                    data-testid='generate-new-link-button'
                                                    disabled={loading}
                                                    ariaLabel={t('shareGroupModal.generateNew')}
                                                    className='rounded-full'
                                                >
                                                    <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                                        <path
                                                            stroke-linecap='round'
                                                            stroke-linejoin='round'
                                                            stroke-width='1.5'
                                                            d='M16.023 9.348h4.284m0 0V5.064m0 4.284-2.913-2.913a7.5 7.5 0 10-.255 10.79'
                                                        />
                                                    </svg>
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Link expiration options */}
                            <div class={expirationContainerClass}>
                                <div class='flex flex-col gap-3'>
                                    <span class='text-sm font-medium text-text-primary/70'>
                                        {t('shareGroupModal.expirationLabel')}
                                    </span>
                                    <div class='flex flex-wrap gap-2'>
                                        {SHARE_LINK_EXPIRATION_OPTIONS.map((option) => {
                                            const isSelected = option.id === selectedExpirationId;
                                            return (
                                                <Button
                                                    key={option.id}
                                                    type='button'
                                                    data-testid={`share-link-expiration-${option.id}`}
                                                    onClick={() => { selectedExpirationIdSignal.value = option.id; }}
                                                    aria-pressed={isSelected}
                                                    variant={isSelected ? 'primary' : 'secondary'}
                                                    size='sm'
                                                    disabled={loading && isSelected}
                                                >
                                                    {t(option.translationKey)}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {expiresAt && (
                                    <p class='text-xs text-text-primary/60' data-testid='share-link-expiration-hint'>
                                        {t('shareGroupModal.expiresAt', { date: formatDateTimeInUserTimeZone(new Date(expiresAt)) })}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
            </Modal>

            {/* Toast notification */}
            {showToast && (
                <div class='fixed bottom-4 right-4 z-[60] animate-slide-up' role='status' aria-live='polite' data-testid='share-link-toast'>
                    <div class='bg-text-primary text-text-inverted px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2'>
                        <svg class='w-5 h-5 text-semantic-success' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
                        </svg>
                        <span class='text-sm font-medium'>{t('shareGroupModal.linkCopied')}</span>
                    </div>
                </div>
            )}
        </>
    );
}
