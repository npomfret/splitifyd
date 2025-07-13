import { BaseComponent } from './base-component.js';

interface PageHeaderConfig {
  title: string;
  description?: string;
  preloadCss?: string[];
  additionalCss?: string[];
  includeDefaults?: boolean;
}

export class PageHeaderComponent extends BaseComponent<HTMLHeadElement> {
  private config: PageHeaderConfig;

  constructor(config: PageHeaderConfig) {
    super();
    this.config = {
      includeDefaults: true,
      ...config
    };
  }

  protected render(): HTMLHeadElement {
    const head = document.head;
    
    this.setTitle();
    this.setViewport();
    this.setCSP();
    this.setupFonts();
    this.setupCSS();
    this.setupDNSPrefetch();
    
    return head;
  }

  private setTitle(): void {
    document.title = this.config.title;
  }

  private setViewport(): void {
    let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1.0';
  }

  private setCSP(): void {
    let csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement;
    if (!csp) {
      csp = document.createElement('meta');
      csp.httpEquiv = 'Content-Security-Policy';
      document.head.appendChild(csp);
    }
    csp.content = `default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://firebase.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://ws-mt1.pusher.com http://localhost:* http://127.0.0.1:*;`;
  }

  private setupFonts(): void {
    if (!this.config.includeDefaults) return;

    this.addLinkIfNotExists('preconnect', 'https://fonts.googleapis.com');
    this.addLinkIfNotExists('preconnect', 'https://fonts.gstatic.com', true);
    this.addLinkIfNotExists('stylesheet', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  }

  private setupCSS(): void {
    if (this.config.includeDefaults) {
      this.addLinkIfNotExists('preload', '/css/main.css', false, 'style');
      this.addLinkIfNotExists('stylesheet', '/css/main.css');
      this.addLinkIfNotExists('stylesheet', '/css/utility.css');
      this.addLinkIfNotExists('stylesheet', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
    }

    this.config.preloadCss?.forEach(css => {
      this.addLinkIfNotExists('preload', css, false, 'style');
    });

    this.config.additionalCss?.forEach(css => {
      this.addLinkIfNotExists('stylesheet', css);
    });
  }

  private setupDNSPrefetch(): void {
    if (!this.config.includeDefaults) return;
    this.addLinkIfNotExists('dns-prefetch', '//api.splitifyd.com');
  }

  private addLinkIfNotExists(rel: string, href: string, crossorigin = false, as?: string): void {
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (crossorigin) link.crossOrigin = 'anonymous';
    if (as) link.as = as;
    document.head.appendChild(link);
  }
}