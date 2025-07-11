import { firebaseConfigManager } from './firebase-config.js';

function showWarning(message: string): void {
    const bannerElement = document.getElementById('warningBanner');
    if (bannerElement) {
        bannerElement.textContent = message;
        bannerElement.classList.remove('hidden');
    }
}

function hideWarning(): void {
    const bannerElement = document.getElementById('warningBanner');
    if (bannerElement) {
        bannerElement.classList.add('hidden');
    }
}

// Functions available for import
export { showWarning, hideWarning };

interface WarningBannerManager {
    init(): void;
    displayWarningBanner(): void;
}

const warningBannerManager: WarningBannerManager = {
    init() {
        if (!firebaseConfigManager) {
            setTimeout(() => this.init(), 100);
            return;
        }
        
        firebaseConfigManager.initialize()
            .then(() => {
                this.displayWarningBanner();
            })
            .catch((error: Error) => {
                throw error;
            });
    },

    displayWarningBanner() {
        const bannerText = firebaseConfigManager.getWarningBanner();
        const bannerElement = document.getElementById('warningBanner');
        
        if (bannerText && bannerElement) {
            bannerElement.textContent = bannerText;
            bannerElement.classList.remove('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    warningBannerManager.init();
});