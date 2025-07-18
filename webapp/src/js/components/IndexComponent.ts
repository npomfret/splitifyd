import { BaseComponent } from './base-component.js';
import { createElementSafe } from '../utils/safe-dom.js';
import { logger } from '../utils/logger.js';
import ScrollReveal from 'scrollreveal';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initGlobe } from '../globe.js';

gsap.registerPlugin(ScrollTrigger);

export class IndexComponent extends BaseComponent<HTMLDivElement> {
  private scrollReveal: any = null;

  async mount(container: HTMLElement): Promise<void> {
    super.mount(container);
    this.initializeAnimations();
    initGlobe();
  }

  protected render(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'landing-page';

    container.appendChild(this.renderHeader());
    container.appendChild(this.renderMain());
    container.appendChild(this.renderFooter());

    return container;
  }

  private renderHeader(): HTMLElement {
    const header = createElementSafe('header');
    
    const containerDiv = createElementSafe('div', {
      className: 'container navbar'
    });

    const logo = createElementSafe('a', {
      href: '#',
      className: 'logo'
    });
    const logoImg = createElementSafe('img', {
      src: '/images/logo.svg',
      alt: 'Logo',
      className: 'logo-img'
    }) as HTMLImageElement;
    logo.appendChild(logoImg);

    const nav = createElementSafe('nav', {
      className: 'nav-links'
    });

    const loginLink = createElementSafe('a', {
      href: '/login.html',
      textContent: 'Login'
    });

    const signupLink = createElementSafe('a', {
      href: '/register.html',
      className: 'nav-cta',
      textContent: 'Sign Up'
    });

    nav.appendChild(loginLink);
    nav.appendChild(signupLink);

    containerDiv.appendChild(logo);
    containerDiv.appendChild(nav);
    header.appendChild(containerDiv);

    return header;
  }

  private renderMain(): HTMLElement {
    const main = createElementSafe('main');

    main.appendChild(this.renderHeroSection());
    main.appendChild(this.renderFeaturesSection());
    main.appendChild(this.renderCTASection());
    main.appendChild(this.renderTransparencySection());

    return main;
  }

  private renderHeroSection(): HTMLElement {
    const section = createElementSafe('section', {
      className: 'hero'
    });

    const globeContainer = createElementSafe('div', {
      id: 'globe-container'
    });

    const heroContent = createElementSafe('div', {
      className: 'hero-content container'
    });

    const h1 = createElementSafe('h1', {
      innerHTML: 'Effortless Bill Splitting, <br>Simplified & Smart.'
    });

    const p = createElementSafe('p', {
      innerHTML: 'Say goodbye to awkward IOUs and complex calculations. Our app makes sharing expenses with friends, family, and roommates easy, fair, and transparent. <strong>It\'s 100% free, with no ads and no limits.</strong> Focus on what matters, not on the math.'
    });

    const heroImage = createElementSafe('img', {
      src: 'https://placehold.co/800x450/6A0DAD/FFFFFF/png?text=Your+App+Screenshot+Here',
      alt: 'App Screenshot',
      className: 'hero-image'
    }) as HTMLImageElement;

    heroContent.appendChild(h1);
    heroContent.appendChild(p);
    heroContent.appendChild(heroImage);

    section.appendChild(globeContainer);
    section.appendChild(heroContent);

    return section;
  }

