import { apiClient } from '@/app/apiClient';
import { AttachmentUploader, type UploadedAttachment } from '@/components/comments/AttachmentUploader';
import { commentsStore } from '@/stores/comments-store.ts';
import type { CommentsStoreTarget } from '@/stores/comments-store.ts';
import { logError } from '@/utils/browser-logger';
import type { CommentId, GroupId, ListCommentsResponse, ReactionEmoji } from '@billsplit-wl/shared';
import { toCommentText } from '@billsplit-wl/shared';
import { useComputed } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { CommentInput } from './CommentInput';
import { CommentsList } from './CommentsList';

interface CommentsSectionProps {
    target: CommentsStoreTarget;
    maxHeight?: string;
    className?: string;
    initialData?: ListCommentsResponse | null;
    groupId?: GroupId;
    /** Whether to allow uploading new attachments. Default: true */
    allowAttachmentUpload?: boolean;
}

export function CommentsSection({ target, maxHeight = '400px', className = '', initialData, groupId, allowAttachmentUpload = true }: CommentsSectionProps) {
    const { t } = useTranslation();

    // Use signals for reactive state
    const comments = useComputed(() => commentsStore.commentsSignal.value);
    const loading = useComputed(() => commentsStore.loadingSignal.value);
    const submitting = useComputed(() => commentsStore.submittingSignal.value);
    const error = useComputed(() => commentsStore.errorSignal.value);
    const hasMore = useComputed(() => commentsStore.hasMoreSignal.value);

    const initialDataRef = useRef<ListCommentsResponse | null | undefined>();
    initialDataRef.current = initialData;

    const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
    const [uploadingAttachments, setUploadingAttachments] = useState(false);
    const attachmentsRef = useRef<UploadedAttachment[]>([]);
    attachmentsRef.current = attachments;

    const targetKey = target.type === 'group'
        ? `group:${target.groupId}`
        : `expense:${target.expenseId}`;
    const attachmentGroupId = target.type === 'group' ? target.groupId : groupId;

    useEffect(() => {
        setAttachments([]);
        attachmentsRef.current = [];
    }, [targetKey]);

    // Subscribe to comments when component mounts or target changes
    useEffect(() => {
        commentsStore.registerComponent(target, initialDataRef.current);

        // Cleanup on unmount
        return () => {
            commentsStore.deregisterComponent(target);
        };
    }, [targetKey]);

    // Cleanup any pending uploads when target changes/unmounts
    useEffect(() => {
        return () => {
            if (!attachmentGroupId || attachmentsRef.current.length === 0) {
                return;
            }

            const pending = [...attachmentsRef.current];
            attachmentsRef.current = [];

            void Promise.all(
                pending.map(async (attachment) => {
                    try {
                        await apiClient.deleteAttachment(attachmentGroupId, attachment.id);
                    } catch (error) {
                        logError('Failed to cleanup pending comment attachments', error);
                    }
                }),
            );
        };
    }, [attachmentGroupId, targetKey]);

    const handleSubmit = async (text: string) => {
        try {
            await commentsStore.addComment(toCommentText(text), attachments.map((attachment) => attachment.id));
            setAttachments([]);
        } catch {
            // Leave attachments intact for retry; error state handled by store
        }
    };

    const handleLoadMore = async () => {
        await commentsStore.loadMoreComments();
    };

    const handleReactionToggle = async (commentId: CommentId, emoji: ReactionEmoji) => {
        await commentsStore.toggleReaction(commentId, emoji);
    };

    return (
        <div className={`flex flex-col gap-4 ${className}`}>
            {/* Error message */}
            {error.value && (
                <div className='bg-surface-warning border border-border-error rounded-lg p-3'>
                    <p className='text-sm text-semantic-error' role='alert'>
                        {error.value}
                    </p>
                </div>
            )}

            {/* Comments list */}
            <CommentsList
                comments={comments.value}
                loading={loading.value}
                hasMore={hasMore.value}
                onLoadMore={handleLoadMore}
                maxHeight={maxHeight}
                onReactionToggle={handleReactionToggle}
                attachmentGroupId={attachmentGroupId ?? undefined}
            />

            {/* Comment input */}
            <div className='border-t border-border-default pt-4'>
                {attachmentGroupId && allowAttachmentUpload && (
                    <div className='mb-3'>
                        <AttachmentUploader
                            groupId={attachmentGroupId}
                            attachments={attachments}
                            onAttachmentsChange={setAttachments}
                            disabled={submitting.value}
                            onUploadingChange={setUploadingAttachments}
                        />
                    </div>
                )}
                <CommentInput
                    onSubmit={handleSubmit}
                    disabled={submitting.value || uploadingAttachments}
                    placeholder={target.type === 'group' ? t('comments.commentsSection.placeholderGroup') : t('comments.commentsSection.placeholderExpense')}
                />
            </div>
        </div>
    );
}
