import { ModalComponent } from './modal';
import type { ModalConfig, ModalConfirmConfig } from '../types/components';

// Mock Node constructor for instanceof checks
class MockNode {
    textContent: string = '';
    nodeType: number = 1;
    constructor() {}
}

global.Node = MockNode as any;

// Mock DOM environment
interface MockElement extends MockNode {
    className: string;
    id: string;
    style: { display: string };
    setAttribute: jest.Mock;
    appendChild: jest.Mock;
    removeChild: jest.Mock;
    removeEventListener: jest.Mock;
    addEventListener: jest.Mock;
    querySelector: jest.Mock;
    firstChild: MockNode | null;
    childNodes: MockNode[];
    parentNode: MockElement | null;
    classList: {
        add: jest.Mock;
        remove: jest.Mock;
        contains: jest.Mock;
    };
}

const createMockElement = (): MockElement => {
    const element = Object.create(MockNode.prototype);
    Object.assign(element, {
        textContent: '',
        nodeType: 1,
        className: '',
        id: '',
        style: { display: 'block' },
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        removeEventListener: jest.fn(),
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
        firstChild: null,
        childNodes: [],
        parentNode: null,
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn()
        }
    });
    return element;
};

const mockDocument = {
    createElement: jest.fn().mockImplementation(() => createMockElement()),
    createTextNode: jest.fn().mockReturnValue({ textContent: 'test', nodeType: 3 }),
    body: createMockElement()
};

const mockParentElement = createMockElement();

Object.defineProperty(global, 'document', { value: mockDocument });

// Mock the utility modules
jest.mock('../utils/safe-dom', () => ({
    createElementSafe: jest.fn().mockImplementation((tag, attributes = {}, children = []) => {
        const element = createMockElement();
        Object.assign(element, attributes);
        return element;
    })
}));

jest.mock('../utils/ui-visibility', () => ({
    showElement: jest.fn(),
    hideElement: jest.fn()
}));

import { createElementSafe } from '../utils/safe-dom';
import { showElement, hideElement } from '../utils/ui-visibility';

