import { StaticPageLayout } from '../../components/StaticPageLayout';

export function PrivacyPolicyPage() {
  const baseUrl = window.location.origin;
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
        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Introduction</h2>
          <p class="text-gray-700">
            This Privacy Policy describes how we ("we," "us," or "our") collect, use, and protect your personal information when you use our expense sharing application. By using our service, you consent to the collection and use of information in accordance with this policy. We may update this policy from time to time, and we will notify you of any material changes by posting the new policy on this page.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Information We Collect</h2>
          <p class="text-gray-700">
            We collect minimal personal information necessary to provide our service. This includes your email address for account creation and authentication purposes. We do not collect, store, or process any other personally identifiable information such as your name, phone number, physical address, or payment information directly. Payment processing, if applicable, is handled by third-party processors who maintain their own privacy policies. We may also collect non-personal technical information such as device type, operating system, and usage patterns to improve our service quality and user experience.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">How We Use Your Information</h2>
          <p class="text-gray-700">
            We use your email address solely for account management, authentication, and essential service communications. We do not currently engage in user tracking, behavioral analysis, or targeted advertising. However, we reserve the right to implement such features in the future, subject to providing appropriate notice and obtaining necessary consent. Any usage analytics we collect are aggregated and anonymized to protect individual user privacy while helping us improve our service.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Information Sharing and Disclosure</h2>
          <p class="text-gray-700">
            We do not sell, rent, or share your personal information with third parties for their marketing purposes. We may disclose your information only in the following circumstances: (a) with your explicit consent; (b) to comply with legal obligations, court orders, or governmental requests; (c) to protect our rights, property, or safety, or that of our users or the public; (d) in connection with a merger, acquisition, or sale of assets, provided the acquiring party agrees to protect your information under terms at least as protective as this policy; or (e) to trusted service providers who assist us in operating our service, subject to appropriate confidentiality agreements.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Data Security</h2>
          <p class="text-gray-700">
            We implement reasonable security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security. We encourage you to use strong, unique passwords and to contact us immediately if you suspect any unauthorized access to your account.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Data Retention and Deletion</h2>
          <p class="text-gray-700">
            We retain your personal information only for as long as necessary to provide our service and fulfill the purposes outlined in this policy. You may request deletion of your account and associated data at any time by contacting us. We will make reasonable efforts to delete your information within thirty (30) days of such request, except where retention is required by law or for legitimate business purposes such as fraud prevention or dispute resolution.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Your Rights and Choices</h2>
          <p class="text-gray-700">
            You have the right to access, update, or delete your personal information. You may also object to certain processing of your data or request data portability where applicable. To exercise these rights, please contact us using the information provided below. We will respond to your request within a reasonable timeframe and in accordance with applicable law.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Third-Party Services</h2>
          <p class="text-gray-700">
            Our service may contain links to third-party websites or integrate with third-party services. This privacy policy does not apply to such third-party services, and we are not responsible for their privacy practices. We encourage you to review the privacy policies of any third-party services you interact with.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Future Changes and Analytics</h2>
          <p class="text-gray-700">
            While we do not currently implement user tracking or serve advertisements, we reserve the right to introduce such features in the future as our business evolves. Should we implement tracking technologies, analytics platforms, or advertising networks, we will update this policy accordingly and provide appropriate notice to users. Any such changes will be implemented in compliance with applicable privacy laws and industry best practices.
          </p>
        </section>

        <section>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>
          <p class="text-gray-700">
            If you have any questions about this Privacy Policy or our data practices, please contact us through the communication channels provided in our application. We will make reasonable efforts to respond to your inquiries in a timely manner.
          </p>
        </section>
      </div>
    </StaticPageLayout>
  );
}