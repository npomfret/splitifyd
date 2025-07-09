import type { Logger } from '../types/global';

function formatArgs(args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return '[[Circular Reference]]';
      }
    }
    return arg;
  });
}

export const logger: Logger = {
  log: (...args: any[]): void => {
    console.log(...formatArgs(args));
  },
  warn: (...args: any[]): void => {
    console.warn(...formatArgs(args));
  },
  error: (...args: any[]): void => {
    console.error(...formatArgs(args));
  },
};