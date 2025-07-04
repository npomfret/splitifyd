const warningBannerManager = {
    init() {
        window.firebaseConfigManager.initialize()
            .then(() => {
                this.displayWarningBanner();
            })
            .catch(error => {
                console.error('Failed to initialize warning banner:', error);
            });
    },

    displayWarningBanner() {
        const bannerText = window.firebaseConfigManager.getWarningBanner();
        const bannerElement = document.getElementById('warningBanner');
        
        if (bannerText && bannerElement) {
            bannerElement.textContent = bannerText;
            bannerElement.style.display = 'block';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    warningBannerManager.init();
});