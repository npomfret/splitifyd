import ScrollReveal from 'scrollreveal';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initGlobe } from './globe.js';

gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
    // GSAP Animations
    gsap.from('.navbar', { duration: 1, y: -100, opacity: 0, ease: 'power2.out' });
    gsap.from('.hero h1', { duration: 1.5, y: -50, opacity: 0, ease: 'elastic.out(1, 0.5)', delay: 0.5 });
    gsap.from('.hero p', { duration: 1.5, y: 50, opacity: 0, delay: 1, ease: 'power2.out' });
    gsap.from('.cta-button', { duration: 1.5, scale: 0.5, opacity: 0, delay: 1.5, ease: 'elastic.out(1, 0.5)' });

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
