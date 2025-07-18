import { WarningBannerComponent } from './components/warning-banner.js';
import { IndexComponent } from './components/IndexComponent.js';

document.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const indexComponent = new IndexComponent();
    await indexComponent.mount(appRoot);
  }
});