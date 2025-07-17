// Auth-specific types

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface FormDefaults {
  displayName?: string;
  email?: string;
  password?: string;
}

export interface UserCredential {
  user: FirebaseUser;
}

export type ValidatorFunction = (value: string) => string;

export interface ValidatorMap {
  email: ValidatorFunction;
  password: ValidatorFunction;
  displayName: ValidatorFunction;
}

export interface EventListenerInfo {
  event: string;
  handler: EventListener;
}