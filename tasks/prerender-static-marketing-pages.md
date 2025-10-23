# Task: Prerender Static Marketing Pages with i18n

## Objective
- Deliver fully prerendered HTML for public marketing routes (landing page, pricing, and any other SEO-facing pages) so crawlers get immediate content, while keeping policy/legal routes dynamic and excluded from indexing.

## Background
- Current SPA (Vite + Preact) serves an empty shell before hydration, hurting SEO.
- Static policy routes rely on `usePolicy` to fetch current text; we don't want that indexed, so they will remain dynamic and be blocked via `robots.txt` or meta tags.
- Need to respect existing i18n setup and produce locale variants for prerendered pages.

## Deliverables
- Locale-aware prerendered HTML files for selected marketing routes emitted into `firebase/public`.
- Build-time script (Node) that renders each route × locale combination using the existing i18n config.
- Deployment pipeline updates (`npm run build`) that run the prerender step.
- Robots exclusion (or equivalent meta tags) ensuring policy/legal URLs are not indexed.
- Client-side hydration setup to seamlessly take over prerendered HTML.
- SEO metadata (titles, descriptions, Open Graph tags) for each prerendered page.
- Automated tests validating prerendered output and hydration.
- Documentation snippet covering how to add new prerendered routes/locales.

## Prerequisites & Infrastructure Setup

### 1. Verify/Setup Vite SSR Support
- **Check if SSR is configured**: Review `vite.config.ts` for SSR build options.
- **Create SSR entry point**: Add `webapp-v2/src/entry-server.tsx` that exports a `render()` function using Preact's `renderToString()`.
- **Test basic SSR**: Verify you can render a simple component to HTML string in Node.js context.

### 2. i18n SSR Compatibility
- **Node.js context**: Ensure i18n library works in Node.js (no browser-specific APIs).
- **Translation loading**: Confirm translation files can be imported/bundled during SSR build.
- **Test `changeLanguage()`**: Verify calling `await i18n.changeLanguage('fr')` before `renderToString()` produces French content.
- **Handle `useTranslation()` hooks**: Ensure hooks work in server-rendered components.

### 3. Hydration Strategy
- **Client entry point**: Modify `webapp-v2/src/entry-client.tsx` to detect prerendered HTML and use Preact's `hydrate()` instead of `render()`.
- **Mismatch prevention**: Ensure server-rendered output matches client-side initial render (same props, state, content).
- **Test hydration**: Verify client-side interactivity works after hydration (event handlers, state updates).

## Implementation Plan

### Phase 1: Proof of Concept (Single Page, Single Locale)

1. **Define URL strategy**:
   - Path-based routing: `/` (English default), `/fr/` (French), `/pricing`, `/fr/pricing`
   - Root `/` serves default language (English) with `<link rel="alternate" hreflang="en" href="/">`
   - Canonical URLs established upfront to avoid redirect issues

2. **Create SSR entry** (`webapp-v2/src/entry-server.tsx`):
   ```typescript
   import { renderToString } from 'preact-render-to-string';
   import { App } from './App';

   export async function render(url: string, locale: string) {
     // Initialize i18n for SSR context
     await i18n.changeLanguage(locale);

     // Render app to HTML string
     const html = renderToString(<App url={url} />);

     return { html };
   }
   ```

3. **Setup client hydration** (`webapp-v2/src/entry-client.tsx`):
   ```typescript
   import { hydrate, render } from 'preact';
   import { App } from './App';

   const rootElement = document.getElementById('app');
   const isPrerendered = rootElement?.hasChildNodes();

   if (isPrerendered) {
     hydrate(<App />, rootElement!);
   } else {
     render(<App />, rootElement!);
   }
   ```

4. **Create basic prerender script** (`scripts/prerender-static-pages.mjs`):
   - Import the SSR entry's `render()` function
   - Test rendering landing page for `en` locale only
   - Write output to `webapp-v2/dist-ssr/index.html`
   - Verify HTML contains actual content (not empty shell)

5. **Test end-to-end**:
   - Run prerender script
   - Serve `dist-ssr/index.html` with a static file server
   - Open in browser, verify content loads instantly
   - Verify client-side hydration activates (check console, test interactivity)

### Phase 2: Multi-Locale Support

6. **Extend prerender script**:
   - Define routes array: `['/', '/pricing']`
   - Define locales array: `['en', 'fr']`
   - Iterate `routes × locales` (e.g., `/`, `/fr/`, `/pricing`, `/fr/pricing`)
   - For each combination:
     - Call `render(route, locale)`
     - Write HTML to appropriate path (e.g., `dist-ssr/fr/index.html`)

7. **Add hreflang metadata**:
   - Create helper function to generate hreflang links for all locale variants
   - Update `StaticPageLayout` or `BaseLayout` to inject:
     ```html
     <link rel="alternate" hreflang="en" href="https://example.com/" />
     <link rel="alternate" hreflang="fr" href="https://example.com/fr/" />
     <link rel="alternate" hreflang="x-default" href="https://example.com/" />
     ```
   - Pass available locales and current locale to layout component during SSR

