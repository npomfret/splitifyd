import { firebaseConfigManager } from './firebase-init.js';
import { showWarning, hideWarning } from './utils/ui-messages';
import { logger } from './utils/logger.js';

var warningBannerManager = {
  init() {
    logger.log('warningBannerManager.init() called');
    if (!firebaseConfigManager) {
      logger.warn('firebaseConfigManager not yet available, retrying in 100ms');
      setTimeout(() => this.init(), 100);
      return;
    }
    firebaseConfigManager.initialize().then(() => {
      logger.log('firebaseConfigManager initialized successfully in warningBannerManager');
      this.displayWarningBanner();
    }).catch((error) => {
      logger.error('Error initializing firebaseConfigManager in warningBannerManager:', error);
      throw error;
    });
  },
  async displayWarningBanner() {
    logger.log('displayWarningBanner() called');
    const bannerText = await firebaseConfigManager.getWarningBanner();
    logger.log('Retrieved bannerText:', bannerText);
    if (bannerText) {
      showWarning(bannerText);
    } else {
      hideWarning();
      logger.log('No bannerText found, hiding warning banner.');
    }
  }
};
document.addEventListener("DOMContentLoaded", () => {
  warningBannerManager.init();
  logger.log('DOMContentLoaded event fired, warningBannerManager.init() called.');
});