import { urlNeedsAuthentication } from '@/utils/attachment-utils';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { signal } from '@preact/signals';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { AuthenticatedImage, Button, Card, LoadingSpinner } from '../ui';

const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ACCEPT_STRING = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

interface ReceiptUploaderProps {
    receiptUrl: string | null;
    receiptFile: File | null;
    uploading: boolean;
    error: string | null;
    onFileSelect: (file: File | null) => void;
    onClearError: () => void;
    disabled?: boolean;
}

export function ReceiptUploader({
    receiptUrl,
    receiptFile,
    uploading,
    error,
    onFileSelect,
    onClearError,
    disabled = false,
}: ReceiptUploaderProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [previewSignal] = useState(() => signal<string | null>(null));
    const [localErrorSignal] = useState(() => signal<string | null>(null));
    const [imageLoadFailedSignal] = useState(() => signal(false));

    // Extract signal values for use in render
    const preview = previewSignal.value;
    const localError = localErrorSignal.value;
    const imageLoadFailed = imageLoadFailedSignal.value;

    // Generate preview from file when selected
    useEffect(() => {
        if (receiptFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                previewSignal.value = reader.result as string;
                imageLoadFailedSignal.value = false;
            };
            reader.readAsDataURL(receiptFile);
        } else if (receiptUrl) {
            // Use the proxy URL directly
            previewSignal.value = receiptUrl;
            imageLoadFailedSignal.value = false;
        } else {
            previewSignal.value = null;
        }
    }, [receiptFile, receiptUrl]);

    const handleImageError = useCallback(() => {
        imageLoadFailedSignal.value = true;
    }, []);

    const handleFileChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];

            if (!file) return;

            // Clear any previous errors
            localErrorSignal.value = null;
            onClearError();

            // Validate file type
            if (!ACCEPTED_TYPES.includes(file.type)) {
                localErrorSignal.value = t('receiptUploader.invalidType');
                if (inputRef.current) {
                    inputRef.current.value = '';
                }
                return;
            }

            // Validate file size
            const fileSizeMB = file.size / (1024 * 1024);
            if (fileSizeMB > MAX_SIZE_MB) {
                localErrorSignal.value = t('receiptUploader.fileTooLarge');
                if (inputRef.current) {
                    inputRef.current.value = '';
                }
                return;
            }

            onFileSelect(file);
        },
        [onFileSelect, onClearError, t],
    );

    const handleClearClick = useCallback(() => {
        previewSignal.value = null;
        localErrorSignal.value = null;
        if (inputRef.current) {
            inputRef.current.value = '';
        }
        onFileSelect(null);
        onClearError();
    }, [onFileSelect, onClearError]);

    const handleChooseFileClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const hasReceipt = !!(preview || receiptUrl || receiptFile);
    const displayError = error || localError;

    return (
        <Card variant='glass' className='border-border-default' ariaLabel={t('receiptUploader.label')}>
            <div className='flex flex-col gap-3'>
                <div className='flex items-center justify-between'>
                    <h2 className='text-lg font-semibold text-text-primary'>{t('receiptUploader.label')}</h2>
                    {uploading && <LoadingSpinner size='sm' />}
                </div>

                {/* Hidden file input */}
                <input
                    ref={inputRef}
                    type='file'
                    accept={ACCEPT_STRING}
                    onChange={handleFileChange}
                    disabled={disabled || uploading}
                    className='hidden'
                    aria-label={t('receiptUploader.label')}
                />

                {/* Preview */}
                {hasReceipt && preview && !imageLoadFailed && (
                    <div className='relative inline-block w-fit'>
                        {urlNeedsAuthentication(preview)
                            ? (
                                <AuthenticatedImage
                                    src={preview}
                                    alt={t('receiptUploader.previewAlt')}
                                    className='max-w-xs max-h-48 rounded-lg border border-border-default bg-surface-raised object-contain'
                                    onError={handleImageError}
                                />
                            )
                            : (
                                <img
                                    src={preview}
                                    alt={t('receiptUploader.previewAlt')}
                                    className='max-w-xs max-h-48 rounded-lg border border-border-default bg-surface-raised object-contain'
                                    onError={handleImageError}
                                />
                            )}
                        {!disabled && !uploading && (
                            <button
                                type='button'
                                onClick={handleClearClick}
                                className='absolute top-1 end-1 p-2 rounded-full bg-surface-overlay/90 hover:bg-surface-overlay transition-colors'
                                aria-label={t('receiptUploader.removeReceipt')}
                            >
                                <XMarkIcon className='h-5 w-5 text-text-primary' />
                            </button>
                        )}
                    </div>
                )}

                {/* Fallback when image fails to load */}
                {hasReceipt && imageLoadFailed && (
                    <div className='relative inline-block w-fit'>
                        <div className='w-48 h-32 rounded-lg border border-border-warning bg-surface-warning/10 flex flex-col items-center justify-center text-text-muted text-xs p-2 gap-1'>
                            <PhotoIcon className='h-8 w-8 text-text-muted' />
                            <span>{t('receiptUploader.imageFailedToLoad')}</span>
                        </div>
                        {!disabled && !uploading && (
                            <button
                                type='button'
                                onClick={handleClearClick}
                                className='absolute top-1 end-1 p-2 rounded-full bg-surface-overlay/90 hover:bg-surface-overlay transition-colors'
                                aria-label={t('receiptUploader.removeReceipt')}
                            >
                                <XMarkIcon className='h-5 w-5 text-text-primary' />
                            </button>
                        )}
                    </div>
                )}

                {/* Upload button */}
                {!hasReceipt && (
                    <div className='flex flex-col items-start gap-2'>
                        <Button
                            type='button'
                            variant='secondary'
                            size='sm'
                            onClick={handleChooseFileClick}
                            disabled={disabled || uploading}
                        >
                            <PhotoIcon className='h-4 w-4 mr-2' />
                            {t('receiptUploader.addReceipt')}
                        </Button>
                        <p className='help-text-xs'>
                            {t('receiptUploader.helperText')}
                        </p>
                    </div>
                )}

                {/* Change receipt button when receipt exists */}
                {hasReceipt && !uploading && (
                    <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={handleChooseFileClick}
                        disabled={disabled}
                        className='w-fit'
                    >
                        {t('receiptUploader.changeReceipt')}
                    </Button>
                )}

                {/* Error message */}
                {displayError && (
                    <p className='text-sm text-semantic-error' role='alert'>
                        {displayError}
                    </p>
                )}
            </div>
        </Card>
    );
}
