import ScrollReveal from 'scrollreveal';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initGlobe } from './globe.js';
import { firebaseConfigManager } from './firebase-config-manager.js';
import { updatePageTitle } from './utils/page-title.js';

gsap.registerPlugin(ScrollTrigger);

async function updateAppReferences() {
    try {
        const appDisplayName = await firebaseConfigManager.getAppDisplayName();
        
        // Update page title
        await updatePageTitle('Effortless Bill Splitting');
        
        // Update logo in navbar
        const navbarLogo = document.querySelector('.navbar .logo');
        if (navbarLogo) {
            navbarLogo.textContent = appDisplayName;
        }
        
        // Update footer copyright
        const footer = document.querySelector('footer p');
        if (footer) {
            footer.innerHTML = `&copy; 2025 ${appDisplayName}. All rights reserved.`;
        }
        
        // Update feature sections that mention the app name
        const featureSections = document.querySelectorAll('.feature-item p');
        featureSections.forEach(p => {
            if (p.textContent.includes('app-name-here')) {
                p.textContent = p.textContent.replace(/app-name-here/g, appDisplayName);
            }
        });
        
        // Update hero section and transparency notice
        const heroText = document.querySelector('.hero p');
        if (heroText && heroText.textContent.includes('app-name-here')) {
            heroText.innerHTML = heroText.innerHTML.replace(/app-name-here/g, appDisplayName);
        }
        
        const transparencyText = document.querySelector('.transparency-notice p');
        if (transparencyText && transparencyText.textContent.includes('app-name-here')) {
            transparencyText.innerHTML = transparencyText.innerHTML.replace(/app-name-here/g, appDisplayName);
        }
        
    } catch (error) {
        console.warn('Failed to load app configuration for landing page', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Update app references with runtime config
    await updateAppReferences();
    // GSAP Animations
    gsap.from('.navbar', { duration: 1, y: -100, opacity: 0, ease: 'power2.out' });
    gsap.from('.hero h1', { duration: 1.5, y: -50, opacity: 0, ease: 'elastic.out(1, 0.5)', delay: 0.5 });
    gsap.from('.hero p', { duration: 1.5, y: 50, opacity: 0, delay: 1, ease: 'power2.out' });

    // Parallax hero image
    gsap.to('.hero-image', {
        yPercent: 50,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
        },
    });

    // ScrollReveal Animations
    const sr = ScrollReveal({
        distance: '80px',
        duration: 2000,
        easing: 'cubic-bezier(0.5, 0, 0, 1)',
        reset: true,
    });

    sr.reveal('.feature-item', { origin: 'bottom', interval: 200 });
    sr.reveal('.cta-bottom h2', { origin: 'bottom', scale: 0.5 });

    // Initialize the globe
    initGlobe();
});