  private renderFeaturesSection(): HTMLElement {
    const section = createElementSafe('section', {
      className: 'features'
    });

    const container = createElementSafe('div', {
      className: 'container'
    });

    const h2 = createElementSafe('h2', {
      textContent: 'Everything You Need, Nothing You Don\'t'
    });

    const featureGrid = createElementSafe('div', {
      className: 'feature-grid'
    });

    const features = [
      {
        icon: '/images/icons/groups.svg',
        title: 'Smart Group Management',
        description: 'Create groups for any occasion. Easily add members and track shared expenses in one place, keeping everyone on the same page.',
        iconColor: null
      },
      {
        icon: '/images/icons/splitting.svg',
        title: 'Flexible Splitting',
        description: 'Split bills equally, by exact amounts, or by percentages. We handle all the complex math, so you don\'t have to.',
        iconColor: null
      },
      {
        icon: '/images/icons/simplify.svg',
        title: 'Debt Simplification',
        description: 'Our algorithm minimizes transactions, showing you the simplest way to settle up, saving everyone time and hassle.',
        iconColor: null
      },
      {
        icon: '/images/icons/free.svg',
        title: '100% Free to Use',
        description: 'Our service is and always will be free. No hidden fees or premium tiers—just a powerful, accessible tool for everyone.',
        iconColor: 'green'
      },
      {
        icon: '/images/icons/unlimited.svg',
        title: 'Unlimited Use',
        description: 'Create as many groups, add as many friends, and track as many expenses as you need. No restrictions, no limits.',
        iconColor: 'green'
      },
      {
        icon: '/images/icons/no-ads.svg',
        title: 'Zero Ads, Ever',
        description: 'Enjoy a clean, focused experience. We will never sell your data or clutter your screen with ads. Your privacy is our priority.',
        iconColor: 'green'
      }
    ];

    features.forEach(feature => {
      const featureItem = createElementSafe('div', {
        className: 'feature-item'
      });
      if (feature.iconColor) {
        featureItem.setAttribute('data-icon-color', feature.iconColor);
      }

      const icon = createElementSafe('img', {
        src: feature.icon,
        alt: `${feature.title} Icon`
      }) as HTMLImageElement;

      const h3 = createElementSafe('h3', {
        textContent: feature.title
      });

      const p = createElementSafe('p', {
        textContent: feature.description
      });

      featureItem.appendChild(icon);
      featureItem.appendChild(h3);
      featureItem.appendChild(p);
      featureGrid.appendChild(featureItem);
    });

    container.appendChild(h2);
    container.appendChild(featureGrid);
    section.appendChild(container);

    return section;
  }

  private renderCTASection(): HTMLElement {
    const section = createElementSafe('section', {
      className: 'cta-bottom'
    });

    const container = createElementSafe('div', {
      className: 'container'
    });

    const h2 = createElementSafe('h2', {
      textContent: 'Ready to Simplify Your Shared Expenses?'
    });

    const p = createElementSafe('p', {
      textContent: 'Join thousands who are already making group payments stress-free and transparent. Get started today!'
    });

    container.appendChild(h2);
    container.appendChild(p);
    section.appendChild(container);

    return section;
  }

  private renderTransparencySection(): HTMLElement {
    const section = createElementSafe('section', {
      className: 'transparency-notice'
    });

    const container = createElementSafe('div', {
      className: 'container'
    });

    const transparencyContent = createElementSafe('div', {
      className: 'transparency-content'
    });

    const p = createElementSafe('p', {
      innerHTML: '<strong>This is a tool for tracking expenses, not for making payments.</strong> To save and manage your expenses, you\'ll need a free account. We will never ask for sensitive financial details.'
    });

    transparencyContent.appendChild(p);
    container.appendChild(transparencyContent);
    section.appendChild(container);

    return section;
  }

  private renderFooter(): HTMLElement {
    const footer = createElementSafe('footer');

    const container = createElementSafe('div', {
      className: 'container'
    });

    const copyright = createElementSafe('p', {
      textContent: '© 2025 Pomo Corp ltd. All rights reserved.'
    });

    const links = createElementSafe('p');
    
    const privacyLink = createElementSafe('a', {
      href: '/privacy-policy.html',
      textContent: 'Privacy Policy'
    });
    
    const termsLink = createElementSafe('a', {
      href: '/terms-of-service.html',
      textContent: 'Terms of Service'
    });
    
    const cookiesLink = createElementSafe('a', {
      href: '/cookies-policy.html',
      textContent: 'Cookie Policy'
    });
    
    const pricingLink = createElementSafe('a', {
      href: '/pricing.html',
      textContent: 'Pricing'
    });

    links.appendChild(privacyLink);
    links.appendChild(document.createTextNode(' | '));
    links.appendChild(termsLink);
    links.appendChild(document.createTextNode(' | '));
    links.appendChild(cookiesLink);
    links.appendChild(document.createTextNode(' | '));
    links.appendChild(pricingLink);

    container.appendChild(copyright);
    container.appendChild(links);
    footer.appendChild(container);

    return footer;
  }

  private initializeAnimations(): void {
    try {
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
      this.scrollReveal = ScrollReveal({
        distance: '80px',
        duration: 2000,
        easing: 'cubic-bezier(0.5, 0, 0, 1)',
        reset: true,
      });

      this.scrollReveal.reveal('.feature-item', { origin: 'bottom', interval: 200 });
      this.scrollReveal.reveal('.cta-bottom h2', { origin: 'bottom', scale: 0.5 });
    } catch (error) {
      logger.error('Failed to initialize animations:', error);
    }
  }

  protected cleanup(): void {
    if (this.scrollReveal) {
      this.scrollReveal.destroy();
      this.scrollReveal = null;
    }
    super.cleanup();
  }
}