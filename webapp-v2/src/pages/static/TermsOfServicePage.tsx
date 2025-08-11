import { StaticPageLayout } from '../../components/StaticPageLayout';
import { usePolicy } from '../../hooks/usePolicy';
import { PolicyRenderer } from '../../components/policy/PolicyRenderer';

export function TermsOfServicePage() {
  const { policy, loading, error } = usePolicy('TERMS_OF_SERVICE');
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const canonical = `${baseUrl}/terms`;
  
  // Use policy creation date if available, fallback to static date
  const lastUpdated = policy?.createdAt ? new Date(policy.createdAt).toLocaleDateString() : 'January 22, 2025';
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Terms of Service - Splitifyd",
    "description": "Terms of Service for Splitifyd - Read about our policies and user agreements.",
    "url": canonical,
    "dateModified": lastUpdated,
    "publisher": {
      "@type": "Organization",
      "name": "Splitifyd"
    }
  };

  return (
    <StaticPageLayout 
      title="Terms of Service" 
      description="Terms of Service for Splitifyd - Read about our policies and user agreements."
      canonical={canonical}
      structuredData={structuredData}
    >
      <div class="space-y-6">
        <div class="text-sm text-gray-500 mb-8">
          Last updated: {lastUpdated}
        </div>

        {loading && (
          <div class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {error && (
          <div class="bg-red-50 border border-red-200 rounded-md p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Error loading terms</h3>
                <div class="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {policy && <PolicyRenderer content={policy.text} />}
      </div>
    </StaticPageLayout>
  );
}

