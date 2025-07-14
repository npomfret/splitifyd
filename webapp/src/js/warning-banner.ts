import { firebaseConfigManager } from './firebase-config-manager.js';
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
    const warningBanner = await firebaseConfigManager.getWarningBanner();
    if (warningBanner?.message) {
      showWarning(warningBanner.message);
    } else {
      hideWarning();
    }
  }
};
document.addEventListener("DOMContentLoaded", () => {
  warningBannerManager.init();
});