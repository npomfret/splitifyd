function showWarning(message) {
    const bannerElement = document.getElementById('warningBanner');
    if (bannerElement) {
        bannerElement.textContent = message;
        bannerElement.classList.remove('hidden');
    }
}

function hideWarning() {
    const bannerElement = document.getElementById('warningBanner');
    if (bannerElement) {
        bannerElement.classList.add('hidden');
    }
}

// Export for module usage if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showWarning, hideWarning };
}

const warningBannerManager = {
    init() {
        window.firebaseConfigManager.initialize()
            .then(() => {
                this.displayWarningBanner();
            })
            .catch(error => {
                throw error;
            });
    },

    displayWarningBanner() {
        const bannerText = window.firebaseConfigManager.getWarningBanner();
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