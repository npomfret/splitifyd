export const checkForDangerousPatterns = (requestString: string): boolean => {
  const dangerousPatterns = [
    /__proto__/,
    /constructor/,
    /prototype/,
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /on\w+\s*=/i
  ];

  return dangerousPatterns.some(pattern => pattern.test(requestString));
};

export const sanitizeString = (str: string): string => {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

export const isDangerousProperty = (key: string): boolean => {
  return key.startsWith('_') || 
         key.startsWith('$') || 
         key.includes('__proto__') ||
         key.includes('constructor') ||
         key.includes('prototype');
};