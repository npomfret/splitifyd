
export abstract class BaseComponent<T extends HTMLElement = HTMLElement> {
  private static idCounter = 0;
  protected element: T | null = null;

  protected generateUniqueId(prefix: string): string {
    return `${prefix}-${Date.now()}-${++BaseComponent.idCounter}`;
  }

  protected abstract render(): T;

  protected setupEventListeners(): void {
    // To be implemented by subclasses
  }

  public mount(parent: HTMLElement): void {
    this.element = this.render();
    parent.appendChild(this.element);
    this.setupEventListeners();
  }

  public unmount(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.cleanup();
    this.element = null;
  }

  protected cleanup(): void {
    // To be implemented by subclasses
  }
}
