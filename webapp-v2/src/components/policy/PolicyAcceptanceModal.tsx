import { useState, useEffect } from 'preact/hooks';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Stack } from '../ui/Stack';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorState } from '../ui/ErrorState';
import { Container } from '../ui/Container';
import { PolicyRenderer } from './PolicyRenderer';
import { apiClient, type PolicyAcceptanceStatus } from '../../app/apiClient';
import { logError } from '../../utils/browser-logger';

interface PolicyAcceptanceModalProps {
  policies: PolicyAcceptanceStatus[];
  onAccept: () => void;
  onClose?: () => void;
}

export function PolicyAcceptanceModal({ policies, onAccept, onClose }: PolicyAcceptanceModalProps) {
  const [acceptedPolicies, setAcceptedPolicies] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPolicyIndex, setCurrentPolicyIndex] = useState(0);
  const [policyContents, setPolicyContents] = useState<Record<string, string>>({});
  const [loadingPolicy, setLoadingPolicy] = useState<string | null>(null);

  const currentPolicy = policies[currentPolicyIndex];
  const isLastPolicy = currentPolicyIndex === policies.length - 1;
  const canAcceptCurrent = acceptedPolicies.has(currentPolicy?.policyId);
  const allPoliciesAccepted = policies.every(p => acceptedPolicies.has(p.policyId));

  const loadPolicyContent = async (policyId: string) => {
    if (policyContents[policyId]) return; // Already loaded

    setLoadingPolicy(policyId);
    try {
      const policy = await apiClient.getCurrentPolicy(policyId);
      setPolicyContents(prev => ({
        ...prev,
        [policyId]: policy.text
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

  const handleAcceptPolicy = (policyId: string) => {
    setAcceptedPolicies(prev => new Set([...prev, policyId]));
  };

  const handleNext = () => {
    if (!isLastPolicy) {
      setCurrentPolicyIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPolicyIndex > 0) {
      setCurrentPolicyIndex(prev => prev - 1);
    }
  };

  const handleAcceptAll = async () => {
    setLoading(true);
    setError(null);

    try {
      const acceptances = policies.map(policy => ({
        policyId: policy.policyId,
        versionHash: policy.currentVersionHash
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Accept Updated Policies
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Policy {currentPolicyIndex + 1} of {policies.length}: {currentPolicy.policyName}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Progress</span>
            <span>{acceptedPolicies.size} of {policies.length} accepted</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(acceptedPolicies.size / policies.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Policy content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Container>
            <Stack spacing="md">
              {error && (
                <ErrorState 
                  title="Error"
                  error={error}
                  onRetry={() => setError(null)}
                />
              )}

              <Card>
                <Stack spacing="md">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {currentPolicy.policyName}
                    </h3>
                    {canAcceptCurrent && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Accepted
                      </span>
                    )}
                  </div>

                  {loadingPolicy === currentPolicy.policyId ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner />
                      <span className="ml-2 text-gray-600">Loading policy content...</span>
                    </div>
                  ) : (
                    <>
                      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <PolicyRenderer content={policyContents[currentPolicy.policyId] || ''} />
                      </div>

                      {!canAcceptCurrent && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-blue-800">
                                Policy Acceptance Required
                              </h4>
                              <p className="text-sm text-blue-700 mt-1">
                                Please read the policy above and click "Accept" to continue using Splitify.
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex items-center">
                            <input
                              type="checkbox"
                              id={`accept-${currentPolicy.policyId}`}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              onChange={(e) => {
                                if (e.currentTarget.checked) {
                                  handleAcceptPolicy(currentPolicy.policyId);
                                } else {
                                  setAcceptedPolicies(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(currentPolicy.policyId);
                                    return newSet;
                                  });
                                }
                              }}
                            />
                            <label htmlFor={`accept-${currentPolicy.policyId}`} className="ml-2 text-sm text-blue-800">
                              I have read and accept this {currentPolicy.policyName.toLowerCase()}
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

        {/* Footer with navigation and actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handlePrevious}
              disabled={currentPolicyIndex === 0}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              onClick={handleNext}
              disabled={isLastPolicy || !canAcceptCurrent}
            >
              Next
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {policies.length > 1 && (
              <span className="text-sm text-gray-500">
                {acceptedPolicies.size} of {policies.length} policies accepted
              </span>
            )}
            <Button
              onClick={handleAcceptAll}
              disabled={!allPoliciesAccepted || loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Accepting...</span>
                </>
              ) : (
                'Accept All & Continue'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}