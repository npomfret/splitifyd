import { apiClient, type PolicyAcceptanceStatusDTO } from '@/app/apiClient.ts';
import { ErrorState, LoadingSpinner, Tooltip } from '@/components/ui';
import { logError } from '@/utils/browser-logger.ts';
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
    const [acceptedPolicies, setAcceptedPolicies] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPolicyIndex, setCurrentPolicyIndex] = useState(0);
    const [policyContents, setPolicyContents] = useState<Record<string, string>>({});
    const [loadingPolicy, setLoadingPolicy] = useState<string | null>(null);

    const currentPolicy = policies[currentPolicyIndex];
    const totalPolicies = policies.length;
    const isLastPolicy = currentPolicyIndex === totalPolicies - 1;
    const canAcceptCurrent = acceptedPolicies.has(currentPolicy?.policyId);
    const allPoliciesAccepted = policies.every((p) => acceptedPolicies.has(p.policyId));

    const loadPolicyContent = async (policyId: string) => {
        if (policyContents[policyId]) return; // Already loaded

        setLoadingPolicy(policyId);
        try {
            const policy = await apiClient.getCurrentPolicy(policyId);
            setPolicyContents((prev) => ({
                ...prev,
                [policyId]: policy.text,
            }));
        } catch (err) {
            logError('Failed to load policy content', err as Error, { policyId });
            setError(`Failed to load policy content: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoadingPolicy(null);
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
                submitAllPolicies();
            } else if (!isLastPolicy) {
                // Not the last policy - auto-advance to next
                const timer = setTimeout(() => {
                    setCurrentPolicyIndex((prev) => prev + 1);
                }, 500); // Small delay for UX (show checkmark briefly)
                return () => clearTimeout(timer);
            }
        }
    }, [canAcceptCurrent, isLastPolicy, allPoliciesAccepted, loading]);

    const handleAcceptPolicy = (policyId: string) => {
        setAcceptedPolicies((prev) => new Set([...prev, policyId]));
    };

    const handleNext = () => {
        if (!isLastPolicy) {
            setCurrentPolicyIndex((prev) => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentPolicyIndex > 0) {
            setCurrentPolicyIndex((prev) => prev - 1);
        }
    };

    const submitAllPolicies = async () => {
        setLoading(true);
        setError(null);

        try {
            const acceptances = policies.map((policy) => ({
                policyId: policy.policyId,
                versionHash: policy.currentVersionHash,
            }));

            await apiClient.acceptMultiplePolicies(acceptances);
            onAccept();
        } catch (err) {
            logError('Failed to accept policies', err as Error);
            setError(`Failed to accept policies: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    if (!currentPolicy) {
        return null;
    }

    const titleId = 'policy-modal-title';
    const subtitleId = 'policy-modal-subtitle';

    return (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50' data-testid='policy-modal-overlay'>
            <div
                className='bg-white border-primary-100 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col'
                role='dialog'
                aria-modal='true'
                aria-labelledby={titleId}
                aria-describedby={subtitleId}
                data-testid='policy-modal-card'
            >
                {/* Header */}
                <div className='flex items-center justify-between p-6 border-b border-primary-100' data-testid='policy-modal-header'>
                    <div>
                        <h2 className='text-2xl font-bold text-gray-900' id={titleId} data-testid='policy-modal-title'>
                            {t('policyComponents.policyAcceptanceModal.title')}
                        </h2>
                        <p className='text-sm text-gray-600 mt-1' id={subtitleId} data-testid='policy-modal-subtitle'>
                            {t('policyComponents.policyAcceptanceModal.policyLabel')}
                            {currentPolicyIndex + 1}
                            {t('policyComponents.policyAcceptanceModal.of')}
                            {totalPolicies}
                            {t('policyComponents.policyAcceptanceModal.colon')}
                            {currentPolicy.policyName}
                        </p>
                    </div>
                    {onClose && (
                        <Tooltip content={t('policyComponents.policyAcceptanceModal.closeAriaLabel')}>
                            <button onClick={onClose} className='text-gray-400 hover:text-gray-600 transition-colors' aria-label={t('policyComponents.policyAcceptanceModal.closeAriaLabel')}>
                                <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                                </svg>
                            </button>
                        </Tooltip>
                    )}
                </div>

                {/* Progress bar */}
                <div className='px-6 py-3 border-b border-gray-100' data-testid='policy-progress'>
                    <div className='flex items-center justify-between text-sm text-gray-500 mb-2' data-testid='policy-progress-summary'>
                        <span>{t('policyComponents.policyAcceptanceModal.progress')}</span>
                        <span>
                            {acceptedPolicies.size}
                            {t('policyComponents.policyAcceptanceModal.of')}
                            {totalPolicies}
                            {t('policyComponents.policyAcceptanceModal.accepted')}
                        </span>
                    </div>
                    <div
                        className='w-full bg-gray-200 rounded-full h-2'
                        role='progressbar'
                        aria-valuenow={acceptedPolicies.size}
                        aria-valuemin={0}
                        aria-valuemax={totalPolicies}
                        data-testid='policy-progress-track'
                    >
                        <div
                            className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                            style={{ width: `${(acceptedPolicies.size / totalPolicies) * 100}%` }}
                            data-testid='policy-progress-indicator'
                        />
                    </div>
                </div>

                {/* Policy content */}
                <div className='flex-1 overflow-y-auto p-6'>
                    <Container>
                        <Stack spacing='md'>
                            {error && <ErrorState title={t('policyComponents.policyAcceptanceModal.errorTitle')} error={error} onRetry={() => setError(null)} />}

                            <Card data-testid='policy-card'>
                                <Stack spacing='md'>
                                    <div className='flex items-center justify-between'>
                                        <h3 className='text-lg font-semibold text-gray-900' data-testid='current-policy-title'>
                                            {currentPolicy.policyName}
                                        </h3>
                                        {canAcceptCurrent && (
                                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' data-testid='policy-accepted-badge'>
                                                {t('policyComponents.policyAcceptanceModal.acceptedIcon')}
                                            </span>
                                        )}
                                    </div>

                                    {loadingPolicy === currentPolicy.policyId
                                        ? (
                                            <div className='flex items-center justify-center py-8' data-testid='policy-content-loading'>
                                                <LoadingSpinner />
                                                <span className='ml-2 text-gray-600'>{t('policyComponents.policyAcceptanceModal.loadingContent')}</span>
                                            </div>
                                        )
                                        : (
                                            <>
                                                <div className='bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto' data-testid='policy-content'>
                                                    <PolicyRenderer content={policyContents[currentPolicy.policyId] || ''} />
                                                </div>

                                                {!canAcceptCurrent && (
                                                    <div className='bg-blue-50 border border-blue-200 rounded-lg p-4' data-testid='policy-acceptance-section'>
                                                        <div className='flex items-start'>
                                                            <div className='flex-shrink-0'>
                                                                <svg className='w-5 h-5 text-blue-400 mt-0.5' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
                                                                    <path
                                                                        fillRule='evenodd'
                                                                        d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                                                                        clipRule='evenodd'
                                                                    />
                                                                </svg>
                                                            </div>
                                                            <div className='ml-3'>
                                                                <h4 className='text-sm font-medium text-blue-800'>{t('policyComponents.policyAcceptanceModal.acceptanceRequired')}</h4>
                                                                <p className='text-sm text-blue-700 mt-1'>{t('policyComponents.policyAcceptanceModal.acceptanceInstructions')}</p>
                                                            </div>
                                                        </div>

                                                        <div className='mt-4 flex items-center'>
                                                            <input
                                                                type='checkbox'
                                                                id={`accept-${currentPolicy.policyId}`}
                                                                className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                                                                autoComplete='off'
                                                                data-testid='policy-accept-checkbox'
                                                                onChange={(e) => {
                                                                    if (e.currentTarget.checked) {
                                                                        handleAcceptPolicy(currentPolicy.policyId);
                                                                    } else {
                                                                        setAcceptedPolicies((prev) => {
                                                                            const newSet = new Set(prev);
                                                                            newSet.delete(currentPolicy.policyId);
                                                                            return newSet;
                                                                        });
                                                                    }
                                                                }}
                                                            />
                                                            <label htmlFor={`accept-${currentPolicy.policyId}`} className='ml-2 text-sm text-blue-800' data-testid='policy-accept-label'>
                                                                {t('policyComponents.policyAcceptanceModal.acceptCheckbox')}
                                                                {currentPolicy.policyName.toLowerCase()}
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
                <div className='flex items-center justify-between p-6 border-t border-primary-100' data-testid='policy-modal-footer'>
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
                            <span className='text-sm text-gray-500' data-testid='policy-acceptance-count'>
                                {acceptedPolicies.size}
                                {t('policyComponents.policyAcceptanceModal.of')}
                                {policies.length}
                                {t('policyComponents.policyAcceptanceModal.policiesAccepted')}
                            </span>
                        )}
                        {loading && (
                            <div className='flex items-center gap-2' data-testid='policy-acceptance-loading'>
                                <LoadingSpinner size='sm' />
                                <span className='text-sm text-gray-600'>{t('policyComponents.policyAcceptanceModal.accepting')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
