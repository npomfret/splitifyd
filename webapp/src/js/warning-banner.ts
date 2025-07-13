import { firebaseConfigManager } from './firebase-init.js';
import { showWarning, hideWarning } from './utils/ui-messages';
import { logger } from './utils/logger.js';

export var warningBannerManager = {
  init() {
    if (!firebaseConfigManager) {
      setTimeout(() => this.init(), 100);
      return;
    }
    // Just get the config without initializing Firebase
    firebaseConfigManager.getConfig().then(() => {
      this.displayWarningBanner();
    }).catch((error) => {
      logger.error('Error getting config in warningBannerManager:', error);
    });
  },
  async displayWarningBanner() {
    const bannerText = await firebaseConfigManager.getWarningBanner();
    if (bannerText) {
      showWarning(bannerText);
    } else {
      hideWarning();
    }
  }
};
document.addEventListener("DOMContentLoaded", () => {
  warningBannerManager.init();
});