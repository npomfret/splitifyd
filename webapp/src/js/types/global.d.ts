// Global window extensions
declare global {
  interface Window {
    firebaseAuth: {
      signInWithEmailAndPassword(email: string, password: string): Promise<any>;
      createUserWithEmailAndPassword(email: string, password: string): Promise<any>;
      updateProfile(user: any, profile: { displayName: string }): Promise<void>;
      sendPasswordResetEmail(email: string): Promise<void>;
      onAuthStateChanged(callback: (user: any) => void): () => void;
      getCurrentUser(): any;
    };
    ModalComponent: {
      render(config: {
        id: string;
        title: string;
        content: string;
        confirmText: string;
        cancelText: string;
        showCancelButton: boolean;
      }): string;
      show(modalId: string): void;
      hide(modalId: string): void;
    };
  }
}

// Global functions (from warning-banner.js)
declare function showWarning(message: string): void;
declare function hideWarning(): void;

// Validation types (for safe-dom.ts)
interface ValidationOptions {
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  allowedPattern?: RegExp | null;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: string;
}

// Config types
interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface ConfigData {
  firebaseConfig: FirebaseConfig;
  apiUrl: string;
  isLocal: boolean;
  formDefaults?: any;
  warningBanner?: any;
}

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Domain types
interface User {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  groups?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface Group {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  groupId: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  splits?: ExpenseSplit[];
}

interface ExpenseSplit {
  userId: string;
  amount: number;
}

interface Settlement {
  id: string;
  groupId: string;
  paidBy: string;
  paidTo: string;
  amount: number;
  createdAt: string;
  createdBy: string;
}

// Logger types (for logger.ts)
interface Logger {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export {
  ValidationOptions,
  ValidationResult,
  FirebaseConfig,
  ConfigData,
  ApiResponse,
  User,
  Group,
  Expense,
  ExpenseSplit,
  Settlement,
  Logger
};