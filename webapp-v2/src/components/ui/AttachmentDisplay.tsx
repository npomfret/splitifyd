import { apiClient } from '@/app/apiClient';
import { formatFileSize, isImage } from '@/utils/attachment-utils';
import type { CommentAttachmentRef, GroupId } from '@billsplit-wl/shared';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AuthenticatedImage } from './AuthenticatedImage';

interface AttachmentDisplayProps {
    attachments: CommentAttachmentRef[];
    groupId: GroupId;
    className?: string;
}

export function AttachmentDisplay({ attachments, groupId, className = '' }: AttachmentDisplayProps) {
    const { t } = useTranslation();

    if (!attachments || attachments.length === 0) {
        return null;
    }

    return (
        <div className={`flex flex-wrap gap-3 ${className}`}>
            {attachments.map((attachment) => {
                const url = apiClient.getAttachmentUrl(groupId, attachment.attachmentId);
                const isImageFile = isImage(attachment.contentType);

                return (
                    <a
                        key={attachment.attachmentId}
                        href={url}
                        target='_blank'
                        rel='noreferrer'
                        className='group flex w-[220px] flex-col overflow-hidden rounded-lg border border-border-default bg-surface-muted hover:border-border-strong transition-colors'
                        aria-label={t('comments.attachments.viewAttachment', { fileName: attachment.fileName })}
                    >
                        <div className='relative h-28 bg-surface-base border-b border-border-default flex items-center justify-center overflow-hidden'>
                            {isImageFile
                                ? (
                                    <AuthenticatedImage
                                        src={url}
                                        alt={attachment.fileName}
                                        className='h-full w-full object-cover'
                                    />
                                )
                                : <DocumentTextIcon className='h-8 w-8 text-text-muted' aria-hidden='true' />}
                        </div>
                        <div className='p-3 flex flex-col gap-1 min-w-0'>
                            <span className='text-sm font-medium text-text-primary truncate'>{attachment.fileName}</span>
                            <span className='help-text-xs text-text-muted'>{formatFileSize(attachment.sizeBytes)}</span>
                        </div>
                    </a>
                );
            })}
        </div>
    );
}
