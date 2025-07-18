import { WarningBannerComponent } from './components/warning-banner.js';
import { PolicyPageComponent } from './components/PolicyPageComponent.js';
import { cookiesPolicyContent } from './content/cookies-policy-content.js';

document.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const policyPage = new PolicyPageComponent({
      title: 'Cookie Policy',
      content: cookiesPolicyContent
    });
    await policyPage.mount(appRoot);
  }
});