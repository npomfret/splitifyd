import { ModalComponent } from './modal';

// Mock the utility modules
jest.mock('../utils/safe-dom', () => ({
    createElementSafe: jest.fn().mockImplementation((tag, attributes = {}) => {
        const element = document.createElement(tag);
        if (attributes) {
            Object.keys(attributes).forEach(key => {
                if (key === 'textContent') {
                    element.textContent = attributes[key];
                } else if (key === 'className') {
                    element.className = attributes[key];
                } else if (key.startsWith('data-')) {
                    element.setAttribute(key, attributes[key]);
                } else {
                    (element as any)[key] = attributes[key];
                }
            });
        }
        return element;
    })
}));

jest.mock('../utils/ui-visibility', () => ({
    showElement: jest.fn(),
    hideElement: jest.fn()
}));

import { createElementSafe } from '../utils/safe-dom';
import { showElement, hideElement } from '../utils/ui-visibility';

// Define the modal config type inline since we need ExtendedModalConfig
interface TestModalConfig {
    id: string;
    title: string;
    body?: string | Node;
    footer?: string | Node;
    size?: 'small' | 'medium' | 'large';
    closeButton?: boolean;
}

describe('ModalComponent', () => {
    let modalConfig: TestModalConfig;
    let container: HTMLDivElement;

    beforeEach(() => {
        jest.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
        
        modalConfig = {
            id: 'test-modal',
            title: 'Test Modal',
            body: 'Test body content'
        };
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    describe('constructor and basic rendering', () => {

        it('should render modal with correct structure when mounted', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(container);

            expect(createElementSafe).toHaveBeenCalledWith('div', {
                id: 'test-modal',
                className: 'modal-overlay hidden'
            });

            expect(createElementSafe).toHaveBeenCalledWith('div', {
                className: 'modal-content modal-medium'
            });

            expect(createElementSafe).toHaveBeenCalledWith('h3', {
                className: 'modal-title',
                textContent: 'Test Modal'
            });
        });

        it('should render close button by default', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(container);

            expect(createElementSafe).toHaveBeenCalledWith('button', {
                className: 'modal-close',
                'data-modal-close': 'test-modal',
                textContent: '×'
            });
        });

        it('should not render close button when disabled', () => {
            const configWithoutClose = { ...modalConfig, closeButton: false };
            const modal = new ModalComponent(configWithoutClose);
            modal.mount(container);

            const closeButtonCalls = (createElementSafe as jest.Mock).mock.calls.filter(
                call => call[0] === 'button' && call[1]?.className === 'modal-close'
            );
            expect(closeButtonCalls).toHaveLength(0);
        });

        it('should render with different sizes', () => {
            const largeModalConfig = { ...modalConfig, size: 'large' as const };
            const modal = new ModalComponent(largeModalConfig);
            modal.mount(container);

            expect(createElementSafe).toHaveBeenCalledWith('div', {
                className: 'modal-content modal-large'
            });
        });

        it('should handle Node body content', () => {
            const bodyNode = document.createElement('div');
            bodyNode.textContent = 'Custom body content';
            const configWithNodeBody = { ...modalConfig, body: bodyNode };
            const modal = new ModalComponent(configWithNodeBody);
            
            modal.mount(container);

            expect(createElementSafe).toHaveBeenCalledWith('div', {
                className: 'modal-body'
            });
        });

        it('should render footer when provided', () => {
            const configWithFooter = { ...modalConfig, footer: 'Footer content' };
            const modal = new ModalComponent(configWithFooter);
            modal.mount(container);

            expect(createElementSafe).toHaveBeenCalledWith('div', {
                className: 'modal-footer'
            });
        });
    });

    describe('show and hide functionality', () => {
        it('should show modal correctly', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(container);
            
            modal.show();

            expect(showElement).toHaveBeenCalledWith(expect.any(HTMLElement), 'flex');
            expect(document.body.classList.contains('modal-open')).toBe(true);
        });

        it('should hide modal correctly', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(container);
            
            modal.hide();

            expect(hideElement).toHaveBeenCalledWith(expect.any(HTMLElement));
            expect(document.body.classList.contains('modal-open')).toBe(false);
        });

        it('should handle show when element is null', () => {
            const modal = new ModalComponent(modalConfig);
            
            modal.show();

            expect(showElement).not.toHaveBeenCalled();
        });

        it('should handle hide when element is null', () => {
            const modal = new ModalComponent(modalConfig);
            
            modal.hide();

            expect(hideElement).not.toHaveBeenCalled();
        });
    });

    describe('event listeners', () => {
        it('should handle close button click', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(container);
            
            const hideSpy = jest.spyOn(modal, 'hide');
            
            // Find the close button in the mounted modal
            const closeButton = container.querySelector('[data-modal-close="test-modal"]') as HTMLButtonElement;
            expect(closeButton).toBeTruthy();
            
            // Simulate close button click
            closeButton.click();

            expect(hideSpy).toHaveBeenCalled();
        });

        it('should handle overlay click to close', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(container);
            
            const hideSpy = jest.spyOn(modal, 'hide');
            
            // Find the modal overlay
            const modalOverlay = container.querySelector('.modal-overlay') as HTMLElement;
            expect(modalOverlay).toBeTruthy();
            
            // Simulate overlay click (target is the modal element itself)
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: modalOverlay });
            modalOverlay.dispatchEvent(clickEvent);

            expect(hideSpy).toHaveBeenCalled();
        });

        it('should not close on content click', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(container);
            
            const hideSpy = jest.spyOn(modal, 'hide');
            
            // Find the modal content
            const modalContent = container.querySelector('.modal-content') as HTMLElement;
            expect(modalContent).toBeTruthy();
            
            // Simulate content click (target is not the modal overlay)
            const clickEvent = new MouseEvent('click', { bubbles: true });
            const modalOverlay = container.querySelector('.modal-overlay') as HTMLElement;
            Object.defineProperty(clickEvent, 'target', { value: modalContent });
            modalOverlay.dispatchEvent(clickEvent);

            expect(hideSpy).not.toHaveBeenCalled();
        });
    });

    describe('static confirm method', () => {
        afterEach(() => {
            // Clean up any modals created by confirm method
            const confirmModals = document.querySelectorAll('[id^="confirmModal_"]');
            confirmModals.forEach(modal => modal.parentNode?.removeChild(modal));
        });

        it('should create confirmation modal with default values', () => {
            const onConfirm = jest.fn();
            const onCancel = jest.fn();

            ModalComponent.confirm({
                title: 'Confirm Delete',
                message: 'Are you sure you want to delete this item?',
                onConfirm,
                onCancel
            });

            expect(createElementSafe).toHaveBeenCalledWith('p', { 
                textContent: 'Are you sure you want to delete this item?' 
            });

            expect(createElementSafe).toHaveBeenCalledWith('button', {
                className: 'button button--secondary',
                textContent: 'Cancel'
            });

            expect(createElementSafe).toHaveBeenCalledWith('button', {
                className: 'button button--danger',
                textContent: 'Confirm'
            });
        });

        it('should use custom button texts and classes', () => {
            const onConfirm = jest.fn();

            ModalComponent.confirm({
                title: 'Custom Confirm',
                message: 'Custom message',
                confirmText: 'Yes, do it',
                cancelText: 'No, cancel',
                confirmClass: 'button--warning',
                onConfirm
            });

            expect(createElementSafe).toHaveBeenCalledWith('button', {
                className: 'button button--secondary',
                textContent: 'No, cancel'
            });

            expect(createElementSafe).toHaveBeenCalledWith('button', {
                className: 'button button--warning',
                textContent: 'Yes, do it'
            });
        });

        it('should call onConfirm when confirm button is clicked', () => {
            const onConfirm = jest.fn();
            
            ModalComponent.confirm({
                title: 'Test',
                message: 'Test message',
                onConfirm
            });

            // Find the confirm button that was created
            const confirmButton = document.querySelector('.button.button--danger') as HTMLButtonElement;
            expect(confirmButton).toBeTruthy();
            
            // Simulate confirm button click
            confirmButton.click();

            expect(onConfirm).toHaveBeenCalled();
        });

        it('should call onCancel when cancel button is clicked', () => {
            const onCancel = jest.fn();
            
            ModalComponent.confirm({
                title: 'Test',
                message: 'Test message',
                onCancel
            });

            // Find the cancel button that was created
            const cancelButton = document.querySelector('.button.button--secondary') as HTMLButtonElement;
            expect(cancelButton).toBeTruthy();
            
            // Simulate cancel button click
            cancelButton.click();

            expect(onCancel).toHaveBeenCalled();
        });
    });
});