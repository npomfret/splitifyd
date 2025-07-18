import { WarningBannerComponent } from './components/warning-banner.js';
import { PolicyPageComponent } from './components/PolicyPageComponent.js';
import { privacyPolicyContent } from './content/privacy-policy-content.js';

document.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const policyPage = new PolicyPageComponent({
      title: 'Privacy Policy',
      content: privacyPolicyContent
    });
    await policyPage.mount(appRoot);
  }
});