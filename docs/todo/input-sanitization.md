# Lack of Input Sanitation

## Problem
- **Location**: `firebase/functions/src/documents/handlers.ts`, `firebase/functions/src/expenses/handlers.ts`
- **Description**: Some of the API handlers do not properly sanitize user input before storing it in the database. For example, in `createDocument`, the `data` object from the request body is sanitized, but the sanitization is not comprehensive enough. This could allow malicious users to inject harmful data into the database, leading to Cross-Site Scripting (XSS) or other vulnerabilities.
- **Current vs Expected**: Currently, input sanitation is inconsistent and incomplete. All user-provided input should be rigorously sanitized before being stored or used in the application.

## Solution
- **Approach**: Use a library like `xss` or `DOMPurify` on the backend to sanitize all user-provided strings before they are stored in the database. This should be done in a centralized place, such as a middleware or a validation layer, to ensure that all input is sanitized consistently.
- **Code Sample**:
  ```typescript
  import xss from 'xss';

  // In a validation or middleware layer
  function sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = xss(obj[key]);
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeObject(obj[key]);
      }
    }
    return obj;
  }

  // In the handlers
  const sanitizedData = sanitizeObject(req.body.data);
  // ... proceed with sanitizedData
  ```

## Impact
- **Type**: Behavior change
- **Risk**: Medium (improperly configured sanitization can break legitimate functionality)
- **Complexity**: Moderate
- **Benefit**: High value (improves security and prevents XSS vulnerabilities)

## Implementation Notes
This is a critical security issue that should be addressed with high priority. It's important to carefully configure the sanitization library to allow for legitimate HTML tags and attributes if they are needed, while still preventing malicious code from being executed.