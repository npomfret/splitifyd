import { PolicyIds, type CurrentPolicyResponse } from '@splitifyd/shared';
import { useEffect, useState } from 'preact/hooks';
import { ApiError, apiClient } from '../app/apiClient';
import { logError } from '../utils/browser-logger';

// Hook for fetching a single policy
export function usePolicy(policyId: keyof typeof PolicyIds) {
    const [policy, setPolicy] = useState<CurrentPolicyResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchPolicy = async () => {
            try {
                setLoading(true);
                setError(null);
                const policyData = await apiClient.getCurrentPolicy(PolicyIds[policyId], controller.signal);

                if (!controller.signal.aborted) {
                    setPolicy(policyData);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    // Don't log AbortError - these are expected when component unmounts
                    if (err instanceof ApiError && err.details instanceof Error && err.details.name === 'AbortError') {
                        return;
                    }
                    if (err instanceof Error && err.name === 'AbortError') {
                        return;
                    }

                    const errorMessage = err instanceof Error ? err.message : 'Failed to load policy';
                    setError(errorMessage);
                    logError('Failed to fetch policy', err as Error, { policyId });
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchPolicy();

        return () => {
            controller.abort();
        };
    }, [policyId]);

    return { policy, loading, error };
}
