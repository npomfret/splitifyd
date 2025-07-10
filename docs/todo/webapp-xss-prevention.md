# Webapp Issue: Cross-Site Scripting (XSS) Prevention

## Issue Description

The application is highly vulnerable to XSS attacks due to the widespread use of `innerHTML` with unsanitized user input.

## Recommendation

Eliminate `innerHTML` by systematically replacing all instances with safer alternatives like `textContent` for text and a secure DOM creation utility for HTML structures. Develop a `safe-dom.js` module that provides functions for programmatically creating DOM elements, preventing the direct use of string-based HTML. Implement Content Security Policy (CSP) in `firebase.json` to restrict the sources of executable scripts and other resources, providing a strong defense-in-depth against XSS.

## Implementation Suggestions

1.  **Eliminate `innerHTML`:**
    *   **Action:** Conduct a comprehensive search across the `webapp/src/js/` directory for all instances of `.innerHTML` assignments.
    *   **Replacement:**
        *   If setting plain text, use `.textContent` instead.
        *   If setting HTML, use the `createElementSafe` and `appendChildren` functions from `webapp/src/js/utils/safe-dom.ts` to construct the DOM elements programmatically.

2.  **Leverage `safe-dom.ts`:**
    *   The `webapp/src/js/utils/safe-dom.ts` file already exists and provides `createElementSafe`, `setTextContentSafe`, `clearElement`, `appendChildren`, `sanitizeText`, `isSafeString`, and `validateInput`.
    *   **Action:** Ensure all UI rendering that involves dynamic content uses these safe DOM manipulation functions.

3.  **Implement Content Security Policy (CSP):**
    *   **Action:** Configure a strict CSP in `firebase.json`.
    *   **Approach:** Add a `headers` section under `hosting` in `firebase.json`.
    *   **Example `firebase.json` snippet:**
        ```json
        {
          "hosting": {
            // ... other hosting configurations
            "headers": [
              {
                "source": "**/*.@(js|css|html)",
                "headers": [
                  {
                    "key": "Content-Security-Policy",
                    "value": "default-src 'self'; script-src 'self' https://www.gstatic.com; style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self' https://*.firebaseio.com https://*.cloudfunctions.net http://localhost:* ws://localhost:*; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
                  }
                ]
              }
            ]
          }
        }
        ```
    *   **Note:** The CSP needs to be carefully crafted and tested to avoid breaking legitimate functionality while providing strong security. Adjust `script-src`, `style-src`, `connect-src`, etc., based on all external resources your application uses.

**Next Steps:**
1.  Audit and refactor all `innerHTML` usage in the webapp.
2.  Implement and test a Content Security Policy in `firebase.json`.
