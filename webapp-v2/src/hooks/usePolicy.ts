import { useState, useEffect } from 'preact/hooks';
import { logError } from '../utils/browser-logger';
import { PolicyIds } from '@splitifyd/shared';

interface PolicyResponse {
    id: string;
    policyName: string;
    currentVersionHash: string;
    text: string;
    createdAt: string;
}

async function fetchCurrentPolicy(policyId: string, signal?: AbortSignal): Promise<PolicyResponse> {
    const response = await fetch('/api/policies/' + policyId + '/current', { signal });
    if (!response.ok) {
        throw new Error('Failed to fetch policy ' + policyId + ': ' + response.status);
    }
    return response.json();
}

// Hook for fetching a single policy
export function usePolicy(policyId: keyof typeof PolicyIds) {
    const [policy, setPolicy] = useState<PolicyResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchPolicy = async () => {
            try {
                setLoading(true);
                setError(null);
                const policyData = await fetchCurrentPolicy(PolicyIds[policyId], controller.signal);

                if (!controller.signal.aborted) {
                    setPolicy(policyData);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    // Don't log AbortError - these are expected when component unmounts
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
