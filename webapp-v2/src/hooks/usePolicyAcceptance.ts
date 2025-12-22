import { useEffect, useRef, useState } from 'preact/hooks';
import { apiClient, type PolicyAcceptanceStatusDTO } from '../app/apiClient';
import { useAuth } from '@/app/hooks';
import { logError } from '../utils/browser-logger';

interface PolicyAcceptanceState {
    needsAcceptance: boolean;
    pendingPolicies: PolicyAcceptanceStatusDTO[];
    totalPending: number;
    loading: boolean;
    error: string | null;
    refreshPolicyStatus: () => Promise<void>;
}

export function usePolicyAcceptance(): PolicyAcceptanceState {
    const authStore = useAuth();
    const user = authStore?.user;
    const authLoading = authStore?.loading ?? false;
    const [needsAcceptance, setNeedsAcceptance] = useState(false);
    const [pendingPolicies, setPendingPolicies] = useState<PolicyAcceptanceStatusDTO[]>([]);
    const [totalPending, setTotalPending] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track current request to allow cancellation
    const currentController = useRef<AbortController | null>(null);

    const refreshPolicyStatus = async () => {
        if (!user || authLoading) {
            // Reset state when no user
            setNeedsAcceptance(false);
            setPendingPolicies([]);
            setTotalPending(0);
            setError(null);
            return;
        }

        // Cancel any existing request
        if (currentController.current) {
            currentController.current.abort();
        }

        // Create new controller for this request
        currentController.current = new AbortController();
        const controller = currentController.current;

        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.getUserPolicyStatusWithAbort(controller.signal);

            // Only update state if this request wasn't aborted
            if (!controller.signal.aborted) {
                setNeedsAcceptance(response.needsAcceptance);
                setPendingPolicies(response.policies.filter((p: PolicyAcceptanceStatusDTO) => p.needsAcceptance));
                setTotalPending(response.totalPending);
            }
        } catch (err) {
            // Only handle error if this request wasn't aborted
            if (!controller.signal.aborted) {
                // Don't log AbortError - these are expected when requests are cancelled
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }

                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                setError(errorMessage);
                logError('Failed to check policy acceptance status', err as Error, {
                    userId: user?.uid,
                });

                // On error, assume no policies need acceptance to avoid blocking the user
                setNeedsAcceptance(false);
                setPendingPolicies([]);
                setTotalPending(0);
            }
        } finally {
            // Only update loading state if this request wasn't aborted
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    };

    // Check policy status when user changes or component mounts
    useEffect(() => {
        refreshPolicyStatus();

        // Cleanup function to abort any in-flight requests
        return () => {
            if (currentController.current) {
                currentController.current.abort();
                currentController.current = null;
            }
        };
    }, [user]);

    // Automatic refresh every 5 minutes when user is active
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(
            () => {
                // Only refresh if the page is visible (user is active)
                if (!document.hidden) {
                    refreshPolicyStatus();
                }
            },
            5 * 60 * 1000,
        ); // 5 minutes

        return () => clearInterval(interval);
    }, [user]);

    // Refresh when page becomes visible (user comes back to tab)
    useEffect(() => {
        if (!user) return;

        const handleVisibilityChange = () => {
            if (!document.hidden && needsAcceptance) {
                refreshPolicyStatus();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [user, needsAcceptance]);

    return {
        needsAcceptance,
        pendingPolicies,
        totalPending,
        loading,
        error,
        refreshPolicyStatus,
    };
}
