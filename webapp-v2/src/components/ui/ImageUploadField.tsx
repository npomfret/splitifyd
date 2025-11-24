import { cx } from '@/utils/cx.ts';
import type { Ref } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface ImageUploadFieldProps {
    label: string;
    accept?: string;
    maxSizeMB?: number;
    currentImageUrl?: string;
    onFileSelect: (file: File) => void;
    onClear?: () => void;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    helperText?: string;
    'data-testid'?: string;
    className?: string;
    allowUrlInput?: boolean;  // NEW: Allow entering URL to download image
}

export function ImageUploadField({
    label,
    accept = 'image/*',
    maxSizeMB = 2,
    currentImageUrl,
    onFileSelect,
    onClear,
    error,
    disabled = false,
    required = false,
    helperText,
    'data-testid': dataTestId,
    className = '',
    allowUrlInput = false,
}: ImageUploadFieldProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | undefined>(currentImageUrl);
    const [fileName, setFileName] = useState<string | undefined>();
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlValue, setUrlValue] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    // Update preview when currentImageUrl prop changes
    useEffect(() => {
        setPreview(currentImageUrl);
    }, [currentImageUrl]);

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
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            setFileName(file.name);
            onFileSelect(file);
        },
        [maxSizeMB, onFileSelect],
    );

    const handleClearClick = useCallback(() => {
        setPreview(undefined);
        setFileName(undefined);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
        onClear?.();
    }, [onClear]);

    const handleChooseFileClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleUrlDownload = useCallback(async () => {
        if (!urlValue.trim()) return;

        setIsDownloading(true);
        try {
            // Resolve relative URLs against current origin
            const absoluteUrl = urlValue.startsWith('http') ? urlValue : `${window.location.origin}${urlValue}`;

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
            const filename = urlValue.split('/').pop() || 'image';

            // Create File from Blob
            const file = new File([blob], filename, { type: blob.type });

            // Generate preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            setFileName(filename);
            setShowUrlInput(false);
            setUrlValue('');
            onFileSelect(file);
        } catch (error: any) {
            console.error('Failed to download image from URL:', error);
            // Let parent handle error display
        } finally {
            setIsDownloading(false);
        }
    }, [urlValue, maxSizeMB, onFileSelect]);

    return (
        <div className={cx('flex flex-col gap-2', className)} data-testid={dataTestId}>
            {/* Label */}
            <label className="text-sm font-medium text-text-primary">
                {label}
                {required && <span className="text-semantic-error ml-1">*</span>}
            </label>

            {/* Preview */}
            {preview && (
                <div className="relative inline-block w-fit">
                    <img
                        src={preview}
                        alt="Preview"
                        className="max-w-xs max-h-48 rounded-lg border border-border-default bg-surface-raised object-contain"
                    />
                    {!disabled && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearClick}
                            className="absolute top-2 right-2 bg-surface-overlay/90 hover:bg-surface-overlay"
                            aria-label="Clear image"
                        >
                            ✕
                        </Button>
                    )}
                </div>
            )}

            {/* File Input (hidden) */}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleFileChange}
                disabled={disabled}
                className="hidden"
                aria-label={label}
            />

            {/* Upload Button or URL Input */}
            {!preview && !showUrlInput && (
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleChooseFileClick}
                        disabled={disabled}
                        className="w-full sm:w-auto"
                    >
                        {t('common.chooseFile', 'Choose File')}
                    </Button>
                    {allowUrlInput && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setShowUrlInput(true)}
                            disabled={disabled}
                            className="w-full sm:w-auto"
                        >
                            Or enter URL
                        </Button>
                    )}
                </div>
            )}

            {/* URL Input */}
            {allowUrlInput && showUrlInput && !preview && (
                <div className="flex gap-2">
                    <input
                        ref={urlInputRef}
                        type="text"
                        value={urlValue}
                        onChange={(e) => setUrlValue((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUrlDownload();
                            }
                        }}
                        placeholder="https://example.com/image.png"
                        disabled={disabled || isDownloading}
                        className="flex-1 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-interactive-primary focus:outline-none focus:ring-2 focus:ring-interactive-primary/20"
                        data-testid={`${dataTestId}-url-input`}
                        aria-label={`${label} URL`}
                    />
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleUrlDownload}
                        disabled={disabled || isDownloading || !urlValue.trim()}
                        className="whitespace-nowrap"
                    >
                        {isDownloading ? 'Downloading...' : 'Download'}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            setShowUrlInput(false);
                            setUrlValue('');
                        }}
                        disabled={isDownloading}
                    >
                        Cancel
                    </Button>
                </div>
            )}

            {/* File Name */}
            {fileName && (
                <p className="text-sm text-text-secondary">
                    {t('common.selectedFile', 'Selected')}: {fileName}
                </p>
            )}

            {/* Helper Text */}
            {helperText && !error && (
                <p className="text-sm text-text-muted">{helperText}</p>
            )}

            {/* Error */}
            {error && (
                <p className="text-sm text-semantic-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
