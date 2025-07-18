import { WarningBannerComponent } from './components/warning-banner.js';
import { PolicyPageComponent } from './components/PolicyPageComponent.js';
import { termsOfServiceContent } from './content/terms-of-service-content.js';

document.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const policyPage = new PolicyPageComponent({
      title: 'Terms of Service',
      content: termsOfServiceContent
    });
    await policyPage.mount(appRoot);
  }
});