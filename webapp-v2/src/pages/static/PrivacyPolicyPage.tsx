import { StaticPageLayout } from '../../components/StaticPageLayout';
import { usePolicy } from '../../hooks/usePolicy';
import { PolicyRenderer } from '../../components/policy/PolicyRenderer';

export function PrivacyPolicyPage() {
  const { policy, loading, error } = usePolicy('privacy-policy');
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const canonical = `${baseUrl}/privacy-policy`;
  
  // Use policy creation date if available, fallback to static date
  const lastUpdated = policy?.createdAt ? new Date(policy.createdAt).toLocaleDateString() : 'January 22, 2025';
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Privacy Policy - Splitifyd",
    "description": "Privacy Policy for Splitifyd - Learn about how we collect, use, and protect your information.",
    "url": canonical,
    "dateModified": lastUpdated,
    "publisher": {
      "@type": "Organization",
      "name": "Splitifyd"
    }
  };

  return (
    <StaticPageLayout 
      title="Privacy Policy" 
      description="Privacy Policy for Splitifyd - Learn about how we collect, use, and protect your information."
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
                <h3 class="text-sm font-medium text-red-800">Error loading privacy policy</h3>
                <div class="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {policy && <PolicyRenderer markdown={policy.text} />}
      </div>
    </StaticPageLayout>
  );
}
