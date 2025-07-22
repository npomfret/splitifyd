import { StaticPageLayout } from '../../components/StaticPageLayout';

export function CookiePolicyPage() {
  return (
    <StaticPageLayout 
      title="Cookie Policy" 
      description="Cookie Policy for Splitifyd - Learn about how we use cookies and similar technologies."
    >
      <div class="space-y-6">
        <div class="text-sm text-gray-500 mb-8">
          Last updated: January 22, 2025
        </div>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">What Are Cookies?</h2>
          <p class="text-gray-700">
            Cookies are small text files that are stored on your computer or mobile device when you visit a website. 
            They allow the website to recognize your device and store some information about your preferences or past actions.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">How We Use Cookies</h2>
          <p class="text-gray-700 mb-3">
            Splitifyd uses cookies to enhance your experience and provide our services effectively. We use the following types of cookies:
          </p>

          <div class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Essential Cookies</h3>
              <p class="text-gray-700">
                These cookies are necessary for the website to function properly. They enable core functionality like 
                user authentication, security, and basic website operations. These cookies cannot be disabled.
              </p>
              <ul class="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>Authentication tokens</li>
                <li>Session management</li>
                <li>Security features</li>
                <li>Load balancing</li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Functional Cookies</h3>
              <p class="text-gray-700">
                These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings.
              </p>
              <ul class="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>Language preferences</li>
                <li>Theme settings</li>
                <li>Remember me functionality</li>
                <li>User interface preferences</li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Analytics Cookies</h3>
              <p class="text-gray-700">
                We use these cookies to understand how visitors interact with our website, helping us improve our service.
              </p>
              <ul class="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>Google Analytics (anonymized)</li>
                <li>Usage statistics</li>
                <li>Performance monitoring</li>
                <li>Error tracking</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Third-Party Cookies</h2>
          <p class="text-gray-700 mb-3">
            Some cookies on our website are set by third-party services we use:
          </p>
          
          <div class="space-y-3">
            <div>
              <h4 class="font-semibold text-gray-900">Google Analytics</h4>
              <p class="text-gray-700">
                We use Google Analytics to understand how our website is used. Google Analytics sets cookies to help us analyze website usage patterns.
                <br />
                <a href="https://policies.google.com/privacy" class="text-blue-600 hover:text-blue-700" target="_blank" rel="noopener noreferrer">
                  Google Privacy Policy
                </a>
              </p>
            </div>

            <div>
              <h4 class="font-semibold text-gray-900">Firebase/Google Services</h4>
              <p class="text-gray-700">
                Our authentication and database services are provided by Google Firebase, which may set cookies for authentication and security purposes.
                <br />
                <a href="https://firebase.google.com/support/privacy" class="text-blue-600 hover:text-blue-700" target="_blank" rel="noopener noreferrer">
                  Firebase Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Managing Cookies</h2>
          <p class="text-gray-700 mb-3">
            You can control and manage cookies in various ways:
          </p>

          <div class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Browser Settings</h3>
              <p class="text-gray-700 mb-2">
                Most web browsers allow you to control cookies through their settings preferences. You can:
              </p>
              <ul class="list-disc list-inside text-gray-700 space-y-1">
                <li>View what cookies are stored on your device</li>
                <li>Delete existing cookies</li>
                <li>Block or allow cookies from specific websites</li>
                <li>Block third-party cookies</li>
                <li>Clear all cookies when you close your browser</li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Impact of Disabling Cookies</h3>
              <p class="text-gray-700">
                Please note that disabling cookies may affect the functionality of Splitifyd. Some features may not work properly if cookies are disabled, including:
              </p>
              <ul class="list-disc list-inside text-gray-700 space-y-1 mt-2">
                <li>Staying logged in to your account</li>
                <li>Remembering your preferences</li>
                <li>Proper website functionality</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Changes to This Policy</h2>
          <p class="text-gray-700">
            We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, 
            legal, or regulatory reasons. We will notify you of any changes by posting the updated policy on this page.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Contact Us</h2>
          <p class="text-gray-700">
            If you have any questions about our use of cookies or this Cookie Policy, please contact us at: cookies@splitifyd.com
          </p>
        </section>
      </div>
    </StaticPageLayout>
  );
}