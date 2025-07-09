# Security Hardening Plan

This document outlines a comprehensive plan to address critical security vulnerabilities in the Splitifyd application.

## 1. Cross-Site Scripting (XSS) Prevention

*   **Problem:** The application is highly vulnerable to XSS attacks due to the widespread use of `innerHTML` with unsanitized user input.
*   **Solution:**
    1.  **Eliminate `innerHTML`:** Systematically replace all instances of `innerHTML` with safer alternatives like `textContent` for text and a secure DOM creation utility for HTML structures.
    2.  **Create a Safe DOM Utility:** Develop a `safe-dom.js` module that provides functions for programmatically creating DOM elements, preventing the direct use of string-based HTML.
    3.  **Implement Content Security Policy (CSP):** Configure a strict CSP in `firebase.json` to restrict the sources of executable scripts and other resources, providing a strong defense-in-depth against XSS.

## 2. Secure API Key and Secret Management

*   **Problem:** The application has hardcoded API keys and other secrets in the source code (`firebase/functions/src/config.ts`), and insecure fallback values.
*   **Solution:**
    1.  **Use Environment Variables:** Refactor the configuration to load all secrets from `process.env`.
    2.  **Enforce Strict Production Configuration:** In a production environment, the application should fail to start if any required environment variables are missing, rather than using insecure defaults.
    3.  **Use `.env` files for Local Development:** Provide a `.env.example` file for developers and ensure `.env` files are git-ignored.
    4.  **Use a Secret Management Service:** For deployed environments, leverage a secure secret management solution like Google Secret Manager, integrated with Firebase Functions.

## 3. Secure Token Generation

*   **Problem:** Shareable group links are generated using `Math.random()`, which is not cryptographically secure and could allow attackers to guess valid links.
*   **Solution:**
    1.  **Use the `crypto` Module:** Replace `Math.random()` with Node.js's built-in `crypto.randomBytes()` to generate high-entropy, unpredictable tokens for all shareable links.

## 4. Input Validation and Sanitization

*   **Problem:** The application lacks consistent client-side and server-side input validation, trusting user input implicitly.
*   **Solution:**
    1.  **Create a Shared Validation Library:** Develop a validation utility (e.g., `validation.js`) with functions for common checks (e.g., `isNotEmpty`, `isValidEmail`, `isSafeString`).
    2.  **Enforce Client-Side Validation:** Use the validation library to provide immediate feedback to users on all forms.
    3.  **Enforce Server-Side Validation:** The API should re-validate all incoming data to protect against malicious requests that bypass the client-side checks.

By implementing these four key initiatives, the security posture of the Splitifyd application will be significantly improved.