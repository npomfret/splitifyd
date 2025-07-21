import { authManager } from './auth';
import type { LoginCredentials } from './types/auth';
import type { FirebaseError } from './types/global';

// Mock dependencies
jest.mock('./utils/logger');
jest.mock('./firebase-init');
jest.mock('./firebase-config-manager');
jest.mock('./utils/ui-messages');
jest.mock('./utils/safe-dom');
jest.mock('./constants', () => ({
    AUTH_TOKEN_KEY: 'auth_token',
    USER_ID_KEY: 'userId'
}));

// Mock Firebase Auth
const mockFirebaseAuth = {
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    updateProfile: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    signOut: jest.fn()
};

// Mock Firebase config manager
const mockFirebaseConfigManager = {
    getFormDefaults: jest.fn().mockResolvedValue({
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'Test User'
    })
};

// Setup mocks
import { firebaseAuthInstance } from './firebase-init';
import { firebaseConfigManager } from './firebase-config-manager';
import { showFormError, showSuccessMessage } from './utils/ui-messages';
import { validateInput } from './utils/safe-dom';

(firebaseConfigManager as any) = mockFirebaseConfigManager;
(firebaseAuthInstance as any) = mockFirebaseAuth;

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
};

// Mock localStorage and location using spies
jest.spyOn(Storage.prototype, 'getItem').mockImplementation(mockLocalStorage.getItem);
jest.spyOn(Storage.prototype, 'setItem').mockImplementation(mockLocalStorage.setItem);
jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(mockLocalStorage.removeItem);

// Mock window.location.href to prevent navigation errors in jsdom
const originalLocation = window.location;
beforeAll(() => {
    delete (window as any).location;
    (window as any).location = {
        href: '',
        assign: jest.fn(),
        replace: jest.fn(),
        reload: jest.fn()
    };
});

afterAll(() => {
    (window as any).location = originalLocation;
});

// Mock DOM elements - minimal approach
const createMockElement = () => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    id: '',
    name: '',
    value: '',
    textContent: '',
    disabled: false,
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    closest: jest.fn()
});


// Mock validateInput
(validateInput as jest.Mock).mockImplementation((value, options) => {
    if (options.required && !value) {
        return { valid: false, error: 'Required field' };
    }
    if (options.allowedPattern && !options.allowedPattern.test(value)) {
        return { valid: false, error: 'Invalid format' };
    }
    return { valid: true, value };
});