describe('ModalComponent', () => {
    let modalConfig: any;

    beforeEach(() => {
        jest.clearAllMocks();
        modalConfig = {
            id: 'test-modal',
            title: 'Test Modal',
            body: 'Test body content'
        };
    });

    describe('constructor and basic rendering', () => {
        it('should create modal with basic configuration', () => {
            const modal = new ModalComponent(modalConfig);
            expect(modal).toBeInstanceOf(ModalComponent);
        });

        it('should render modal with correct structure when mounted', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(mockParentElement as any);

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
            modal.mount(mockParentElement as any);

            expect(createElementSafe).toHaveBeenCalledWith('button', {
                className: 'modal-close',
                'data-modal-close': 'test-modal',
                textContent: '×'
            });
        });

        it('should not render close button when disabled', () => {
            const configWithoutClose = { ...modalConfig, closeButton: false };
            const modal = new ModalComponent(configWithoutClose);
            modal.mount(mockParentElement as any);

            const closeButtonCalls = (createElementSafe as jest.Mock).mock.calls.filter(
                call => call[0] === 'button' && call[1]?.className === 'modal-close'
            );
            expect(closeButtonCalls).toHaveLength(0);
        });

        it('should render with different sizes', () => {
            const largeModalConfig = { ...modalConfig, size: 'large' };
            const modal = new ModalComponent(largeModalConfig);
            modal.mount(mockParentElement as any);

            expect(createElementSafe).toHaveBeenCalledWith('div', {
                className: 'modal-content modal-large'
            });
        });

        it('should handle Node body content', () => {
            const bodyNode = new global.Node() as any;
            const configWithNodeBody = { ...modalConfig, body: bodyNode };
            const modal = new ModalComponent(configWithNodeBody);
            
            modal.mount(mockParentElement as any);

            // The test verifies that when a Node is passed as body, 
            // the modal doesn't try to set textContent on the body container
            expect(createElementSafe).toHaveBeenCalledWith('div', {
                className: 'modal-body'
            });
        });

        it('should render footer when provided', () => {
            const configWithFooter = { ...modalConfig, footer: 'Footer content' };
            const modal = new ModalComponent(configWithFooter);
            modal.mount(mockParentElement as any);

            expect(createElementSafe).toHaveBeenCalledWith('div', {
                className: 'modal-footer'
            });
        });
    });

    describe('show and hide functionality', () => {
        it('should show modal correctly', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(mockParentElement as any);
            
            modal.show();

            expect(showElement).toHaveBeenCalledWith(expect.any(Object), 'flex');
            expect(mockDocument.body.classList.add).toHaveBeenCalledWith('modal-open');
        });

        it('should hide modal correctly', () => {
            const modal = new ModalComponent(modalConfig);
            modal.mount(mockParentElement as any);
            
            modal.hide();

            expect(hideElement).toHaveBeenCalledWith(expect.any(Object));
            expect(mockDocument.body.classList.remove).toHaveBeenCalledWith('modal-open');
        });

        it('should handle show when element is null', () => {
            const modal = new ModalComponent(modalConfig);
            
            modal.show();

            expect(showElement).not.toHaveBeenCalled();
            expect(mockDocument.body.classList.add).not.toHaveBeenCalled();
        });

        it('should handle hide when element is null', () => {
            const modal = new ModalComponent(modalConfig);
            
            modal.hide();

            expect(hideElement).not.toHaveBeenCalled();
            expect(mockDocument.body.classList.remove).not.toHaveBeenCalled();
        });
    });

    describe('event listeners', () => {
        it('should set up event listeners on mount', () => {
            const mockModalElement = createMockElement();
            const mockCloseButton = createMockElement();
            
            (createElementSafe as jest.Mock).mockReturnValueOnce(mockModalElement);
            mockModalElement.querySelector.mockReturnValue(mockCloseButton);

            const modal = new ModalComponent(modalConfig);
            modal.mount(mockParentElement as any);

            expect(mockModalElement.querySelector).toHaveBeenCalledWith('[data-modal-close="test-modal"]');
            expect(mockCloseButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockModalElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should handle close button click', () => {
            const mockModalElement = createMockElement();
            const mockCloseButton = createMockElement();
            
            (createElementSafe as jest.Mock).mockReturnValueOnce(mockModalElement);
            mockModalElement.querySelector.mockReturnValue(mockCloseButton);

            const modal = new ModalComponent(modalConfig);
            const hideSpy = jest.spyOn(modal, 'hide');
            
            modal.mount(mockParentElement as any);

            // Simulate close button click
            const closeHandler = mockCloseButton.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];
            closeHandler?.();

            expect(hideSpy).toHaveBeenCalled();
        });

        it('should handle overlay click to close', () => {
            const mockModalElement = createMockElement();
            
            (createElementSafe as jest.Mock).mockReturnValueOnce(mockModalElement);
            mockModalElement.querySelector.mockReturnValue(null);

            const modal = new ModalComponent(modalConfig);
            const hideSpy = jest.spyOn(modal, 'hide');
            
            modal.mount(mockParentElement as any);

            // Simulate overlay click (target is the modal element itself)
            const overlayHandler = mockModalElement.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];
            
            const mockEvent = { target: mockModalElement };
            overlayHandler?.(mockEvent);

            expect(hideSpy).toHaveBeenCalled();
        });

        it('should not close on content click', () => {
            const mockModalElement = createMockElement();
            const mockContentElement = createMockElement();
            
            (createElementSafe as jest.Mock).mockReturnValueOnce(mockModalElement);
            mockModalElement.querySelector.mockReturnValue(null);

            const modal = new ModalComponent(modalConfig);
            const hideSpy = jest.spyOn(modal, 'hide');
            
            modal.mount(mockParentElement as any);

            // Simulate content click (target is not the modal element)
            const overlayHandler = mockModalElement.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];
            
            const mockEvent = { target: mockContentElement };
            overlayHandler?.(mockEvent);

            expect(hideSpy).not.toHaveBeenCalled();
        });

        it('should clean up event listeners on unmount', () => {
            const mockModalElement = createMockElement();
            const mockCloseButton = createMockElement();
            mockModalElement.parentNode = mockParentElement;
            
            (createElementSafe as jest.Mock).mockReturnValueOnce(mockModalElement);
            mockModalElement.querySelector.mockReturnValue(mockCloseButton);

            const modal = new ModalComponent(modalConfig);
            modal.mount(mockParentElement as any);
            modal.unmount();

            expect(mockCloseButton.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockModalElement.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });
    });

    describe('static confirm method', () => {
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
            const mockConfirmButton = createMockElement();
            
            let createElementCallCount = 0;
            (createElementSafe as jest.Mock).mockImplementation((tag, attrs) => {
                createElementCallCount++;
                if (tag === 'button' && attrs?.className?.includes('button--danger')) {
                    return mockConfirmButton;
                }
                return createMockElement();
            });

            ModalComponent.confirm({
                title: 'Test',
                message: 'Test message',
                onConfirm
            });

            // Simulate confirm button click
            const confirmHandler = mockConfirmButton.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];
            confirmHandler?.();

            expect(onConfirm).toHaveBeenCalled();
        });

        it('should call onCancel when cancel button is clicked', () => {
            const onCancel = jest.fn();
            const mockCancelButton = createMockElement();
            
            let buttonCount = 0;
            (createElementSafe as jest.Mock).mockImplementation((tag, attrs) => {
                if (tag === 'button') {
                    buttonCount++;
                    if (buttonCount === 1) { // First button is cancel
                        return mockCancelButton;
                    }
                }
                return createMockElement();
            });

            ModalComponent.confirm({
                title: 'Test',
                message: 'Test message',
                onCancel
            });

            // Simulate cancel button click
            const cancelHandler = mockCancelButton.addEventListener.mock.calls.find(
                call => call[0] === 'click'
            )?.[1];
            cancelHandler?.();

            expect(onCancel).toHaveBeenCalled();
        });
    });
});