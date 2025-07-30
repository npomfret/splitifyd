import { StaticPageLayout } from '../../components/StaticPageLayout';

export function CookiePolicyPage() {
  const baseUrl = window.location.origin;
  const canonical = `${baseUrl}/v2/cookies`;
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Cookie Policy - Splitifyd",
    "description": "Cookie Policy for Splitifyd - Learn about how we use cookies and similar technologies.",
    "url": canonical,
    "dateModified": "2025-01-22",
    "publisher": {
      "@type": "Organization",
      "name": "Splitifyd"
    }
  };

  return (
    <StaticPageLayout 
      title="Cookie Policy" 
      description="Cookie Policy for Splitifyd - Learn about how we use cookies and similar technologies."
      canonical={canonical}
      structuredData={structuredData}
    >
      <div class="space-y-6">
        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Introduction</h2>
          <p class="text-gray-700 mb-3">
            This Cookie Policy explains how we ("we," "us," or "our") use cookies and similar technologies when you visit our website and use our services. By using our website, you consent to the use of cookies as described in this policy.
          </p>
          <p class="text-gray-700">
            <strong>Last updated:</strong> January 2025
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">What Are Cookies?</h2>
          <p class="text-gray-700">
            Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit our website. They help us provide you with a better experience by remembering your preferences and enabling essential functionality.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Types of Cookies We Use</h2>
          
          <div class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Essential Cookies</h3>
              <p class="text-gray-700 mb-2">
                These cookies are necessary for the website to function properly and cannot be disabled. They enable core functionality such as:
              </p>
              <ul class="list-disc list-inside text-gray-700 space-y-1">
                <li>User authentication and session management</li>
                <li>Security and fraud prevention</li>
                <li>Load balancing and server performance</li>
                <li>Remembering your login state</li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Functional Cookies</h3>
              <p class="text-gray-700 mb-2">
                These cookies enhance your experience by remembering your preferences and settings, such as:
              </p>
              <ul class="list-disc list-inside text-gray-700 space-y-1">
                <li>Language and region preferences</li>
                <li>Display preferences and themes</li>
                <li>Form data to prevent data loss</li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Analytics and Performance Cookies</h3>
              <p class="text-gray-700 mb-2">
                We may use these cookies to understand how visitors interact with our website, helping us improve our services:
              </p>
              <ul class="list-disc list-inside text-gray-700 space-y-1 mb-2">
                <li>Page views and user navigation patterns</li>
                <li>Error tracking and performance monitoring</li>
                <li>Feature usage statistics</li>
              </ul>
              <p class="text-gray-700 italic">
                Currently, we do not use analytics cookies, but we reserve the right to implement them in the future.
              </p>
            </div>

            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Advertising and Marketing Cookies</h3>
              <p class="text-gray-700 mb-2">
                We may use these cookies to deliver relevant advertisements and measure their effectiveness:
              </p>
              <ul class="list-disc list-inside text-gray-700 space-y-1 mb-2">
                <li>Targeted advertising based on your interests</li>
                <li>Conversion tracking and campaign measurement</li>
                <li>Cross-site tracking for advertising purposes</li>
              </ul>
              <p class="text-gray-700 italic">
                Currently, we do not use advertising cookies, but we reserve the right to implement them in the future with appropriate notice.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Third-Party Cookies</h2>
          <p class="text-gray-700 mb-3">
            We may allow trusted third-party services to set cookies on our website for the following purposes:
          </p>
          <ul class="list-disc list-inside text-gray-700 space-y-1 mb-3">
            <li>Authentication services (e.g., Firebase Auth)</li>
            <li>Analytics and performance monitoring</li>
            <li>Content delivery and optimization</li>
            <li>Security and fraud prevention</li>
          </ul>
          <p class="text-gray-700">
            These third parties have their own privacy policies and cookie practices, which we encourage you to review.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Managing Your Cookie Preferences</h2>
          <p class="text-gray-700 mb-3">
            You can control cookie settings through your browser preferences. Most browsers allow you to:
          </p>
          <ul class="list-disc list-inside text-gray-700 space-y-1 mb-3">
            <li>View and delete existing cookies</li>
            <li>Block cookies from specific websites</li>
            <li>Block third-party cookies</li>
            <li>Receive notifications when cookies are set</li>
          </ul>
          <p class="text-gray-700">
            <strong>Please note:</strong> Disabling essential cookies may affect the functionality of our website and services.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Cookie Retention</h2>
          <p class="text-gray-700 mb-3">
            We retain cookies for different periods depending on their purpose:
          </p>
          <ul class="list-disc list-inside text-gray-700 space-y-1">
            <li><strong>Session cookies:</strong> Deleted when you close your browser</li>
            <li><strong>Persistent cookies:</strong> Remain on your device for a specified period or until manually deleted</li>
            <li><strong>Authentication cookies:</strong> Typically expire after 30 days of inactivity</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Updates to This Policy</h2>
          <p class="text-gray-700">
            We may update this Cookie Policy from time to time to reflect changes in our practices or applicable laws. We will notify you of significant changes by updating the "Last updated" date at the top of this policy.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Contact Us</h2>
          <p class="text-gray-700">
            If you have questions about our use of cookies or this Cookie Policy, please contact us through our website or support channels.
          </p>
        </section>
      </div>
    </StaticPageLayout>
  );
}