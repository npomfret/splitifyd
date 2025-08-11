import { useState, useEffect } from 'preact/hooks';
import { logError } from '../utils/browser-logger';
import { PolicyIds } from '@shared/shared-types';

// Policy-related types
interface PolicySummary {
  policyName: string;
  currentVersionHash: string;
}

interface CurrentPoliciesResponse {
  policies: Record<string, PolicySummary>;
  count: number;
}

interface PolicyResponse {
  id: string;
  policyName: string;
  currentVersionHash: string;
  text: string;
  createdAt: string;
}

// API base URL from window
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return '/api';
  }
  
  const apiBaseUrl = (window as any).API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error('API_BASE_URL is not set - check build configuration');
  }
  return apiBaseUrl + '/api';
};

// Policy fetch functions
async function fetchCurrentPolicies(): Promise<CurrentPoliciesResponse> {
  const response = await fetch(getApiBaseUrl() + '/policies/current');
  if (!response.ok) {
    throw new Error('Failed to fetch policies: ' + response.status);
  }
  return response.json();
}

async function fetchCurrentPolicy(policyId: string): Promise<PolicyResponse> {
  const response = await fetch(getApiBaseUrl() + '/policies/' + policyId + '/current');
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
    let cancelled = false;
    
    const fetchPolicy = async () => {
      try {
        setLoading(true);
        setError(null);
        const policyData = await fetchCurrentPolicy(PolicyIds[policyId]);
        
        if (!cancelled) {
          setPolicy(policyData);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load policy';
          setError(errorMessage);
          logError('Failed to fetch policy', err as Error, { policyId });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPolicy();
    
    return () => {
      cancelled = true;
    };
  }, [policyId]);

  return { policy, loading, error };
}

// Hook for fetching all policies
export function usePolicies() {
  const [policies, setPolicies] = useState<CurrentPoliciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    const fetchPolicies = async () => {
      try {
        setLoading(true);
        setError(null);
        const policiesData = await fetchCurrentPolicies();
        
        if (!cancelled) {
          setPolicies(policiesData);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load policies';
          setError(errorMessage);
          logError('Failed to fetch policies', err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPolicies();
    
    return () => {
      cancelled = true;
    };
  }, []);

  return { policies, loading, error };
}
