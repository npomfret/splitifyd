import { signal } from '@preact/signals';

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
  iterations?: number;
}

export interface UpdateAnimation {
  id: string;
  type: 'balance' | 'expense' | 'group' | 'presence';
  action: 'added' | 'modified' | 'removed' | 'updated';
  element: HTMLElement;
  config: AnimationConfig;
  startTime: number;
  endTime: number;
}

export class AnimationManager {
  private static instance: AnimationManager;
  
  // Animation state
  public activeAnimations = signal<UpdateAnimation[]>([]);
  public animationQueue = signal<UpdateAnimation[]>([]);
  public isAnimating = signal<boolean>(false);
  
  // Configuration
  private defaultConfigs: { [key: string]: AnimationConfig } = {
    'balance-update': {
      duration: 500,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    },
    'expense-added': {
      duration: 600,
      easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    },
    'expense-modified': {
      duration: 300,
      easing: 'ease-in-out'
    },
    'expense-removed': {
      duration: 400,
      easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)'
    },
    'group-update': {
      duration: 300,
      easing: 'ease-out'
    },
    'presence-change': {
      duration: 250,
      easing: 'ease-in-out'
    },
    'flash-update': {
      duration: 200,
      easing: 'ease-out',
      iterations: 2
    }
  };
  
  private animationObserver: IntersectionObserver | null = null;
  private performanceMonitor = {
    frameDrops: 0,
    averageDuration: 0,
    totalAnimations: 0
  };

  private constructor() {
    this.setupAnimationObserver();
    this.setupPerformanceMonitoring();
  }

  static getInstance(): AnimationManager {
    if (!AnimationManager.instance) {
      AnimationManager.instance = new AnimationManager();
    }
    return AnimationManager.instance;
  }

  /**
   * Animate balance updates with smooth transitions
   */
  animateBalanceUpdate(
    element: HTMLElement,
    oldValue: number,
    newValue: number,
    currency: string = '$'
  ): Promise<void> {
    return new Promise((resolve) => {
      // Add balance update class
      element.classList.add('balance-updating');
      
      // Animate number change
      const startTime = Date.now();
      const duration = 800;
      const startValue = oldValue;
      const difference = newValue - oldValue;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeOutCubic(progress);
        
        const currentValue = startValue + (difference * easeProgress);
        const formattedValue = this.formatCurrency(currentValue, currency);
        
        element.textContent = formattedValue;
        
        // Add visual emphasis for significant changes
        if (Math.abs(difference) > 10) {
          const intensity = Math.min(Math.abs(difference) / 100, 1);
          element.style.setProperty('--update-intensity', intensity.toString());
          
          if (difference > 0) {
            element.classList.add('balance-positive');
          } else {
            element.classList.add('balance-negative');
          }
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          element.classList.remove('balance-updating', 'balance-positive', 'balance-negative');
          element.style.removeProperty('--update-intensity');
          resolve();
        }
      };
      
      requestAnimationFrame(animate);
    });
  }

  /**
   * Animate expense list changes with staggered animations
   */
  animateExpenseChanges(
    changes: {
      added: HTMLElement[];
      modified: HTMLElement[];
      removed: HTMLElement[];
    }
  ): Promise<void> {
    const animations: Promise<void>[] = [];
    
    // Animate removals first
    changes.removed.forEach((element, index) => {
      animations.push(
        this.animateExpenseRemoval(element, index * 50)
      );
    });
    
    // Then animate modifications
    changes.modified.forEach((element, index) => {
      animations.push(
        this.animateExpenseModification(element, index * 30)
      );
    });
    
    // Finally animate additions
    changes.added.forEach((element, index) => {
      animations.push(
        this.animateExpenseAddition(element, index * 100)
      );
    });
    
    return Promise.all(animations).then(() => {});
  }

  /**
   * Animate expense addition with slide-in effect
   */
  private animateExpenseAddition(element: HTMLElement, delay: number = 0): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px) scale(0.95)';
        element.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        
        // Force reflow
        element.offsetHeight;
        
        element.style.opacity = '1';
        element.style.transform = 'translateY(0) scale(1)';
        
        // Add highlight effect
        element.classList.add('expense-added');
        
        setTimeout(() => {
          element.style.removeProperty('opacity');
          element.style.removeProperty('transform');
          element.style.removeProperty('transition');
          element.classList.remove('expense-added');
          resolve();
        }, 500);
      }, delay);
    });
  }

  /**
   * Animate expense modification with flash effect
   */
  private animateExpenseModification(element: HTMLElement, delay: number = 0): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        element.classList.add('expense-modified');
        
        setTimeout(() => {
          element.classList.remove('expense-modified');
          resolve();
        }, 300);
      }, delay);
    });
  }

  /**
   * Animate expense removal with slide-out effect
   */
  private animateExpenseRemoval(element: HTMLElement, delay: number = 0): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const height = element.offsetHeight;
        element.style.overflow = 'hidden';
        element.style.transition = 'all 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53)';
        element.style.opacity = '0';
        element.style.transform = 'translateX(-20px)';
        element.style.height = '0px';
        element.style.marginBottom = '0px';
        element.style.paddingTop = '0px';
        element.style.paddingBottom = '0px';
        
        setTimeout(() => {
          element.remove();
          resolve();
        }, 400);
      }, delay);
    });
  }

  /**
   * Animate presence changes (users joining/leaving)
   */
  animatePresenceChange(
    element: HTMLElement,
    action: 'joined' | 'left' | 'activity-changed'
  ): Promise<void> {
    return new Promise((resolve) => {
      switch (action) {
        case 'joined':
          element.style.opacity = '0';
          element.style.transform = 'scale(0.8)';
          element.style.transition = 'all 0.25s ease-in-out';
          
          requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
          });
          
          setTimeout(() => {
            element.style.removeProperty('opacity');
            element.style.removeProperty('transform');
            element.style.removeProperty('transition');
            resolve();
          }, 250);
          break;
          
        case 'left':
          element.style.transition = 'all 0.25s ease-in-out';
          element.style.opacity = '0';
          element.style.transform = 'scale(0.8)';
          
          setTimeout(() => {
            element.remove();
            resolve();
          }, 250);
          break;
          
        case 'activity-changed':
          element.classList.add('activity-pulse');
          setTimeout(() => {
            element.classList.remove('activity-pulse');
            resolve();
          }, 600);
          break;
          
        default:
          resolve();
      }
    });
  }

  /**
   * Create a subtle flash animation for general updates
   */
  flashUpdate(element: HTMLElement, color: string = 'var(--primary-color)'): void {
    const originalBackground = element.style.background;
    
    element.style.transition = 'background 0.2s ease-out';
    element.style.background = `${color}20`; // 20% opacity
    
    setTimeout(() => {
      element.style.background = originalBackground;
      
      setTimeout(() => {
        element.style.removeProperty('transition');
      }, 200);
    }, 150);
  }

  /**
   * Animate group metadata changes
   */
  animateGroupUpdate(element: HTMLElement, field: string): Promise<void> {
    return new Promise((resolve) => {
      // Different animations for different fields
      switch (field) {
        case 'name':
        case 'description':
          this.animateTextChange(element);
          break;
          
        case 'memberCount':
          this.animateMemberCountChange(element);
          break;
          
        case 'totalBalance':
          element.classList.add('total-balance-update');
          setTimeout(() => {
            element.classList.remove('total-balance-update');
          }, 500);
          break;
          
        default:
          this.flashUpdate(element);
      }
      
      setTimeout(resolve, 300);
    });
  }

  /**
   * Animate text content changes with smooth transition
   */
  private animateTextChange(element: HTMLElement): void {
    element.style.transition = 'color 0.3s ease-out, transform 0.3s ease-out';
    element.style.color = 'var(--primary-color)';
    element.style.transform = 'scale(1.02)';
    
    setTimeout(() => {
      element.style.removeProperty('color');
      element.style.transform = 'scale(1)';
      
      setTimeout(() => {
        element.style.removeProperty('transition');
        element.style.removeProperty('transform');
      }, 300);
    }, 300);
  }

  /**
   * Animate member count changes with counter effect
   */
  private animateMemberCountChange(element: HTMLElement): void {
    element.classList.add('member-count-update');
    
    // Create a brief scaling animation
    element.style.transform = 'scale(1.1)';
    element.style.transition = 'transform 0.2s ease-out';
    
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 100);
    
    setTimeout(() => {
      element.classList.remove('member-count-update');
      element.style.removeProperty('transform');
      element.style.removeProperty('transition');
    }, 400);
  }

  /**
   * Setup intersection observer for performance optimization
   */
  private setupAnimationObserver(): void {
    this.animationObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-when-visible');
          } else {
            entry.target.classList.remove('animate-when-visible');
          }
        });
      },
      { threshold: 0.1 }
    );
  }

  /**
   * Monitor animation performance
   */
  private setupPerformanceMonitoring(): void {
    // Monitor frame drops
    let lastFrameTime = performance.now();
    
    const checkFrameRate = () => {
      const currentTime = performance.now();
      const frameDuration = currentTime - lastFrameTime;
      
      // Detect dropped frames (assuming 60fps = 16.67ms per frame)
      if (frameDuration > 33) { // More than 2 frames
        this.performanceMonitor.frameDrops++;
      }
      
      lastFrameTime = currentTime;
      
      if (this.isAnimating.value) {
        requestAnimationFrame(checkFrameRate);
      }
    };
    
    this.isAnimating.subscribe((animating) => {
      if (animating) {
        requestAnimationFrame(checkFrameRate);
      }
    });
  }

  /**
   * Format currency values
   */
  private formatCurrency(value: number, currency: string): string {
    return `${currency}${Math.abs(value).toFixed(2)}`;
  }

  /**
   * Easing functions
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Register element for animation optimization
   */
  observeElement(element: HTMLElement): void {
    if (this.animationObserver) {
      this.animationObserver.observe(element);
    }
  }

  /**
   * Unregister element from animation optimization
   */
  unobserveElement(element: HTMLElement): void {
    if (this.animationObserver) {
      this.animationObserver.unobserve(element);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMonitor };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMonitor = {
      frameDrops: 0,
      averageDuration: 0,
      totalAnimations: 0
    };
  }

  /**
   * Disable animations for users who prefer reduced motion
   */
  respectsReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.animationObserver) {
      this.animationObserver.disconnect();
      this.animationObserver = null;
    }
    
    this.activeAnimations.value = [];
    this.animationQueue.value = [];
    this.isAnimating.value = false;
  }
}