describe('AuthManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue(null);
        (window as any).location.href = '';
        
        // Reset authManager token state to reflect mocked localStorage
        (authManager as any).token = null;
    });

    describe('initialization', () => {
        it('should initialize with token from localStorage', () => {
            mockLocalStorage.getItem.mockReturnValue('existing-token');
            // Simulate initialization after localStorage is mocked
            (authManager as any).token = localStorage.getItem('auth_token');
            
            const token = authManager.getToken();
            expect(token).toBe('existing-token');
        });

        it('should initialize without token when localStorage is empty', () => {
            mockLocalStorage.getItem.mockReturnValue(null);
            
            const token = authManager.getToken();
            expect(token).toBeNull();
        });
    });

    describe('authentication state', () => {
        it('should return true for isAuthenticated when token exists', () => {
            mockLocalStorage.getItem.mockReturnValue('valid-token');
            // Simulate initialization after localStorage is mocked
            (authManager as any).token = localStorage.getItem('auth_token');
            
            expect(authManager.isAuthenticated()).toBe(true);
        });

        it('should return false for isAuthenticated when no token', () => {
            mockLocalStorage.getItem.mockReturnValue(null);
            
            expect(authManager.isAuthenticated()).toBe(false);
        });

        it('should set token correctly', () => {
            const testToken = 'new-token';
            
            authManager['setToken'](testToken);
            
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', testToken);
            expect(authManager.getToken()).toBe(testToken);
        });

        it('should clear token and user ID', () => {
            authManager.clearToken();
            
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userId');
        });

        it('should get and set user ID', () => {
            const userId = 'user-123';
            
            authManager.setUserId(userId);
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('userId', userId);
            
            mockLocalStorage.getItem.mockReturnValue(userId);
            expect(authManager.getUserId()).toBe(userId);
        });
    });

    describe('login functionality', () => {
        it('should handle successful login', async () => {
            const mockUser = {
                uid: 'user-123',
                getIdToken: jest.fn().mockResolvedValue('id-token')
            };
            const mockUserCredential = { user: mockUser };
            
            mockFirebaseAuth.signInWithEmailAndPassword.mockResolvedValue(mockUserCredential);
            
            const mockForm = createMockElement();
            const mockButton = createMockElement();
            mockForm.querySelector.mockReturnValue(mockButton);
            
            const mockEvent = {
                preventDefault: jest.fn(),
                target: mockForm
            };
            
            const mockFormData = {
                get: jest.fn().mockImplementation((field) => {
                    if (field === 'email') return 'test@example.com';
                    if (field === 'password') return 'TestPass123!';
                    return null;
                })
            };
            
            global.FormData = jest.fn().mockImplementation(() => mockFormData) as any;
            
            await authManager['handleLogin'](mockEvent as any);
            
            expect(mockFirebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith('test@example.com', 'TestPass123!');
            expect(mockUser.getIdToken).toHaveBeenCalled();
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'id-token');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('userId', 'user-123');
        });

        it('should handle login with invalid credentials', async () => {
            const firebaseError: FirebaseError = {
                name: 'FirebaseError',
                code: 'auth/wrong-password',
                message: 'Wrong password'
            };
            
            mockFirebaseAuth.signInWithEmailAndPassword.mockRejectedValue(firebaseError);
            
            const mockForm = createMockElement();
            const mockButton = createMockElement();
            mockForm.querySelector.mockReturnValue(mockButton);
            
            const mockEvent = {
                preventDefault: jest.fn(),
                target: mockForm
            };
            
            const mockFormData = {
                get: jest.fn().mockImplementation((field) => {
                    if (field === 'email') return 'test@example.com';
                    if (field === 'password') return 'ValidPass123!'; // Valid format but wrong credentials
                    return null;
                })
            };
            
            global.FormData = jest.fn().mockImplementation(() => mockFormData) as any;
            
            await authManager['handleLogin'](mockEvent as any);
            
            expect(showFormError).toHaveBeenCalledWith(mockForm, 'Invalid email or password');
        });

        it('should handle too many requests error', async () => {
            const firebaseError: FirebaseError = {
                name: 'FirebaseError',
                code: 'auth/too-many-requests',
                message: 'Too many requests'
            };
            
            mockFirebaseAuth.signInWithEmailAndPassword.mockRejectedValue(firebaseError);
            
            const mockForm = createMockElement();
            const mockButton = createMockElement();
            mockForm.querySelector.mockReturnValue(mockButton);
            
            const mockEvent = {
                preventDefault: jest.fn(),
                target: mockForm
            };
            
            const mockFormData = {
                get: jest.fn().mockImplementation((field) => {
                    if (field === 'email') return 'test@example.com';
                    if (field === 'password') return 'TestPass123!';
                    return null;
                })
            };
            
            global.FormData = jest.fn().mockImplementation(() => mockFormData) as any;
            
            await authManager['handleLogin'](mockEvent as any);
            
            expect(showFormError).toHaveBeenCalledWith(mockForm, 'Too many failed attempts. Try again later');
        });
    });

    describe('registration functionality', () => {
        it('should handle successful registration', async () => {
            const mockUser = {
                uid: 'user-123',
                getIdToken: jest.fn().mockResolvedValue('id-token')
            };
            const mockUserCredential = { user: mockUser };
            
            mockFirebaseAuth.createUserWithEmailAndPassword.mockResolvedValue(mockUserCredential);
            mockFirebaseAuth.updateProfile.mockResolvedValue(undefined);
            
            const mockForm = createMockElement();
            const mockButton = createMockElement();
            mockForm.querySelector.mockReturnValue(mockButton);
            
            const mockEvent = {
                preventDefault: jest.fn(),
                target: mockForm
            };
            
            const mockFormData = {
                get: jest.fn().mockImplementation((field) => {
                    if (field === 'displayName') return 'Test User';
                    if (field === 'email') return 'test@example.com';
                    if (field === 'password') return 'TestPass123!';
                    if (field === 'confirmPassword') return 'TestPass123!';
                    return null;
                })
            };
            
            global.FormData = jest.fn().mockImplementation(() => mockFormData) as any;
            
            await authManager['handleRegister'](mockEvent as any);
            
            expect(mockFirebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith('test@example.com', 'TestPass123!');
            expect(mockFirebaseAuth.updateProfile).toHaveBeenCalledWith(mockUser, {
                displayName: 'Test User'
            });
            expect(mockUser.getIdToken).toHaveBeenCalled();
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'id-token');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('userId', 'user-123');
        });

        it('should handle email already in use error', async () => {
            const firebaseError: FirebaseError = {
                name: 'FirebaseError',
                code: 'auth/email-already-in-use',
                message: 'Email already in use'
            };
            
            mockFirebaseAuth.createUserWithEmailAndPassword.mockRejectedValue(firebaseError);
            
            const mockForm = createMockElement();
            const mockButton = createMockElement();
            mockForm.querySelector.mockReturnValue(mockButton);
            
            const mockEvent = {
                preventDefault: jest.fn(),
                target: mockForm
            };
            
            const mockFormData = {
                get: jest.fn().mockImplementation((field) => {
                    if (field === 'displayName') return 'Test User';
                    if (field === 'email') return 'existing@example.com';
                    if (field === 'password') return 'TestPass123!';
                    if (field === 'confirmPassword') return 'TestPass123!';
                    return null;
                })
            };
            
            global.FormData = jest.fn().mockImplementation(() => mockFormData) as any;
            
            await authManager['handleRegister'](mockEvent as any);
            
            expect(showFormError).toHaveBeenCalledWith(mockForm, 'An account with this email already exists');
        });

        it('should validate password confirmation', async () => {
            const mockForm = createMockElement();
            const mockButton = createMockElement();
            mockForm.querySelector.mockReturnValue(mockButton);
            
            const mockEvent = {
                preventDefault: jest.fn(),
                target: mockForm
            };
            
            const mockFormData = {
                get: jest.fn().mockImplementation((field) => {
                    if (field === 'displayName') return 'Test User';
                    if (field === 'email') return 'test@example.com';
                    if (field === 'password') return 'TestPass123!';
                    if (field === 'confirmPassword') return 'DifferentPass123!';
                    return null;
                })
            };
            
            global.FormData = jest.fn().mockImplementation(() => mockFormData) as any;
            
            await authManager['handleRegister'](mockEvent as any);
            
            expect(showFormError).toHaveBeenCalledWith(mockForm, 'Passwords do not match');
            expect(mockFirebaseAuth.createUserWithEmailAndPassword).not.toHaveBeenCalled();
        });
    });

    describe('password reset functionality', () => {
        it('should handle successful password reset', async () => {
            mockFirebaseAuth.sendPasswordResetEmail.mockResolvedValue(undefined);
            
            const mockForm = createMockElement();
            const mockButton = createMockElement();
            mockForm.querySelector.mockReturnValue(mockButton);
            mockButton.closest.mockReturnValue(mockForm);
            
            const mockEvent = {
                preventDefault: jest.fn(),
                target: mockForm
            };
            
            const mockFormData = {
                get: jest.fn().mockReturnValue('test@example.com')
            };
            
            global.FormData = jest.fn().mockImplementation(() => mockFormData) as any;
            
            await authManager['handlePasswordReset'](mockEvent as any);
            
            expect(mockFirebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
            expect(showSuccessMessage).toHaveBeenCalledWith(mockForm, 'Password reset email sent! Check your inbox.');
        });

        it('should handle user not found error', async () => {
            const firebaseError: FirebaseError = {
                name: 'FirebaseError',
                code: 'auth/user-not-found',
                message: 'User not found'
            };
            
            mockFirebaseAuth.sendPasswordResetEmail.mockRejectedValue(firebaseError);
            
            const mockForm = createMockElement();
            const mockButton = createMockElement();
            mockForm.querySelector.mockReturnValue(mockButton);
            
            const mockEvent = {
                preventDefault: jest.fn(),
                target: mockForm
            };
            
            const mockFormData = {
                get: jest.fn().mockReturnValue('nonexistent@example.com')
            };
            
            global.FormData = jest.fn().mockImplementation(() => mockFormData) as any;
            
            await authManager['handlePasswordReset'](mockEvent as any);
            
            expect(showFormError).toHaveBeenCalledWith(mockForm, 'No account found with this email address');
        });
    });

    describe('logout functionality', () => {
        it('should logout and clear localStorage', () => {
            authManager.logout();
            
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userId');
        });
    });

    describe('validation', () => {
        it('should validate email format', () => {
            const emailValidator = authManager['validateCredentials'];
            const validCredentials: LoginCredentials = {
                email: 'test@example.com',
                password: 'TestPass123!'
            };
            
            expect(() => emailValidator(validCredentials)).not.toThrow();
        });

        it('should validate password requirements', () => {
            (validateInput as jest.Mock).mockImplementation((value, options) => {
                if (options.allowedPattern && !options.allowedPattern.test(value)) {
                    return { valid: false, error: 'Invalid format' };
                }
                return { valid: true, value };
            });
            
            const weakPassword = 'weak';
            expect(() => {
                authManager['validateCredentials']({ email: 'test@example.com', password: weakPassword });
            }).toThrow();
        });
    });

    describe('sendPasswordResetEmail', () => {
        it('should send password reset email directly', async () => {
            mockFirebaseAuth.sendPasswordResetEmail.mockResolvedValue(undefined);
            
            await authManager.sendPasswordResetEmail('test@example.com');
            
            expect(mockFirebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
        });

        it('should validate email before sending reset email', async () => {
            (validateInput as jest.Mock).mockReturnValue({ valid: false, error: 'Invalid email' });
            
            await expect(authManager.sendPasswordResetEmail('invalid-email')).rejects.toThrow();
            expect(mockFirebaseAuth.sendPasswordResetEmail).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should throw error when setting invalid token', () => {
            expect(() => authManager['setToken']('')).toThrow('Invalid token provided');
        });

        it('should handle Firebase not initialized errors', async () => {
            (firebaseAuthInstance as any) = null;
            
            await expect(authManager.sendPasswordResetEmail('test@example.com')).rejects.toThrow('Firebase not initialized');
        });
    });
});