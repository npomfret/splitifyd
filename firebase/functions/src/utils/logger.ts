const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';
const isVerbose = process.env.VERBOSE_LOGGING === 'true';

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`ℹ️ ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️ ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (isEmulator || isVerbose) {
      console.log(`🔍 ${message}`, ...args);
    }
  },
  
  success: (message: string, ...args: any[]) => {
    if (isEmulator || isVerbose) {
      console.log(`✅ ${message}`, ...args);
    }
  },
};