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
    if (!document.head) {
      throw new Error('document.head is null - HTML must have a <head> element');
    }
    
    this.setTitle();
    this.setViewport();
    this.setCSP();
    this.setupFonts();
    this.setupCSS();
    this.setupDNSPrefetch();
    
    return document.head;
  }

  public mount(parent: HTMLElement): void {
    // Don't append head to parent - just populate it in place
    this.element = this.render();
    this.setupEventListeners();
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
    // Fonts are now loaded directly in HTML files for better performance
    // This method is kept for backward compatibility but does nothing by default
  }

  private setupCSS(): void {
    // CSS is now loaded directly in HTML files for better performance
    // Only handle additional CSS if explicitly provided
    this.config.preloadCss?.forEach(css => {
      this.addLinkIfNotExists('preload', css, false, 'style');
    });

    this.config.additionalCss?.forEach(css => {
      this.addLinkIfNotExists('stylesheet', css);
    });
  }

  private setupDNSPrefetch(): void {
    // DNS prefetch is now handled directly in HTML files for better performance
  }

  private addLinkIfNotExists(rel: string, href: string, crossorigin = false, as?: string): void {
    const existing = document.querySelector(`link[rel="${rel}"][href="${href}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (crossorigin) link.crossOrigin = 'anonymous';
    if (as) link.as = as;
    document.head.appendChild(link);
  }
}