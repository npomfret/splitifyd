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
- Documentation snippet covering how to add new prerendered routes/locales.

## Implementation Plan
1. **Define locales & URL strategy**: Confirm supported marketing locales (e.g. `en`, `fr`) and map them to output paths (`/`, `/fr/`, `/pricing`, `/fr/pricing`).
2. **Update robots indexing rules**: Add or adjust `firebase/public/robots.txt` (or page-level meta) to disallow `/terms`, `/privacy`, `/cookies`, and any other policy aliases.
3. **Author prerender script**: Create `scripts/prerender-static-pages.mjs` that:
   - Bootstraps Vite SSR entry.
   - Iterates over `routes × locales`.
   - Calls `await i18n.changeLanguage(locale)` before rendering.
   - Writes HTML files (plus supporting assets like route-specific `index.html`) into a staging folder.
4. **Integrate with build**: Wire script into `webapp-v2` build pipeline (`npm run build` or a new `npm run build:prerender`) and copy artifacts into `firebase/public` prior to deploy.
5. **Emit hreflang metadata**: Update `StaticPageLayout` or `BaseLayout` to include `<link rel="alternate" hreflang="…">` tags for each localized prerendered URL.
6. **Verification**: Run prerender locally, ensure HTML renders correctly, hydration completes without warnings, and that legal pages still fetch policy content dynamically.

## Open Questions
- Should locale selection fall back to path-based routing only, or do we want a language-selector that rewrites URLs?
- Do we need automated tests (e.g. Playwright) to validate prerendered output per locale?
- Are there additional marketing pages (blog, features) we anticipate soon that should be included now?
