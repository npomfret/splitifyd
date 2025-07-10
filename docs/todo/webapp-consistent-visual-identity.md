# Webapp Issue: Create a Consistent Visual Identity

## Issue Description

The static pages (Terms of Service, Privacy Policy) have a completely different and unprofessional visual style compared to the main application.

## Recommendation

Use a single stylesheet and create a consistent layout for all pages.

## Implementation Suggestions

1.  **Use a Single Stylesheet:**
    *   **Action:** Remove the `static-pages.css` file and ensure all pages, including static ones, link to the main `main.css` stylesheet.
    *   **Approach:** Review all HTML files (`privacy-policy.html`, `terms-of-service.html`, etc.) and update their `<link rel="stylesheet">` tags to point only to `main.css` and `utility.css` (if applicable).

2.  **Create a Consistent Layout:**
    *   **Action:** Wrap the content of static pages in a standard container element that reuses the styling (e.g., background, padding, box-shadow) from the main application, ensuring a seamless look and feel.
    *   **Approach:** Define a common HTML structure for the main content area in `main.css` (e.g., a `div` with class `main-content` or `app-container`). Apply this class to the main content wrapper in all HTML files, including the static ones.
    *   **Example:**
        ```html
        <!-- In privacy-policy.html or terms-of-service.html -->
        <body>
            <div class="main-content">
                <article class="static-page-content">
                    <!-- Your policy content here -->
                </article>
            </div>
        </body>
        ```
        And ensure `main-content` has the desired background, padding, etc., in `main.css`.

**Next Steps:**
1.  Update stylesheet links in all static HTML files.
2.  Apply a consistent main content wrapper to all static HTML files and ensure its styling is defined in `main.css`.
