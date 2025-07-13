import { EmptyStateComponent } from './empty-state';

describe('EmptyStateComponent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Basic Rendering', () => {
    it('should render with title only', () => {
      const emptyState = new EmptyStateComponent({
        title: 'No data found'
      });
      emptyState.mount(container);

      const element = container.querySelector('.empty-state');
      expect(element).toBeTruthy();

      const title = element?.querySelector('h3');
      expect(title?.textContent).toBe('No data found');

      expect(element?.querySelector('.empty-state__icon')).toBeFalsy();
      expect(element?.querySelector('p')).toBeFalsy();
      expect(element?.querySelector('.empty-state__actions')).toBeFalsy();
    });

    it('should render with icon', () => {
      const emptyState = new EmptyStateComponent({
        icon: 'fas fa-folder-open',
        title: 'No files'
      });
      emptyState.mount(container);

      const iconContainer = container.querySelector('.empty-state__icon');
      expect(iconContainer).toBeTruthy();

      const icon = iconContainer?.querySelector('i');
      expect(icon?.className).toBe('fas fa-folder-open');
    });

    it('should render with message', () => {
      const emptyState = new EmptyStateComponent({
        title: 'No results',
        message: 'Try adjusting your search criteria'
      });
      emptyState.mount(container);

      const message = container.querySelector('p');
      expect(message?.textContent).toBe('Try adjusting your search criteria');
    });

    it('should render with actions', () => {
      const onClick = jest.fn();
      const emptyState = new EmptyStateComponent({
        title: 'No groups',
        message: 'You haven\'t joined any groups yet',
        actions: [
          { text: 'Create Group', variant: 'primary', onClick },
          { text: 'Join Group', variant: 'secondary' }
        ]
      });
      emptyState.mount(container);

      const actionsContainer = container.querySelector('.empty-state__actions');
      expect(actionsContainer).toBeTruthy();

      const buttons = actionsContainer?.querySelectorAll('button');
      expect(buttons?.length).toBe(2);
      expect(buttons?.[0].textContent).toBe('Create Group');
      expect(buttons?.[0].className).toContain('button--primary');
      expect(buttons?.[1].textContent).toBe('Join Group');
      expect(buttons?.[1].className).toContain('button--secondary');

      buttons?.[0].click();
      expect(onClick).toHaveBeenCalled();
    });

    it('should add custom className', () => {
      const emptyState = new EmptyStateComponent({
        title: 'Empty',
        className: 'custom-empty-state'
      });
      emptyState.mount(container);

      const element = container.querySelector('.empty-state');
      expect(element?.className).toContain('custom-empty-state');
    });
  });

  describe('Dynamic Updates', () => {
    it('should update title', () => {
      const emptyState = new EmptyStateComponent({
        title: 'Original Title'
      });
      emptyState.mount(container);

      emptyState.setTitle('Updated Title');

      const title = container.querySelector('h3');
      expect(title?.textContent).toBe('Updated Title');
    });

    it('should update message', () => {
      const emptyState = new EmptyStateComponent({
        title: 'No data',
        message: 'Original message'
      });
      emptyState.mount(container);

      emptyState.setMessage('Updated message');

      const message = container.querySelector('p');
      expect(message?.textContent).toBe('Updated message');
    });

    it('should add message if initially empty', () => {
      const emptyState = new EmptyStateComponent({
        title: 'No data'
      });
      emptyState.mount(container);

      expect(container.querySelector('p')).toBeFalsy();

      emptyState.setMessage('New message');

      const message = container.querySelector('p');
      expect(message?.textContent).toBe('New message');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup button components on unmount', () => {
      const onClick1 = jest.fn();
      const onClick2 = jest.fn();
      
      const emptyState = new EmptyStateComponent({
        title: 'No data',
        actions: [
          { text: 'Action 1', onClick: onClick1 },
          { text: 'Action 2', onClick: onClick2 }
        ]
      });
      emptyState.mount(container);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(2);

      emptyState.unmount();

      expect(container.querySelector('.empty-state')).toBeFalsy();
      expect(container.querySelectorAll('button').length).toBe(0);
    });
  });
});