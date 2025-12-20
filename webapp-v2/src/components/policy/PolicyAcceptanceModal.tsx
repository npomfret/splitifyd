import { apiClient, type PolicyAcceptanceStatusDTO } from '@/app/apiClient.ts';
import { Badge, ErrorState, LoadingSpinner, Tooltip, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { InfoCircleIcon, XIcon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { logError } from '@/utils/browser-logger.ts';
import { PolicyId } from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Container } from '../ui/Container';
import { Stack } from '../ui/Stack';
import { PolicyRenderer } from './PolicyRenderer';

interface PolicyAcceptanceModalProps {
    policies: PolicyAcceptanceStatusDTO[];
    onAccept: () => void;
    onClose?: () => void;
}

export function PolicyAcceptanceModal({ policies, onAccept, onClose }: PolicyAcceptanceModalProps) {
    const { t } = useTranslation();

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [acceptedPoliciesSignal] = useState(() => signal<Set<string>>(new Set()));
    const [loadingSignal] = useState(() => signal(false));
    const [errorSignal] = useState(() => signal<string | null>(null));
    const [currentPolicyIndexSignal] = useState(() => signal(0));
    const [policyContentsSignal] = useState(() => signal<Record<string, string>>({}));
    const [loadingPolicySignal] = useState(() => signal<string | null>(null));

    // Extract signal values for use in render
    const acceptedPolicies = acceptedPoliciesSignal.value;
    const loading = loadingSignal.value;
    const error = errorSignal.value;
    const currentPolicyIndex = currentPolicyIndexSignal.value;
    const policyContents = policyContentsSignal.value;
    const loadingPolicy = loadingPolicySignal.value;

    const currentPolicy = policies[currentPolicyIndex];
    const totalPolicies = policies.length;
    const isLastPolicy = currentPolicyIndex === totalPolicies - 1;
    const canAcceptCurrent = acceptedPolicies.has(currentPolicy?.policyId);
    const allPoliciesAccepted = policies.every((p) => acceptedPolicies.has(p.policyId));

    const loadPolicyContent = async (policyId: PolicyId) => {
        if (policyContents[policyId]) return; // Already loaded

        loadingPolicySignal.value = policyId;
        try {
            const policy = await apiClient.getCurrentPolicy(policyId);
            policyContentsSignal.value = {
                ...policyContentsSignal.value,
                [policyId]: policy.text,
            };
        } catch (err) {
            logError('Failed to load policy content', err as Error, { policyId });
            errorSignal.value = `Failed to load policy content: ${err instanceof Error ? err.message : 'Unknown error'}`;
        } finally {
            loadingPolicySignal.value = null;
        }
    };

    // Load current policy content when component mounts or policy changes
    useEffect(() => {
        if (currentPolicy) {
            loadPolicyContent(currentPolicy.policyId);
        }
    }, [currentPolicy?.policyId]);

    // Auto-advance to next policy or submit when last policy is accepted
    useEffect(() => {
        if (canAcceptCurrent && !loading) {
            if (isLastPolicy && allPoliciesAccepted) {
                // All policies accepted - submit automatically
                void submitAllPolicies();
            } else if (!isLastPolicy) {
                // Not the last policy - auto-advance to next
                const timer = setTimeout(() => {
                    currentPolicyIndexSignal.value = currentPolicyIndexSignal.value + 1;
                }, 500); // Small delay for UX (show checkmark briefly)
                return () => clearTimeout(timer);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canAcceptCurrent, isLastPolicy, allPoliciesAccepted, loading]);

    const handleAcceptPolicy = (policyId: string) => {
        acceptedPoliciesSignal.value = new Set([...acceptedPoliciesSignal.value, policyId]);
    };

    const handleNext = () => {
        if (!isLastPolicy) {
            currentPolicyIndexSignal.value = currentPolicyIndexSignal.value + 1;
        }
    };

    const handlePrevious = () => {
        if (currentPolicyIndex > 0) {
            currentPolicyIndexSignal.value = currentPolicyIndexSignal.value - 1;
        }
    };

    const submitAllPolicies = async () => {
        loadingSignal.value = true;
        errorSignal.value = null;

        try {
            const acceptances = policies.map((policy) => ({
                policyId: policy.policyId,
                versionHash: policy.currentVersionHash,
            }));

            await apiClient.acceptMultiplePolicies(acceptances);

            // Wait a moment for the backend to process the write
            await new Promise(resolve => setTimeout(resolve, 500));

            // Now refresh policy status to confirm the acceptance
            await onAccept();
        } catch (err) {
            logError('Failed to accept policies', err as Error);
            errorSignal.value = `Failed to accept policies: ${err instanceof Error ? err.message : 'Unknown error'}`;
        } finally {
            loadingSignal.value = false;
        }
    };

    if (!currentPolicy) {
        return null;
    }

    const titleId = 'policy-modal-title';
    const subtitleId = 'policy-modal-subtitle';

    return (
        <Modal
            open={true}
            onClose={onClose}
            size='lg'
            className='max-w-4xl max-h-[calc(100vh-4rem)] flex flex-col'
            labelledBy={titleId}
            describedBy={subtitleId}
        >
            <div className='flex flex-col h-full min-h-0 overflow-hidden'>
                {/* Header */}
                <div className='shrink-0 flex items-center justify-between p-6 border-b border-border-default'>
                    <div>
                        <Typography variant='pageTitle' as='h2' id={titleId}>
                            {t('policyComponents.policyAcceptanceModal.title')}
                        </Typography>
                        <p className='help-text mt-1' id={subtitleId}>
                            {t('policyComponents.policyAcceptanceModal.policyLabel')}
                            {currentPolicyIndex + 1}
                            {t('policyComponents.policyAcceptanceModal.of')}
                            {totalPolicies}
                            {t('policyComponents.policyAcceptanceModal.colon')}
                            {currentPolicy.policyName}
                        </p>
                    </div>
                    {onClose && (
                        <Tooltip content={t('policyComponents.policyAcceptanceModal.closeAriaLabel')} showOnFocus={false}>
                            <Clickable
                                as='button'
                                type='button'
                                onClick={onClose}
                                className='text-text-muted hover:text-text-primary transition-colors'
                                aria-label={t('policyComponents.policyAcceptanceModal.closeAriaLabel')}
                                eventName='modal_close'
                                eventProps={{ modalName: 'policy_acceptance', method: 'x_button' }}
                            >
                                <XIcon size={24} />
                            </Clickable>
                        </Tooltip>
                    )}
                </div>

                {/* Progress bar */}
                <div className='shrink-0 px-6 py-3 border-b border-border-default'>
                    <div className='flex items-center justify-between help-text mb-2'>
                        <span>{t('policyComponents.policyAcceptanceModal.progress')}</span>
                        <span>
                            {acceptedPolicies.size}
                            {t('policyComponents.policyAcceptanceModal.of')}
                            {totalPolicies}
                            {t('policyComponents.policyAcceptanceModal.accepted')}
                        </span>
                    </div>
                    <div
                        className='w-full bg-surface-muted rounded-full h-2'
                        role='progressbar'
                        aria-valuenow={acceptedPolicies.size}
                        aria-valuemin={0}
                        aria-valuemax={totalPolicies}
                    >
                        <div
                            className='bg-interactive-primary h-2 rounded-full transition-all duration-300'
                            style={{ width: `${(acceptedPolicies.size / totalPolicies) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Policy content */}
                <div className='flex-1 min-h-0 overflow-y-auto p-6'>
                    <Container>
                        <Stack spacing='md'>
                            {error && (
                                <ErrorState
                                    title={t('policyComponents.policyAcceptanceModal.errorTitle')}
                                    error={error}
                                    onRetry={() => {
                                        errorSignal.value = null;
                                    }}
                                />
                            )}

                            <Card ariaLabel={currentPolicy.policyName}>
                                <Stack spacing='md'>
                                    <div className='flex items-center justify-between'>
                                        <h3 className='text-lg font-semibold text-text-primary'>
                                            {currentPolicy.policyName}
                                        </h3>
                                        {canAcceptCurrent && (
                                            <Badge
                                                variant='success'
                                                role='status'
                                                aria-label={t('policyComponents.policyAcceptanceModal.acceptedAriaLabel') || 'Accepted'}
                                            >
                                                {t('policyComponents.policyAcceptanceModal.acceptedIcon')}
                                            </Badge>
                                        )}
                                    </div>

                                    {loadingPolicy === currentPolicy.policyId
                                        ? (
                                            <div className='flex items-center justify-center py-8'>
                                                <LoadingSpinner />
                                                <span className='ml-2 text-text-muted'>{t('policyComponents.policyAcceptanceModal.loadingContent')}</span>
                                            </div>
                                        )
                                        : (
                                            <>
                                                <div
                                                    className='bg-surface-muted rounded-lg p-4 max-h-96 overflow-y-auto'
                                                    role='article'
                                                    aria-label={t('policyComponents.policyAcceptanceModal.policyContentAriaLabel')}
                                                >
                                                    <PolicyRenderer content={policyContents[currentPolicy.policyId] || ''} />
                                                </div>

                                                {!canAcceptCurrent && (
                                                    <div className='bg-semantic-info-subtle border border-semantic-info rounded-lg p-4' role='group' aria-labelledby='acceptance-required-heading'>
                                                        <div className='flex items-start'>
                                                            <div className='shrink-0'>
                                                                <InfoCircleIcon size={20} className='text-semantic-info mt-0.5' />
                                                            </div>
                                                            <div className='ml-3'>
                                                                <h4 id='acceptance-required-heading' className='text-sm font-medium text-semantic-info-emphasis'>
                                                                    {t('policyComponents.policyAcceptanceModal.acceptanceRequired')}
                                                                </h4>
                                                                <p className='text-sm text-semantic-info-emphasis mt-1'>{t('policyComponents.policyAcceptanceModal.acceptanceInstructions')}</p>
                                                            </div>
                                                        </div>

                                                        <div className='mt-4 flex items-center'>
                                                            <input
                                                                type='checkbox'
                                                                id={`accept-${currentPolicy.policyId}`}
                                                                className='h-4 w-4 text-interactive-primary focus:ring-interactive-primary border-border-default rounded'
                                                                autoComplete='off'
                                                                onChange={(e) => {
                                                                    if (
                                                                        e
                                                                            .currentTarget
                                                                            .checked
                                                                    ) {
                                                                        handleAcceptPolicy(
                                                                            currentPolicy
                                                                                .policyId,
                                                                        );
                                                                    } else {
                                                                        const newSet = new Set(
                                                                            acceptedPoliciesSignal
                                                                                .value,
                                                                        );
                                                                        newSet
                                                                            .delete(
                                                                                currentPolicy
                                                                                    .policyId,
                                                                            );
                                                                        acceptedPoliciesSignal
                                                                            .value = newSet;
                                                                    }
                                                                }}
                                                            />
                                                            <label htmlFor={`accept-${currentPolicy.policyId}`} className='ml-2 text-sm text-semantic-info-emphasis'>
                                                                {t('policyComponents.policyAcceptanceModal.acceptCheckbox')}
                                                                {currentPolicy
                                                                    .policyName
                                                                    .toLowerCase()}
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                </Stack>
                            </Card>
                        </Stack>
                    </Container>
                </div>

                {/* Footer with navigation */}
                <div className='shrink-0 flex items-center justify-between p-6 border-t border-border-default'>
                    <div className='flex items-center gap-2'>
                        <Button variant='secondary' onClick={handlePrevious} disabled={currentPolicyIndex === 0 || loading}>
                            {t('policyComponents.policyAcceptanceModal.previous')}
                        </Button>
                        <Button variant='secondary' onClick={handleNext} disabled={isLastPolicy || !canAcceptCurrent || loading}>
                            {t('policyComponents.policyAcceptanceModal.next')}
                        </Button>
                    </div>

                    <div className='flex items-center gap-2'>
                        {policies.length > 1 && (
                            <span className='help-text'>
                                {acceptedPolicies.size}
                                {t('policyComponents.policyAcceptanceModal.of')}
                                {policies.length}
                                {t('policyComponents.policyAcceptanceModal.policiesAccepted')}
                            </span>
                        )}
                        {loading && (
                            <div className='flex items-center gap-2'>
                                <LoadingSpinner size='sm' />
                                <span className='help-text'>{t('policyComponents.policyAcceptanceModal.accepting')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
