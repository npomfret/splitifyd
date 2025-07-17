import { NavigationComponent } from './navigation';
import type { NavigationConfig, NavigationAction } from '../types/components';

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
    href: string;
    disabled: boolean;
    appendChild: jest.Mock;
    querySelector: jest.Mock;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
}

const createMockElement = (tagName: string = 'div'): MockElement => {
    const element = Object.create(MockNode.prototype);
    Object.assign(element, {
        textContent: '',
        nodeType: 1,
        className: '',
        id: '',
        href: '',
        disabled: false,
        appendChild: jest.fn(),
        querySelector: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    });
    return element;
};

// Mock safe-dom utils
jest.mock('../utils/safe-dom', () => ({
    createElementSafe: jest.fn((tagName: string, attributes: any = {}) => {
        const element = createMockElement(tagName);
        Object.assign(element, attributes);
        return element;
    }),
    appendChildren: jest.fn()
}));

import { createElementSafe } from '../utils/safe-dom';

describe('NavigationComponent', () => {
    let mockCreateElement: jest.MockedFunction<typeof createElementSafe>;

    beforeEach(() => {
        mockCreateElement = createElementSafe as jest.MockedFunction<typeof createElementSafe>;
        mockCreateElement.mockImplementation((tagName: string, attributes: any = {}) => {
            const element = createMockElement(tagName);
            Object.assign(element, attributes);
            return element as any; // Cast to any to avoid type issues in tests
        });

        global.document = {
            createTextNode: jest.fn((text: string) => ({ textContent: text, nodeType: 3 }))
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create NavigationComponent with default config', () => {
            const nav = new NavigationComponent();
            expect(nav).toBeInstanceOf(NavigationComponent);
        });

        it('should create NavigationComponent with custom config', () => {
            const config = {
                title: 'Test Page',
                backUrl: '/dashboard.html'
            };
            const nav = new NavigationComponent(config);
            expect(nav).toBeInstanceOf(NavigationComponent);
        });
    });

    describe('render', () => {
        it('should render basic navigation with title only', () => {
            const config = {
                title: 'Dashboard'
            };
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);
            const result = nav;

            expect(mockCreateElement).toHaveBeenCalledWith('nav', { className: 'nav-header' });
            expect(mockCreateElement).toHaveBeenCalledWith('h1', {
                className: 'page-title',
                textContent: 'Dashboard'
            });
        });

        it('should render navigation with back link', () => {
            const config = {
                title: 'Group Details',
                backUrl: '/dashboard.html',
                backText: 'Back to Dashboard'
            };
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            expect(mockCreateElement).toHaveBeenCalledWith('a', {
                href: '/dashboard.html',
                className: 'back-button'
            });
            expect(mockCreateElement).toHaveBeenCalledWith('i', { className: 'fas fa-arrow-left' });
        });

        it('should render navigation with button actions', () => {
            const mockHandler = jest.fn();
            const config = {
                title: 'Expenses',
                actions: [{
                    type: 'button' as const,
                    id: 'add-expense',
                    text: 'Add Expense',
                    icon: 'fas fa-plus',
                    class: 'button--primary',
                    handler: mockHandler
                }]
            };
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            expect(mockCreateElement).toHaveBeenCalledWith('button', {
                className: 'button button--primary',
                id: 'add-expense',
                disabled: false
            });
            expect(mockCreateElement).toHaveBeenCalledWith('i', { className: 'fas fa-plus' });
        });

        it('should render navigation with link actions', () => {
            const config = {
                title: 'Settings',
                actions: [{
                    type: 'link' as const,
                    id: 'profile-link',
                    text: 'Profile',
                    href: '/profile.html',
                    icon: 'fas fa-user'
                }]
            };
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            expect(mockCreateElement).toHaveBeenCalledWith('a', {
                href: '/profile.html',
                className: 'button button--secondary',
                id: 'profile-link'
            });
        });

        it('should render disabled button action', () => {
            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'disabled-btn',
                    text: 'Disabled',
                    disabled: true
                }]
            };
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            expect(mockCreateElement).toHaveBeenCalledWith('button', {
                className: 'button button--secondary',
                id: 'disabled-btn',
                disabled: true
            });
        });

        it('should render action with icon only', () => {
            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'icon-only',
                    text: '',
                    icon: 'fas fa-cog'
                }]
            };
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            expect(mockCreateElement).toHaveBeenCalledWith('i', { className: 'fas fa-cog' });
        });

        it('should render action with text only', () => {
            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'text-only',
                    text: 'Save'
                }]
            };
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            // Verify button was created
            expect(mockCreateElement).toHaveBeenCalledWith('button', {
                className: 'button button--secondary',
                id: 'text-only',
                disabled: false
            });
        });
    });

    describe('setupEventListeners', () => {
        it('should attach event listeners to button actions with handlers', () => {
            const mockHandler = jest.fn();
            const mockButton = createMockElement('button');
            const mockNav = createMockElement('nav');
            
            mockNav.querySelector.mockReturnValue(mockButton);
            mockCreateElement.mockReturnValueOnce(mockNav as any);

            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'test-btn',
                    text: 'Test',
                    handler: mockHandler
                }]
            };
            
            const nav = new NavigationComponent(config);
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            expect(mockNav.querySelector).toHaveBeenCalledWith('#test-btn');
            expect(mockButton.addEventListener).toHaveBeenCalledWith('click', mockHandler);
        });

        it('should not attach listeners to buttons without handlers', () => {
            const mockButton = createMockElement('button');
            const mockNav = createMockElement('nav');
            
            mockNav.querySelector.mockReturnValue(mockButton);
            mockCreateElement.mockReturnValueOnce(mockNav as any);

            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'no-handler-btn',
                    text: 'No Handler'
                }]
            };
            
            const nav = new NavigationComponent(config);
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            expect(mockButton.addEventListener).not.toHaveBeenCalled();
        });

        it('should not attach listeners to link actions', () => {
            const mockLink = createMockElement('a');
            const mockNav = createMockElement('nav');
            
            mockNav.querySelector.mockReturnValue(mockLink);
            mockCreateElement.mockReturnValueOnce(mockNav as any);

            const config = {
                title: 'Test',
                actions: [{
                    type: 'link' as const,
                    id: 'test-link',
                    text: 'Test Link',
                    href: '/test.html'
                }]
            };
            
            const nav = new NavigationComponent(config);
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);

            expect(mockLink.addEventListener).not.toHaveBeenCalled();
        });

        it('should handle missing button element gracefully', () => {
            const mockNav = createMockElement('nav');
            mockNav.querySelector.mockReturnValue(null);
            mockCreateElement.mockReturnValueOnce(mockNav as any);

            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'missing-btn',
                    text: 'Missing',
                    handler: jest.fn()
                }]
            };
            
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            expect(() => nav.mount(mockParent as any)).not.toThrow();
        });
    });

    describe('cleanup', () => {
        it('should remove event listeners from button actions', () => {
            const mockHandler = jest.fn();
            const mockButton = createMockElement('button');
            const mockNav = createMockElement('nav');
            
            mockNav.querySelector.mockReturnValue(mockButton);
            mockCreateElement.mockReturnValueOnce(mockNav as any);

            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'cleanup-btn',
                    text: 'Cleanup Test',
                    handler: mockHandler
                }]
            };
            
            const nav = new NavigationComponent(config);
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);
            nav.unmount();

            expect(mockButton.removeEventListener).toHaveBeenCalledWith('click', mockHandler);
        });

        it('should handle cleanup with missing element', () => {
            const mockNav = createMockElement('nav');
            mockNav.querySelector.mockReturnValue(null);
            mockCreateElement.mockReturnValueOnce(mockNav as any);

            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'missing-cleanup-btn',
                    text: 'Missing',
                    handler: jest.fn()
                }]
            };
            
            const nav = new NavigationComponent(config);
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);
            
            expect(() => nav.unmount()).not.toThrow();
        });

        it('should not attempt cleanup for actions without handlers', () => {
            const mockButton = createMockElement('button');
            const mockNav = createMockElement('nav');
            
            mockNav.querySelector.mockReturnValue(mockButton);
            mockCreateElement.mockReturnValueOnce(mockNav as any);

            const config = {
                title: 'Test',
                actions: [{
                    type: 'button' as const,
                    id: 'no-cleanup-btn',
                    text: 'No Cleanup'
                }]
            };
            
            const nav = new NavigationComponent(config);
            const mockParent = createMockElement('div');
            nav.mount(mockParent as any);
            nav.unmount();

            expect(mockButton.removeEventListener).not.toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle empty config', () => {
            const nav = new NavigationComponent({});
            
            const mockParent = createMockElement('div');
            expect(() => nav.mount(mockParent as any)).not.toThrow();
            
            expect(mockCreateElement).toHaveBeenCalledWith('h1', {
                className: 'page-title',
                textContent: ''
            });
        });

        it('should handle multiple actions of different types', () => {
            const mockHandler = jest.fn();
            const config = {
                title: 'Mixed Actions',
                actions: [
                    {
                        type: 'button' as const,
                        id: 'btn1',
                        text: 'Button',
                        handler: mockHandler
                    },
                    {
                        type: 'link' as const,
                        id: 'link1',
                        text: 'Link',
                        href: '/test.html'
                    }
                ]
            };
            
            const nav = new NavigationComponent(config);
            
            const mockParent = createMockElement('div');
            expect(() => nav.mount(mockParent as any)).not.toThrow();
            
            expect(mockCreateElement).toHaveBeenCalledWith('button', expect.any(Object));
            expect(mockCreateElement).toHaveBeenCalledWith('a', expect.any(Object));
        });
    });
});