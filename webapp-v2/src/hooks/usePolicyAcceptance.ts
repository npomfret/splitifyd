import { useState, useEffect } from 'preact/hooks';
import { apiClient, type PolicyAcceptanceStatus } from '../app/apiClient';
import { logError } from '../utils/browser-logger';
import { useAuth } from '../app/hooks/useAuth';

interface PolicyAcceptanceState {
    needsAcceptance: boolean;
    pendingPolicies: PolicyAcceptanceStatus[];
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
    const [pendingPolicies, setPendingPolicies] = useState<PolicyAcceptanceStatus[]>([]);
    const [totalPending, setTotalPending] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshPolicyStatus = async () => {
        if (!user || authLoading) {
            // Reset state when no user
            setNeedsAcceptance(false);
            setPendingPolicies([]);
            setTotalPending(0);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.getUserPolicyStatus();

            setNeedsAcceptance(response.needsAcceptance);
            setPendingPolicies(response.policies.filter((p: PolicyAcceptanceStatus) => p.needsAcceptance));
            setTotalPending(response.totalPending);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            logError('Failed to check policy acceptance status', err as Error, {
                userId: user?.uid,
            });

            // On error, assume no policies need acceptance to avoid blocking the user
            setNeedsAcceptance(false);
            setPendingPolicies([]);
            setTotalPending(0);
        } finally {
            setLoading(false);
        }
    };

    // Check policy status when user changes or component mounts
    useEffect(() => {
        refreshPolicyStatus();
    }, [user, authLoading]);

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
