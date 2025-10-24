import { apiClient } from '@/app/apiClient.ts';
import { Tooltip } from '@/components/ui';
import { logError } from '@/utils/browser-logger.ts';
import { formatDateTimeInUserTimeZone } from '@/utils/dateUtils.ts';
import { useEffect, useRef, useState } from 'preact/hooks';
import { QRCodeCanvas } from 'qrcode.react';
import { useTranslation } from 'react-i18next';

interface ShareGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
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
    return SHARE_LINK_EXPIRATION_OPTIONS.find((option) => option.id === id) ??
        SHARE_LINK_EXPIRATION_OPTIONS.find((option) => option.id === DEFAULT_EXPIRATION_OPTION_ID)!;
};

export function ShareGroupModal({ isOpen, onClose, groupId, groupName }: ShareGroupModalProps) {
    const { t, i18n } = useTranslation();
    const [shareLink, setShareLink] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [selectedExpirationId, setSelectedExpirationId] = useState<ShareLinkExpirationOptionId>(DEFAULT_EXPIRATION_OPTION_ID);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const linkInputRef = useRef<HTMLInputElement>(null);
    const copiedTimerRef = useRef<number | null>(null);
    const toastTimerRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);
    const [refreshCounter, setRefreshCounter] = useState(0);
    const expirationContainerClass = shareLink ? 'space-y-2 border-t border-gray-100 pt-4' : 'space-y-2 pt-4';
    const normalizedGroupName = groupName.trim();

    // Handle escape key to close modal
    // Pattern matches CreateGroupModal for consistency and reliability
    // Uses capture phase for more reliable event handling (especially in Playwright tests)
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Prevent default and stop propagation to avoid conflicts with other handlers
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        // Use capture phase for maximum reliability across browsers and test frameworks
        // This ensures the handler fires before other event listeners
        window.addEventListener('keydown', handleEscape, { capture: true });
        return () => window.removeEventListener('keydown', handleEscape, { capture: true });
    }, [isOpen, onClose]);

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

        setShareLink('');
        setExpiresAt(null);
        setError(null);
        setCopied(false);
        setShowToast(false);
        setSelectedExpirationId(DEFAULT_EXPIRATION_OPTION_ID);
    }, [isOpen, groupId]);

    useEffect(() => {
        if (!isOpen || !groupId) {
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        setLoading(true);
        setError(null);
        setShareLink('');
        setExpiresAt(null);
        setCopied(false);
        setShowToast(false);

        const { durationMs } = getExpirationOption(selectedExpirationId);
        const requestedExpiresAt = new Date(Date.now() + durationMs).toISOString();
        const errorMessage = t('shareGroupModal.errors.generateLinkFailed');

        (async () => {
            try {
                const response = await apiClient.generateShareLink(groupId, requestedExpiresAt);
                if (requestIdRef.current !== requestId) {
                    return;
                }

                const fullUrl = `${window.location.origin}${response.shareablePath}`;
                setShareLink(fullUrl);
                setExpiresAt(response.expiresAt);
            } catch (err) {
                if (requestIdRef.current !== requestId) {
                    return;
                }

                logError('Failed to generate share link', err);
                setError(errorMessage);
            } finally {
                if (requestIdRef.current === requestId) {
                    setLoading(false);
                }
            }
        })();
    }, [isOpen, groupId, selectedExpirationId, refreshCounter, i18n.language]);

    const handleExpirationChange = (event: Event) => {
        if (!groupId) {
            return;
        }

        const target = event.target as HTMLSelectElement;
        const newId = target.value as ShareLinkExpirationOptionId;
        setSelectedExpirationId(newId);
    };

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
            setCopied(true);
            setShowToast(true);

            copiedTimerRef.current = window.setTimeout(() => {
                setCopied(false);
                copiedTimerRef.current = null;
            }, 2000);

            toastTimerRef.current = window.setTimeout(() => {
                setShowToast(false);
                toastTimerRef.current = null;
            }, 3000);
        } catch (err) {
            if (linkInputRef.current) {
                linkInputRef.current.select();
                document.execCommand('copy');
                setCopied(true);
                setShowToast(true);

                copiedTimerRef.current = window.setTimeout(() => {
                    setCopied(false);
                    copiedTimerRef.current = null;
                }, 2000);

                toastTimerRef.current = window.setTimeout(() => {
                    setShowToast(false);
                    toastTimerRef.current = null;
                }, 3000);
            }
        }
    };

    const handleBackdropClick = (e: Event) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div class='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50' onClick={handleBackdropClick} role='presentation'>
                <div class='relative top-20 mx-auto w-96 shadow-xl rounded-lg bg-white overflow-hidden' role='dialog' aria-modal='true' aria-labelledby='share-modal-title'>
                    {/* Modal Header with colored background */}
                    <div class='bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-purple-100'>
                        <div class='flex items-center justify-between'>
                            <div class='flex flex-col space-y-1'>
                                <div class='flex items-center space-x-2'>
                                    <svg class='w-5 h-5 text-purple-600' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                        <path
                                            stroke-linecap='round'
                                            stroke-linejoin='round'
                                            stroke-width='2'
                                            d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
                                        />
                                    </svg>
                                    <h3 id='share-modal-title' class='text-lg font-semibold text-gray-900'>
                                        {t('shareGroupModal.title')}
                                    </h3>
                                </div>
                                {normalizedGroupName && (
                                    <p class='text-sm text-gray-600' data-testid='share-group-name'>
                                        {normalizedGroupName}
                                    </p>
                                )}
                            </div>
                            <Tooltip content={t('shareGroupModal.closeButtonAriaLabel')}>
                                <button
                                    type='button'
                                    onClick={onClose}
                                    class='text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-100'
                                    data-testid='close-share-modal-button'
                                    aria-label={t('shareGroupModal.closeButtonAriaLabel')}
                                >
                                    <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                                    </svg>
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div class='p-6'>
                        <p class='text-sm text-gray-600 mb-4'>{t('shareGroupModal.description')}</p>

                        {loading && (
                            <div class='flex justify-center py-8'>
                                <div class='animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600'></div>
                            </div>
                        )}

                        {error && (
                            <div class='bg-red-50 border border-red-200 rounded-md p-3 mb-4'>
                                <p class='text-sm text-red-800' role='alert' data-testid='share-group-error-message'>
                                    {error}
                                </p>
                            </div>
                        )}

                        <div class='space-y-6'>
                            {shareLink && !loading && (
                                <>
                                    {/* Share link input with inline copy button */}
                                    <div class='relative'>
                                        <input
                                            ref={linkInputRef}
                                            type='text'
                                            value={shareLink}
                                            readOnly={true}
                                            class='w-full pl-3 pr-12 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                            data-testid='share-link-input'
                                            autoComplete='off'
                                        />
                                        <Tooltip content={copied ? t('shareGroupModal.linkCopied') : t('shareGroupModal.copyLinkTitle')}>
                                            <button
                                                type='button'
                                                onClick={copyToClipboard}
                                                class='absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-all duration-200'
                                                data-testid='copy-link-button'
                                                aria-label={t('shareGroupModal.copyLinkAriaLabel')}
                                            >
                                                {copied
                                                    ? (
                                                        <svg class='w-5 h-5 text-green-600' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
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
                                            </button>
                                        </Tooltip>
                                    </div>

                                    {/* QR Code section */}
                                    <div class='flex flex-col items-center py-4'>
                                        <div class='p-4 bg-white rounded-lg border border-gray-200'>
                                            <QRCodeCanvas value={shareLink} size={150} />
                                        </div>
                                        <p class='text-sm text-gray-500 mt-2'>{t('shareGroupModal.qrCodeDescription')}</p>
                                    </div>
                                </>
                            )}

                            {/* Link expiration options */}
                            <div class={expirationContainerClass}>
                                <div class='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                                    <label htmlFor='share-link-expiration-select' class='text-sm font-medium text-gray-600'>
                                        {t('shareGroupModal.expirationLabel')}
                                    </label>
                                    <div class='flex items-center gap-3'>
                                        <select
                                            id='share-link-expiration-select'
                                            class='border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                                            value={selectedExpirationId}
                                            onChange={handleExpirationChange}
                                            data-testid='share-link-expiration-select'
                                        >
                                            {SHARE_LINK_EXPIRATION_OPTIONS.map((option) => (
                                                <option key={option.id} value={option.id}>
                                                    {t(option.translationKey)}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type='button'
                                            onClick={() => setRefreshCounter((count) => count + 1)}
                                            class='text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
                                            data-testid='generate-new-link-button'
                                            disabled={loading}
                                        >
                                            {t('shareGroupModal.generateNew')}
                                        </button>
                                    </div>
                                </div>
                                {expiresAt && (
                                    <p class='text-xs text-gray-500' data-testid='share-link-expiration-hint'>
                                        {t('shareGroupModal.expiresAt', { date: formatDateTimeInUserTimeZone(new Date(expiresAt)) })}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast notification */}
            {showToast && (
                <div class='fixed bottom-4 right-4 z-[60] animate-slide-up'>
                    <div class='bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2'>
                        <svg class='w-5 h-5 text-green-400' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
                        </svg>
                        <span class='text-sm font-medium'>{t('shareGroupModal.linkCopied')}</span>
                    </div>
                </div>
            )}
        </>
    );
}