8. **SEO metadata per page**:
   - Add page-specific `<title>`, `<meta name="description">`, Open Graph tags
   - Ensure metadata is locale-aware (different titles/descriptions per language)
   - Consider using a `Head` component or similar abstraction

### Phase 3: Build Integration & Deployment

9. **Update robots.txt** (`firebase/public/robots.txt`):
   ```
   User-agent: *
   Disallow: /terms
   Disallow: /privacy
   Disallow: /cookies
   ```

10. **Add noindex meta tags to policy pages**:
    - In policy page components, add:
      ```tsx
      <meta name="robots" content="noindex, nofollow" />
      ```

11. **Integrate with build pipeline**:
    - Add `npm run build:prerender` script in `webapp-v2/package.json`
    - Update root `npm run build` to:
      1. Build webapp normally (`npm run build` in `webapp-v2`)
      2. Run prerender script (`npm run build:prerender`)
      3. Copy prerendered HTML files to `firebase/public/`
    - Ensure Firebase hosting config serves prerendered files with fallback to SPA

12. **Firebase hosting configuration**:
    - Update `firebase.json` hosting config to:
      - Serve prerendered HTML files for marketing routes
      - Use SPA rewrites for non-prerendered routes
    - Example:
      ```json
      {
        "hosting": {
          "public": "public",
          "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
          "rewrites": [
            {
              "source": "**",
              "destination": "/index.html"
            }
          ]
        }
      }
      ```

### Phase 4: Testing & Verification

13. **Automated tests** (Playwright):
    - Test that marketing pages (`/`, `/pricing`) serve prerendered HTML immediately (not empty shell)
    - Test hydration: verify client-side interactivity works (button clicks, navigation)
    - Test locale variants: verify `/fr/` serves French content
    - Test hreflang tags: verify correct alternate links in `<head>`
    - Test SEO metadata: verify titles, descriptions, Open Graph tags per locale
    - Test policy pages: verify they remain client-side rendered, have noindex meta tags

14. **Manual verification**:
    - Run `npm run build:prerender` locally
    - Inspect generated HTML files for:
      - Actual content (not empty `<div id="app"></div>`)
      - Correct locale-specific content
      - Proper hreflang tags
      - Complete SEO metadata
    - Serve locally with `firebase serve` and test in browser
    - Disable JavaScript and verify content is visible (true SSR test)

15. **Production deployment**:
    - Deploy to staging environment first
    - Verify with Google Search Console that pages are crawlable
    - Run Lighthouse SEO audit
    - Monitor for hydration errors in production logs

## Scope Decisions

### Initial Scope (v1)
- Landing page (`/`) and pricing page (`/pricing`) only
- Two locales: English (`en`) and French (`fr`)
- Basic SEO metadata (title, description)
- Simple robots.txt exclusion for policy pages

### Future Scope (v2+)
- Additional marketing pages (features, about, blog)
- More locales as needed
- Advanced SEO: structured data (JSON-LD), Twitter cards
- Dynamic sitemap generation
- Client-side language selector with localStorage persistence

## Open Questions - Resolved

### Locale selection strategy
**Decision**: Path-based routing only for prerendered pages. Default language (English) served at `/`, other locales at `/fr/`, etc. Client-side language selector can be added later to navigate between paths.

### Automated testing
**Decision**: Yes, Playwright tests required to validate:
- Prerendered HTML contains content (not empty shell)
- Hydration works correctly
- Locale variants render appropriate content
- SEO metadata is present and correct

### Additional marketing pages
**Decision**: Start with landing page and pricing only. Add blog/features as separate task once SSR infrastructure is proven.

## Risks & Mitigation

### Risk: Hydration mismatches
**Mitigation**: Keep initial render deterministic (no client-only state, no random values). Test thoroughly with hydration warnings enabled.

### Risk: i18n doesn't work in Node.js
**Mitigation**: Verify i18n SSR compatibility in Phase 1. If issues arise, consider alternative i18n library or custom solution.

### Risk: Build complexity increases significantly
**Mitigation**: Keep prerender script simple. Start with minimal scope (2 pages × 2 locales = 4 HTML files). Scale gradually.

### Risk: Firebase hosting serves wrong files
**Mitigation**: Test locally with `firebase serve`. Review hosting rewrite rules carefully. Use Firebase hosting preview channels for testing.

## Success Criteria

- [ ] Marketing pages serve prerendered HTML (verified by viewing source)
- [ ] Lighthouse SEO score improves (target: 90+)
- [ ] Hydration works without console warnings
- [ ] All locale variants render correct language content
- [ ] hreflang tags present and correct
- [ ] Policy pages remain dynamic and excluded from indexing
- [ ] Automated tests pass (prerender + hydration + SEO metadata)
- [ ] Documentation added for adding new routes/locales
