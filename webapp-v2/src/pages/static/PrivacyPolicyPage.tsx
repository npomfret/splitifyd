import { StaticPageLayout } from '../../components/StaticPageLayout';

export function PrivacyPolicyPage() {
  const baseUrl = import.meta.env.PROD ? 'https://splitifyd.com' : 'http://localhost:6002';
  const canonical = `${baseUrl}/v2/privacy`;
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Privacy Policy - Splitifyd",
    "description": "Privacy Policy for Splitifyd - Learn how we collect, use, and protect your data.",
    "url": canonical,
    "dateModified": "2025-01-22",
    "publisher": {
      "@type": "Organization",
      "name": "Splitifyd"
    },
    "mainEntity": {
      "@type": "PrivacyPolicy",
      "name": "Splitifyd Privacy Policy",
      "dateModified": "2025-01-22"
    }
  };

  return (
    <StaticPageLayout 
      title="Privacy Policy" 
      description="Privacy Policy for Splitifyd - Learn how we collect, use, and protect your data."
      canonical={canonical}
      structuredData={structuredData}
    >
      <div class="space-y-6">
        <div class="text-sm text-gray-500 mb-8">
          Last updated: January 22, 2025
        </div>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
          <p class="text-gray-700 mb-3">
            We collect information you provide directly to us, such as when you create an account, 
            add expenses, or contact us for support.
          </p>
          
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Personal Information</h3>
          <ul class="list-disc list-inside text-gray-700 space-y-1 mb-3">
            <li>Name and email address</li>
            <li>Profile information you choose to provide</li>
            <li>Expense and group data you create</li>
            <li>Communications you send to us</li>
          </ul>

          <h3 class="text-lg font-semibold text-gray-900 mb-2">Automatically Collected Information</h3>
          <ul class="list-disc list-inside text-gray-700 space-y-1">
            <li>Device information (IP address, browser type, operating system)</li>
            <li>Usage data (pages viewed, features used, time spent)</li>
            <li>Cookies and similar tracking technologies</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
          <p class="text-gray-700 mb-3">We use the information we collect to:</p>
          <ul class="list-disc list-inside text-gray-700 space-y-1">
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send notifications</li>
            <li>Respond to your comments, questions, and customer service requests</li>
            <li>Send you technical notices, updates, and security alerts</li>
            <li>Monitor and analyze trends, usage, and activities</li>
            <li>Detect, investigate, and prevent fraudulent or unauthorized activity</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">3. Information Sharing</h2>
          <p class="text-gray-700 mb-3">
            We do not sell, trade, or otherwise transfer your personal information to third parties except as described in this policy:
          </p>
          
          <h3 class="text-lg font-semibold text-gray-900 mb-2">With Other Users</h3>
          <p class="text-gray-700 mb-3">
            When you join a group or add expenses, your name and relevant expense information is shared with other group members.
          </p>

          <h3 class="text-lg font-semibold text-gray-900 mb-2">Service Providers</h3>
          <p class="text-gray-700 mb-3">
            We may share information with trusted service providers who assist us in operating our service, 
            such as hosting, analytics, and customer support.
          </p>

          <h3 class="text-lg font-semibold text-gray-900 mb-2">Legal Requirements</h3>
          <p class="text-gray-700">
            We may disclose information if required by law or if we believe such disclosure is necessary to protect our rights or comply with legal process.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">4. Data Security</h2>
          <p class="text-gray-700">
            We implement appropriate technical and organizational measures to protect your personal information against 
            unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet 
            or electronic storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">5. Your Rights</h2>
          <p class="text-gray-700 mb-3">
            Depending on your location, you may have certain rights regarding your personal information:
          </p>
          <ul class="list-disc list-inside text-gray-700 space-y-1">
            <li>Access to your personal information</li>
            <li>Correction of inaccurate information</li>
            <li>Deletion of your personal information</li>
            <li>Portability of your data</li>
            <li>Objection to processing</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">6. Data Retention</h2>
          <p class="text-gray-700">
            We retain your personal information for as long as necessary to provide our services and for legitimate business purposes. 
            When you delete your account, we will delete your personal information, though some information may be retained for legal or safety reasons.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">7. Cookies</h2>
          <p class="text-gray-700">
            We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. 
            You can control cookie preferences through your browser settings. For more information, see our Cookie Policy.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">8. Changes to This Policy</h2>
          <p class="text-gray-700">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
            Privacy Policy on this page and updating the "Last updated" date.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">9. Contact Us</h2>
          <p class="text-gray-700">
            If you have any questions about this Privacy Policy, please contact us at: privacy@splitifyd.com
          </p>
        </section>
      </div>
    </StaticPageLayout>
  );
}