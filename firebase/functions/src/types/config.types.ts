export interface AppConfiguration {
  firebase: FirebaseConfig;
  api: ApiConfig;
  features: FeatureFlags;
  environment: EnvironmentConfig;
  formDefaults?: FormDefaults;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface FeatureFlags {
  [key: string]: boolean;
}

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isEmulator: boolean;
  warningBanner?: WarningBanner;
  emulatorPorts?: EmulatorPorts;
}

export interface WarningBanner {
  enabled: boolean;
  message: string;
}

export interface EmulatorPorts {
  auth?: number;
  firestore?: number;
  functions?: number;
  hosting?: number;
}

export interface FormDefaults {
  displayName?: string;
  email?: string;
  password?: string;
}