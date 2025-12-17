import { apiClient } from '@/app/apiClient';
import { formatFileSize, isImage } from '@/utils/attachment-utils';
import { logError } from '@/utils/browser-logger';
import type { AttachmentId, GroupId, UploadAttachmentResponse } from '@billsplit-wl/shared';
import { DocumentTextIcon, PaperClipIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import { useMemo, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button, LoadingSpinner } from '../ui';

export interface UploadedAttachment {
    id: AttachmentId;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    url: string;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ACCEPT_STRING = ACCEPTED_TYPES.join(',');

interface AttachmentUploaderProps {
    groupId: GroupId;
    attachments: UploadedAttachment[];
    onAttachmentsChange: Dispatch<StateUpdater<UploadedAttachment[]>>;
    disabled?: boolean;
    maxAttachments?: number;
    onUploadingChange?: (isUploading: boolean) => void;
}

export function AttachmentUploader({
    groupId,
    attachments,
    onAttachmentsChange,
    disabled = false,
    maxAttachments = 3,
    onUploadingChange,
}: AttachmentUploaderProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [removingId, setRemovingId] = useState<AttachmentId | null>(null);

    const remainingSlots = useMemo(() => Math.max(0, maxAttachments - attachments.length), [attachments.length, maxAttachments]);

    const setUploadingState = (value: boolean) => {
        setUploading(value);
        onUploadingChange?.(value);
    };

    const resetInput = () => {
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const validateFile = (file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return t('comments.attachments.invalidType');
        }

        if (file.size > MAX_SIZE_BYTES) {
            return t('comments.attachments.fileTooLarge');
        }

        return null;
    };

    const uploadFile = async (file: File): Promise<UploadAttachmentResponse> => {
        return apiClient.uploadAttachment(groupId, 'comment', file, file.type);
    };

    const handleFileChange = async (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = Array.from(target.files ?? []);

        if (files.length === 0) {
            return;
        }

        if (attachments.length >= maxAttachments) {
            setError(t('comments.attachments.maxReached'));
            resetInput();
            return;
        }

        const availableSlots = remainingSlots;
        if (files.length > availableSlots) {
            setError(t('comments.attachments.maxReached'));
        }

        const filesToProcess = files.slice(0, availableSlots);

        if (filesToProcess.length === 0) {
            resetInput();
            return;
        }

        const validationError = filesToProcess.map(validateFile).find((result) => result !== null);
        if (validationError) {
            setError(validationError);
            resetInput();
            return;
        }

        setError(null);
        setUploadingState(true);

        try {
            for (const file of filesToProcess) {
                const response = await uploadFile(file);

                const uploaded: UploadedAttachment = {
                    id: response.attachment.id,
                    fileName: response.attachment.fileName,
                    contentType: response.attachment.contentType,
                    sizeBytes: response.attachment.sizeBytes,
                    url: response.url,
                };

                onAttachmentsChange((current) => [...current, uploaded]);
            }
        } catch (err) {
            logError('Failed to upload attachment', err);
            setError(t('comments.attachments.uploadFailed'));
        } finally {
            setUploadingState(false);
            resetInput();
        }
    };

    const handleRemove = async (attachment: UploadedAttachment) => {
        setError(null);
        setRemovingId(attachment.id);

        const remove = (list: UploadedAttachment[]) => list.filter((item) => item.id !== attachment.id);
        onAttachmentsChange(remove);

        try {
            await apiClient.deleteAttachment(groupId, attachment.id);
        } catch (err) {
            logError('Failed to delete attachment', err);
            setError(t('comments.attachments.deleteFailed'));
            onAttachmentsChange((current) => {
                const exists = current.some((item) => item.id === attachment.id);
                return exists ? current : [...current, attachment];
            });
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2 text-sm font-medium text-text-primary'>
                    <PaperClipIcon className='h-4 w-4 text-text-muted' aria-hidden='true' />
                    <span>{t('comments.attachments.label')}</span>
                </div>
                {uploading && <LoadingSpinner size='sm' />}
            </div>

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type='file'
                accept={ACCEPT_STRING}
                multiple
                className='hidden'
                onChange={handleFileChange}
                disabled={disabled || uploading}
                aria-label={t('comments.attachments.label')}
            />

            {/* Attachments list */}
            {attachments.length > 0 && (
                <div className='flex flex-wrap gap-3'>
                    {attachments.map((attachment) => (
                        <div
                            key={attachment.id}
                            className='relative flex items-center gap-2 rounded-lg border border-border-default bg-surface-muted px-3 py-2 min-w-[220px]'
                        >
                            <div className='flex h-10 w-10 items-center justify-center rounded-md bg-surface-base border border-border-default shrink-0'>
                                {isImage(attachment.contentType)
                                    ? <PhotoIcon className='h-5 w-5 text-text-muted' aria-hidden='true' />
                                    : <DocumentTextIcon className='h-5 w-5 text-text-muted' aria-hidden='true' />}
                            </div>
                            <div className='flex flex-col min-w-0'>
                                <span className='text-sm font-medium text-text-primary truncate'>{attachment.fileName}</span>
                                <span className='help-text-xs text-text-muted'>{formatFileSize(attachment.sizeBytes)}</span>
                            </div>
                            <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                ariaLabel={t('comments.attachments.remove', { fileName: attachment.fileName })}
                                onClick={() => handleRemove(attachment)}
                                disabled={disabled || removingId === attachment.id || uploading}
                                className='shrink-0'
                            >
                                {removingId === attachment.id ? <LoadingSpinner size='sm' /> : <XMarkIcon className='h-4 w-4' aria-hidden='true' />}
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <div className='flex items-center gap-2'>
                <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled || uploading || remainingSlots === 0}
                >
                    <PhotoIcon className='h-4 w-4 mr-2' aria-hidden='true' />
                    {remainingSlots === 0 ? t('comments.attachments.maxReached') : t('comments.attachments.add')}
                </Button>
                <span className='help-text-xs text-text-muted'>{t('comments.attachments.helperText')}</span>
            </div>

            {error && (
                <p className='text-sm text-semantic-error' role='alert'>
                    {error}
                </p>
            )}
        </div>
    );
}
