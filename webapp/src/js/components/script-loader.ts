import { BaseComponent } from './base-component.js';

interface ScriptConfig {
  src: string;
  type?: string;
  async?: boolean;
  defer?: boolean;
  crossorigin?: string;
  integrity?: string;
  id?: string;
}

interface ScriptLoaderConfig {
  scripts: ScriptConfig[];
  loadStrategy?: 'parallel' | 'sequential';
  onLoad?: (src: string) => void;
  onError?: (src: string, error: Error) => void;
  onComplete?: () => void;
}

export class ScriptLoaderComponent extends BaseComponent<HTMLDivElement> {
  private config: ScriptLoaderConfig;
  private loadedScripts: Set<string> = new Set();
  private loadingPromises: Map<string, Promise<void>> = new Map();

  constructor(config: ScriptLoaderConfig) {
    super();
    this.config = {
      loadStrategy: 'parallel',
      ...config
    };
  }

  protected render(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.display = 'none';
    container.setAttribute('aria-hidden', 'true');
    return container;
  }

  public async loadScripts(): Promise<void> {
    if (this.config.loadStrategy === 'sequential') {
      await this.loadSequentially();
    } else {
      await this.loadInParallel();
    }
    
    this.config.onComplete?.();
  }

  private async loadInParallel(): Promise<void> {
    const promises = this.config.scripts.map(script => this.loadScript(script));
    await Promise.all(promises);
  }

  private async loadSequentially(): Promise<void> {
    for (const script of this.config.scripts) {
      await this.loadScript(script);
    }
  }

  private loadScript(scriptConfig: ScriptConfig): Promise<void> {
    if (this.isScriptLoaded(scriptConfig.src)) {
      return Promise.resolve();
    }

    const existingPromise = this.loadingPromises.get(scriptConfig.src);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      
      script.src = scriptConfig.src;
      script.type = scriptConfig.type || 'module';
      
      if (scriptConfig.async !== undefined) {
        script.async = scriptConfig.async;
      }
      
      if (scriptConfig.defer !== undefined) {
        script.defer = scriptConfig.defer;
      }
      
      if (scriptConfig.crossorigin) {
        script.crossOrigin = scriptConfig.crossorigin;
      }
      
      if (scriptConfig.integrity) {
        script.integrity = scriptConfig.integrity;
      }
      
      if (scriptConfig.id) {
        script.id = scriptConfig.id;
      }

      script.onload = () => {
        this.loadedScripts.add(scriptConfig.src);
        this.loadingPromises.delete(scriptConfig.src);
        this.config.onLoad?.(scriptConfig.src);
        resolve();
      };

      script.onerror = () => {
        this.loadingPromises.delete(scriptConfig.src);
        const error = new Error(`Failed to load script: ${scriptConfig.src}`);
        this.config.onError?.(scriptConfig.src, error);
        reject(error);
      };

      if (this.element) {
        this.element.appendChild(script);
      } else {
        document.head.appendChild(script);
      }
    });

    this.loadingPromises.set(scriptConfig.src, promise);
    return promise;
  }

  private isScriptLoaded(src: string): boolean {
    return this.loadedScripts.has(src) || 
           document.querySelector(`script[src="${src}"]`) !== null;
  }

  public static createFirebaseLoader(): ScriptLoaderComponent {
    return new ScriptLoaderComponent({
      scripts: [
        { src: '/js/firebase-init.js', type: 'module' },
        { src: '/js/api.js', type: 'module' },
        { src: '/js/auth.js', type: 'module' },
        { src: '/js/logout-handler.js', type: 'module' }
      ],
      loadStrategy: 'sequential'
    });
  }

  public static createAuthPageLoader(): ScriptLoaderComponent {
    return ScriptLoaderComponent.createFirebaseLoader();
  }

  public static createDashboardLoader(): ScriptLoaderComponent {
    const firebaseLoader = ScriptLoaderComponent.createFirebaseLoader();
    firebaseLoader.config.scripts.push(
      { src: '/js/expenses.js', type: 'module' },
      { src: '/js/groups.js', type: 'module' },
      { src: '/js/dashboard.js', type: 'module' }
    );
    return firebaseLoader;
  }

  public addScript(scriptConfig: ScriptConfig): void {
    this.config.scripts.push(scriptConfig);
  }

  public removeScript(src: string): void {
    this.config.scripts = this.config.scripts.filter(script => script.src !== src);
    this.loadedScripts.delete(src);
    this.loadingPromises.delete(src);
    
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      existingScript.remove();
    }
  }

  protected cleanup(): void {
    this.loadingPromises.clear();
    this.loadedScripts.clear();
  }
}