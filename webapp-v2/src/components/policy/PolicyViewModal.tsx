import { apiClient } from '@/app/apiClient';
import { ErrorState, LoadingSpinner, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { XIcon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { logError } from '@/utils/browser-logger';
import type { PolicyId } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { PolicyRenderer } from './PolicyRenderer';

interface PolicyViewModalProps {
    policyId: PolicyId;
    policyName: string;
    open: boolean;
    onClose: () => void;
}

export function PolicyViewModal({ policyId, policyName, open, onClose }: PolicyViewModalProps) {
    const { t } = useTranslation();

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [contentSignal] = useState(() => signal<string | null>(null));
    const [loadingSignal] = useState(() => signal(false));
    const [errorSignal] = useState(() => signal<string | null>(null));

    // Extract signal values for use in render
    const content = contentSignal.value;
    const loading = loadingSignal.value;
    const error = errorSignal.value;

    useEffect(() => {
        if (open && !content) {
            loadContent();
        }
    }, [open, policyId]);

    const loadContent = async () => {
        loadingSignal.value = true;
        errorSignal.value = null;

        try {
            const policy = await apiClient.getCurrentPolicy(policyId);
            contentSignal.value = policy.text;
        } catch (err) {
            logError('Failed to load policy content', err as Error, { policyId });
            errorSignal.value = t('policyComponents.policyViewModal.loadError');
        } finally {
            loadingSignal.value = false;
        }
    };

    if (!open) {
        return null;
    }

    const titleId = 'policy-view-modal-title';

    return (
        <Modal
            open={open}
            onClose={onClose}
            size='lg'
            className='max-w-4xl max-h-[calc(100vh-4rem)] flex flex-col'
            labelledBy={titleId}
        >
            <div className='flex flex-col h-full min-h-0 overflow-hidden'>
                {/* Header */}
                <div className='shrink-0 flex items-center justify-between p-6 border-b border-border-default'>
                    <Typography variant='pageTitle' as='h2' id={titleId}>
                        {policyName}
                    </Typography>
                    <Clickable
                        as='button'
                        type='button'
                        onClick={onClose}
                        className='text-text-muted hover:text-text-primary transition-colors'
                        aria-label={t('common.close')}
                        eventName='modal_close'
                        eventProps={{ modalName: 'policy_view', policyId }}
                    >
                        <XIcon size={24} />
                    </Clickable>
                </div>

                {/* Content */}
                <div className='flex-1 min-h-0 overflow-y-auto p-6'>
                    {loading && (
                        <div className='flex items-center justify-center py-8'>
                            <LoadingSpinner />
                            <span className='ml-2 text-text-muted'>{t('policyComponents.policyViewModal.loading')}</span>
                        </div>
                    )}

                    {error && (
                        <ErrorState
                            title={t('policyComponents.policyViewModal.errorTitle')}
                            error={error}
                            onRetry={loadContent}
                        />
                    )}

                    {content && !loading && !error && (
                        <div
                            className='bg-surface-muted rounded-lg p-4'
                            role='article'
                            aria-label={policyName}
                        >
                            <PolicyRenderer content={content} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className='shrink-0 flex items-center justify-end p-6 border-t border-border-default'>
                    <Button variant='secondary' onClick={onClose}>
                        {t('common.close')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
