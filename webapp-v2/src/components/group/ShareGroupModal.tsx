import { apiClient } from '@/app/apiClient.ts';
import { useModalOpenOrChange } from '@/app/hooks/useModalOpen';
import { Button, LoadingSpinner, Tooltip, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { CheckIcon, CopyIcon, RefreshIcon, UserAddIcon, XIcon } from '@/components/ui/icons';
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal';
import i18n from '@/i18n';
import { logError } from '@/utils/browser-logger.ts';
import { formatDateTimeInUserTimeZone } from '@/utils/dateUtils.ts';
import { GroupId } from '@billsplit-wl/shared';
import { toISOString } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
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
    const [selectedExpirationIdSignal] = useState(() => signal<ShareLinkExpirationOptionId>(DEFAULT_EXPIRATION_OPTION_ID));
    const [expiresAtSignal] = useState(() => signal<string | null>(null));
    const [refreshCounterSignal] = useState(() => signal(0));

    // Extract signal values for use in render
    const shareLink = shareLinkSignal.value;
    const loading = loadingSignal.value;
    const error = errorSignal.value;
    const copied = copiedSignal.value;
    const selectedExpirationId = selectedExpirationIdSignal.value;
    const expiresAt = expiresAtSignal.value;
    const refreshCounter = refreshCounterSignal.value;

    const linkInputRef = useRef<HTMLInputElement>(null);
    const copiedTimerRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);
    const expirationContainerClass = shareLink ? 'space-y-2 border-t border-border-default pt-4' : 'space-y-2 pt-4';
    const normalizedGroupName = groupName.trim();

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) {
                clearTimeout(copiedTimerRef.current);
            }
        };
    }, []);

    // Reset state when modal opens or group changes
    useModalOpenOrChange(isOpen, groupId, useCallback(() => {
        if (copiedTimerRef.current) {
            clearTimeout(copiedTimerRef.current);
            copiedTimerRef.current = null;
        }

        shareLinkSignal.value = '';
        expiresAtSignal.value = null;
        errorSignal.value = null;
        copiedSignal.value = false;
        selectedExpirationIdSignal.value = DEFAULT_EXPIRATION_OPTION_ID;
    }, []));

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

        const { durationMs } = getExpirationOption(selectedExpirationId);
        const requestedExpiresAt = toISOString(new Date(Date.now() + durationMs).toISOString());
        const errorMessage = t('shareGroupModal.errors.generateLinkFailed');

        (async () => {
            try {
                const response = await apiClient.generateShareableLink(groupId, requestedExpiresAt);
                if (requestIdRef.current !== requestId) {
                    return;
                }

                // Include current language in share link for OG tag localization
                const langParam = i18n.language !== 'en' ? `&lang=${i18n.language}` : '';
                const fullUrl = `${window.location.origin}${response.shareablePath}${langParam}`;
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

        const showCopiedFeedback = () => {
            copiedSignal.value = true;

            copiedTimerRef.current = window.setTimeout(() => {
                copiedSignal.value = false;
                copiedTimerRef.current = null;
            }, 2000);
        };

        try {
            await navigator.clipboard.writeText(shareLink);
            showCopiedFeedback();
        } catch (err) {
            if (linkInputRef.current) {
                linkInputRef.current.select();
                document.execCommand('copy');
                showCopiedFeedback();
            }
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size='sm'
            labelledBy='share-modal-title'
        >
            <ModalHeader>
                <div className='flex items-center justify-between'>
                    <div className='flex flex-col space-y-1'>
                        <div className='flex items-center space-x-2'>
                            <UserAddIcon size={20} className='text-interactive-primary' />
                            <Typography variant='subheading' id='share-modal-title'>
                                {t('shareGroupModal.title')}
                            </Typography>
                        </div>
                        {normalizedGroupName && (
                            <p className='text-sm text-text-primary/70'>
                                {normalizedGroupName}
                            </p>
                        )}
                    </div>
                    <Tooltip content={t('shareGroupModal.closeButtonAriaLabel')} showOnFocus={false}>
                        <Clickable
                            as='button'
                            type='button'
                            onClick={onClose}
                            className='text-text-muted/80 hover:text-text-muted transition-colors rounded-full p-1 hover:bg-surface-muted'
                            aria-label={t('shareGroupModal.closeButtonAriaLabel')}
                            eventName='modal_close'
                            eventProps={{ modalName: 'share_group', method: 'x_button' }}
                        >
                            <XIcon size={20} />
                        </Clickable>
                    </Tooltip>
                </div>
            </ModalHeader>

            <ModalContent>
                <p className='text-sm text-text-primary/70 mb-3'>{t('shareGroupModal.description')}</p>

                {loading && (
                    <div className='flex justify-center py-8'>
                        <LoadingSpinner size='lg' />
                    </div>
                )}

                {error && (
                    <div className='bg-surface-error border border-border-error rounded-md p-3 mb-4'>
                        <p className='text-sm text-semantic-error' role='alert'>
                            {error}
                        </p>
                    </div>
                )}

                <div className='space-y-4'>
                    {shareLink && !loading && (
                        <>
                            {/* Share link input with inline copy button */}
                            <div className='relative'>
                                <input
                                    ref={linkInputRef}
                                    type='text'
                                    value={shareLink}
                                    readOnly={true}
                                    className='w-full pl-3 pr-12 py-3 border border-border-default rounded-lg bg-surface-raised backdrop-blur-xs text-text-primary text-sm focus:outline-hidden focus:ring-2 focus:ring-interactive-primary focus:border-transparent'
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                    autoComplete='off'
                                />
                                <Tooltip
                                    content={copied ? t('shareGroupModal.linkCopied') : t('shareGroupModal.copyLinkTitle')}
                                    className='absolute end-2 top-1/2 -translate-y-1/2'
                                >
                                    <Button
                                        type='button'
                                        onClick={copyToClipboard}
                                        variant='ghost'
                                        size='sm'
                                        magnetic={false}
                                        ariaLabel={t('shareGroupModal.copyLinkAriaLabel')}
                                    >
                                        {copied
                                            ? <CheckIcon size={20} className='text-semantic-success' />
                                            : <CopyIcon size={20} />}
                                    </Button>
                                </Tooltip>
                            </div>

                            {/* QR Code section */}
                            <div className='flex flex-col items-center py-2'>
                                <div className='p-3 bg-surface-raised rounded-lg border border-border-default'>
                                    <QRCodeCanvas value={shareLink} size={120} />
                                </div>
                                <p className='text-xs text-text-primary/70 mt-2'>{t('shareGroupModal.qrCodeDescription')}</p>
                                <div className='w-full flex justify-end mt-2'>
                                    <Tooltip content={t('shareGroupModal.generateNew')}>
                                        <Button
                                            type='button'
                                            onClick={() => {
                                                refreshCounterSignal.value = refreshCounterSignal.value + 1;
                                            }}
                                            variant='ghost'
                                            size='sm'
                                            disabled={loading}
                                            ariaLabel={t('shareGroupModal.generateNew')}
                                            className='rounded-full'
                                        >
                                            <RefreshIcon size={20} />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Link expiration options */}
                    <div class={expirationContainerClass}>
                        <div className='flex flex-col gap-3'>
                            <span className='text-sm font-medium text-text-primary/70'>
                                {t('shareGroupModal.expirationLabel')}
                            </span>
                            <div className='flex flex-wrap gap-2'>
                                {SHARE_LINK_EXPIRATION_OPTIONS.map((option) => {
                                    const isSelected = option.id === selectedExpirationId;
                                    return (
                                        <Button
                                            key={option.id}
                                            type='button'
                                            onClick={() => {
                                                selectedExpirationIdSignal.value = option.id;
                                            }}
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
                            <p className='text-xs text-text-primary/60'>
                                {t('shareGroupModal.expiresAt', { date: formatDateTimeInUserTimeZone(new Date(expiresAt)) })}
                            </p>
                        )}
                    </div>
                </div>
            </ModalContent>
        </Modal>
    );
}
