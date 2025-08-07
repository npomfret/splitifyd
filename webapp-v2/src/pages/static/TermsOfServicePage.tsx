import { StaticPageLayout } from '../../components/StaticPageLayout';

export function TermsOfServicePage() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const canonical = `${baseUrl}/v2/terms`;
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Terms of Service - Splitifyd",
    "description": "Terms of Service for Splitifyd - Read about our policies and user agreements.",
    "url": canonical,
    "dateModified": "2025-01-22",
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
          Last updated: January 22, 2025
        </div>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
          <p class="text-gray-700">
            By accessing and using Splitifyd ("the Service"), you accept and agree to be bound by the terms 
            and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">2. Use License</h2>
          <p class="text-gray-700 mb-3">
            Permission is granted to temporarily download one copy of Splitifyd per device for personal, 
            non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul class="list-disc list-inside text-gray-700 space-y-1">
            <li>modify or copy the materials</li>
            <li>use the materials for any commercial purpose or for any public display</li>
            <li>attempt to reverse engineer any software contained in Splitifyd</li>
            <li>remove any copyright or other proprietary notations from the materials</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">3. User Accounts</h2>
          <p class="text-gray-700">
            When you create an account with us, you must provide information that is accurate, complete, and current at all times. 
            You are responsible for safeguarding the password and for all activities that occur under your account.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">4. Privacy Policy</h2>
          <p class="text-gray-700">
            Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Service, 
            to understand our practices.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">5. Prohibited Uses</h2>
          <p class="text-gray-700 mb-3">You may not use our service:</p>
          <ul class="list-disc list-inside text-gray-700 space-y-1">
            <li>For any unlawful purpose or to solicit others to unlawful acts</li>
            <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
            <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
            <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
            <li>To submit false or misleading information</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">6. Limitation of Liability</h2>
          <p class="text-gray-700">
            In no event shall Splitifyd or its suppliers be liable for any damages (including, without limitation, 
            damages for loss of data or profit, or due to business interruption) arising out of the use or inability 
            to use the materials on Splitifyd, even if Splitifyd or an authorized representative has been notified 
            orally or in writing of the possibility of such damage.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">7. Changes to Terms</h2>
          <p class="text-gray-700">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. 
            If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">8. Contact Information</h2>
          <p class="text-gray-700">
            If you have any questions about these Terms of Service, please contact us at: terms@splitifyd.com
          </p>
        </section>
      </div>
    </StaticPageLayout>
  );
}