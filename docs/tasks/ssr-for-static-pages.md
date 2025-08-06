## Task: Implement Server-Side Rendering for Static Pages

**Goal:**
Ensure the landing page and other key static pages (e.g., pricing, about us) are server-side rendered (SSR) instead of client-side rendered (CSR).

**Justification:**
Search engine crawlers often struggle to properly index content that is rendered client-side with JavaScript. By implementing SSR, we serve a fully-formed HTML page to the client, which guarantees that crawlers can see and index the page content, improving our SEO.

**Acceptance Criteria:**
- The landing page (`/`) is rendered on the server.
- Other important static pages (like `/pricing`) are rendered on the server.
- When viewing the page source in a browser for these pages, the main content should be visible in the initial HTML document and not require JavaScript to be rendered.
