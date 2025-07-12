
export abstract class BaseComponent<T extends HTMLElement = HTMLElement> {
  protected element: T | null = null;

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
