# Webapp Issue: Adopt a Consistent Component Pattern

## Issue Description

No consistent structure for UI components.

## Recommendation

Define a simple lifecycle for all components.

## Implementation Suggestions

Each component should have `render()`, `setupEventListeners()`, and `cleanup()` methods to manage its lifecycle and prevent memory leaks.

### Example Component Structure:

```typescript
// webapp/src/js/components/MyComponent.ts

interface MyComponentConfig {
  // Define configuration properties for the component
  data: any;
  onClick: (event: MouseEvent) => void;
}

export class MyComponent {
  private config: MyComponentConfig;
  private element: HTMLElement | null = null;

  constructor(config: MyComponentConfig) {
    this.config = config;
  }

  /**
   * Renders the component's HTML.
   * @returns The HTMLElement representing the component.
   */
  render(): HTMLElement {
    this.element = document.createElement('div');
    this.element.className = 'my-component';
    this.element.innerHTML = `
      <p>${this.config.data.text}</p>
      <button class="my-button">Click Me</button>
    `;
    this.setupEventListeners();
    return this.element;
  }

  /**
   * Attaches event listeners to the component's elements.
   * Should be called after the component is rendered.
   */
  private setupEventListeners(): void {
    if (this.element) {
      const button = this.element.querySelector('.my-button');
      if (button) {
        button.addEventListener('click', this.config.onClick);
      }
    }
  }

  /**
   * Cleans up event listeners and any other resources to prevent memory leaks.
   * Should be called when the component is removed from the DOM or no longer needed.
   */
  cleanup(): void {
    if (this.element) {
      const button = this.element.querySelector('.my-button');
      if (button) {
        button.removeEventListener('click', this.config.onClick);
      }
      this.element = null; // Dereference the element
    }
  }
}

// Example Usage in another module:
// import { MyComponent } from './components/MyComponent';

// const myData = { text: 'Hello from component!' };
// const handleClick = () => console.log('Button clicked!');

// const component = new MyComponent({ data: myData, onClick: handleClick });
// const container = document.getElementById('app-container');
// if (container) {
//   container.appendChild(component.render());
// }

// // When the component is no longer needed:
// // component.cleanup();
// // container.removeChild(component.render()); // Or whatever method removes it
```

**Next Steps:**
1.  Define a base `Component` interface or abstract class that enforces these methods.
2.  Refactor existing components (e.g., `HeaderComponent`, `ListComponents`, `ModalComponent`) to adhere to this pattern.
3.  Ensure that `cleanup()` methods are called when components are removed from the DOM or their parent components are cleaned up.
