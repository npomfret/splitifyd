import { cx } from '@/utils/cx.ts';
import { signal } from '@preact/signals';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { FieldError } from './FieldError';

interface ImageUploadFieldProps {
    label: string;
    accept?: string;
    maxSizeMB?: number;
    currentImageUrl?: string;
    onFileSelect: (file: File) => void;
    onClear?: () => void;
    onUrlSelect?: (url: string) => void;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    helperText?: string;
    dataTestId?: string;
    className?: string;
    allowUrlInput?: boolean; // Allow entering URL to download image
    allowLibrary?: boolean; // Allow picking from tenant image library
    onOpenLibrary?: () => void; // Callback to open library picker
}

export function ImageUploadField({
    label,
    accept = 'image/*',
    maxSizeMB = 2,
    currentImageUrl,
    onFileSelect,
    onClear,
    onUrlSelect,
    error,
    disabled = false,
    required = false,
    helperText,
    dataTestId,
    className = '',
    allowUrlInput = false,
    allowLibrary = false,
    onOpenLibrary,
}: ImageUploadFieldProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [previewSignal] = useState(() => signal<string | undefined>(currentImageUrl));
    const [fileNameSignal] = useState(() => signal<string | undefined>(undefined));
    const [showUrlInputSignal] = useState(() => signal(false));
    const [urlValueSignal] = useState(() => signal(''));
    const [isDownloadingSignal] = useState(() => signal(false));
    const [imageLoadFailedSignal] = useState(() => signal(false));

    // Extract signal values for use in render
    const preview = previewSignal.value;
    const fileName = fileNameSignal.value;
    const showUrlInput = showUrlInputSignal.value;
    const urlValue = urlValueSignal.value;
    const isDownloading = isDownloadingSignal.value;
    const imageLoadFailed = imageLoadFailedSignal.value;

    // Update preview when currentImageUrl prop changes
    useEffect(() => {
        previewSignal.value = currentImageUrl;
        imageLoadFailedSignal.value = false; // Reset load state when URL changes
    }, [currentImageUrl]);

    const handleImageError = useCallback(() => {
        // Silently handle image load failures (e.g., invalid URLs in test data)
        imageLoadFailedSignal.value = true;
    }, []);

    const handleFileChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];

            if (!file) return;

            // Validate file size
            const fileSizeMB = file.size / (1024 * 1024);
            if (fileSizeMB > maxSizeMB) {
                // Clear the input
                if (inputRef.current) {
                    inputRef.current.value = '';
                }
                return;
            }

            // Generate preview
            const reader = new FileReader();
            reader.onloadend = () => {
                previewSignal.value = reader.result as string;
            };
            reader.readAsDataURL(file);

            fileNameSignal.value = file.name;
            onFileSelect(file);
        },
        [maxSizeMB, onFileSelect],
    );

    const handleClearClick = useCallback(() => {
        previewSignal.value = undefined;
        fileNameSignal.value = undefined;
        if (inputRef.current) {
            inputRef.current.value = '';
        }
        onClear?.();
    }, [onClear]);

    const handleChooseFileClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleUrlDownload = useCallback(async () => {
        if (!urlValueSignal.value.trim()) return;

        isDownloadingSignal.value = true;
        try {
            // Resolve relative URLs against current origin
            const absoluteUrl = urlValueSignal.value.startsWith('http') ? urlValueSignal.value : `${window.location.origin}${urlValueSignal.value}`;

            // Fetch the image from URL
            const response = await fetch(absoluteUrl);
            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.statusText}`);
            }

            const blob = await response.blob();

            // Validate size
            const fileSizeMB = blob.size / (1024 * 1024);
            if (fileSizeMB > maxSizeMB) {
                throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${maxSizeMB}MB`);
            }

            // Extract filename from URL or use default
            const filename = urlValueSignal.value.split('/').pop() || 'image';

            // Create File from Blob
            const file = new File([blob], filename, { type: blob.type });

            // Generate preview
            const reader = new FileReader();
            reader.onloadend = () => {
                previewSignal.value = reader.result as string;
            };
            reader.readAsDataURL(file);

            fileNameSignal.value = filename;
            showUrlInputSignal.value = false;
            urlValueSignal.value = '';
            onFileSelect(file);
        } catch (error: any) {
            console.error('Failed to download image from URL:', error);
            // Let parent handle error display
        } finally {
            isDownloadingSignal.value = false;
        }
    }, [maxSizeMB, onFileSelect]);

    return (
        <div className={cx('flex flex-col gap-2', className)} data-testid={dataTestId}>
            {/* Label */}
            <label className='text-sm font-medium text-text-primary'>
                {label}
                {required && <span className='text-semantic-error ml-1'>*</span>}
            </label>

            {/* Preview */}
            {preview && !imageLoadFailed && (
                <div className='relative inline-block w-fit'>
                    <img
                        src={preview}
                        alt='Preview'
                        className='max-w-xs max-h-48 rounded-lg border border-border-default bg-surface-raised object-contain'
                        onError={handleImageError}
                    />
                    {!disabled && (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={handleClearClick}
                            className='absolute top-2 end-2 bg-surface-overlay/90 hover:bg-surface-overlay'
                            aria-label='Clear image'
                        >
                            ✕
                        </Button>
                    )}
                </div>
            )}
            {/* Fallback when image fails to load */}
            {preview && imageLoadFailed && (
                <div className='relative inline-block w-fit'>
                    <div className='w-48 h-32 rounded-lg border border-border-warning bg-surface-warning/10 flex flex-col items-center justify-center text-text-muted text-xs p-2 gap-1'>
                        <span className='text-2xl' aria-hidden='true'>⚠️</span>
                        <span>{t('common.imageFailedToLoad')}</span>
                        <span className='text-text-muted/70 truncate max-w-full' title={preview}>
                            {preview.length > 30 ? `...${preview.slice(-30)}` : preview}
                        </span>
                    </div>
                    {!disabled && (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={handleClearClick}
                            className='absolute top-2 end-2 bg-surface-overlay/90 hover:bg-surface-overlay'
                            aria-label='Clear image'
                        >
                            ✕
                        </Button>
                    )}
                </div>
            )}

            {/* File Input (hidden) */}
            <input
                ref={inputRef}
                type='file'
                accept={accept}
                onChange={handleFileChange}
                disabled={disabled}
                className='hidden'
                aria-label={label}
            />

            {/* Upload Button or URL Input */}
            {!preview && !showUrlInput && (
                <div className='flex flex-wrap gap-2'>
                    <Button
                        type='button'
                        variant='secondary'
                        onClick={handleChooseFileClick}
                        disabled={disabled}
                        className='w-full sm:w-auto'
                    >
                        {t('common.chooseFile')}
                    </Button>
                    {allowLibrary && onOpenLibrary && (
                        <Button
                            type='button'
                            variant='secondary'
                            onClick={onOpenLibrary}
                            disabled={disabled}
                            className='w-full sm:w-auto'
                        >
                            {t('common.fromLibrary')}
                        </Button>
                    )}
                    {allowUrlInput && (
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={() => {
                                showUrlInputSignal.value = true;
                            }}
                            disabled={disabled}
                            className='w-full sm:w-auto'
                        >
                            {t('common.orEnterUrl')}
                        </Button>
                    )}
                </div>
            )}

            {/* URL Input */}
            {allowUrlInput && showUrlInput && !preview && (
                <div className='flex gap-2'>
                    <input
                        ref={urlInputRef}
                        type='text'
                        value={urlValue}
                        onChange={(e) => {
                            urlValueSignal.value = (e.target as HTMLInputElement).value;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUrlDownload();
                            }
                        }}
                        placeholder='https://example.com/image.png'
                        disabled={disabled || isDownloading}
                        className='flex-1 min-w-0 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-interactive-primary focus:outline-hidden focus:ring-2 focus:ring-interactive-primary/20'
                        data-testid={`${dataTestId}-url-input`}
                        aria-label={`${label} URL`}
                    />
                    <Button
                        type='button'
                        variant='primary'
                        onClick={handleUrlDownload}
                        disabled={disabled || isDownloading || !urlValue.trim()}
                        className='whitespace-nowrap'
                    >
                        {isDownloading ? t('common.downloading') : t('common.download')}
                    </Button>
                    <Button
                        type='button'
                        variant='ghost'
                        onClick={() => {
                            showUrlInputSignal.value = false;
                            urlValueSignal.value = '';
                        }}
                        disabled={isDownloading}
                    >
                        {t('common.cancel')}
                    </Button>
                </div>
            )}

            {/* File Name */}
            {fileName && (
                <p className='text-sm text-text-secondary'>
                    {t('common.selectedFile')}: {fileName}
                </p>
            )}

            {/* Helper Text */}
            {helperText && !error && <p className='help-text'>{helperText}</p>}

            {/* Error */}
            {error && (
                <FieldError id={dataTestId ? `${dataTestId}-error` : undefined} dataTestId='image-upload-error-message'>
                    {error}
                </FieldError>
            )}
        </div>
    );
}
