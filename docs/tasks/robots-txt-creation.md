# Robots.txt Creation Task

## Current Status
The task file currently contains a draft robots.txt configuration.

## Implementation Plan

### 1. Analyze Current Application Structure
- [ ] Review webapp-v2 routing structure to identify all public and private pages
- [ ] Check Firebase hosting configuration for URL patterns
- [ ] Identify API endpoints that should be blocked from crawling

### 2. Define Crawling Strategy
- [ ] **Public Pages to Allow:**
  - `/` (homepage)
  - `/pricing` (pricing page)
  - `/about` (if exists)
  - `/terms` (terms of service)
  - `/privacy` (privacy policy)
  - `/contact` (contact page)
  - `/faq` (if exists)

- [ ] **Private/Protected Pages to Disallow:**
  - `/dashboard/*` (user dashboard)
  - `/groups/*` (group pages)
  - `/add-expense/*` (expense forms)
  - `/settings/*` (user settings)
  - `/profile/*` (user profiles)
  - `/auth/*` (authentication pages)
  - `/api/*` (API endpoints)
  - `/admin/*` (admin pages if any)

### 3. Create robots.txt File
- [ ] Location: `/Users/nickpomfret/projects/splitifyd-2/webapp-v2/public/robots.txt`
- [ ] Ensure it's served from the root domain path

### 4. Recommended robots.txt Content
```
# Splitifyd robots.txt
# Allow search engines to crawl public pages

User-agent: *
# Public pages
Allow: /$
Allow: /pricing
Allow: /about
Allow: /terms
Allow: /privacy
Allow: /contact
Allow: /faq
Allow: /login
Allow: /register

# Block private/authenticated areas
Disallow: /dashboard/
Disallow: /groups/
Disallow: /add-expense/
Disallow: /settings/
Disallow: /profile/
Disallow: /api/
Disallow: /admin/
Disallow: /.well-known/

# Block temporary/development files
Disallow: /*.json$
Disallow: /*.map$
Disallow: /node_modules/
Disallow: /src/
Disallow: /.git/

# Sitemap location (if available)
# Sitemap: https://splitifyd.com/sitemap.xml

# Crawl delay (optional - be nice to servers)
Crawl-delay: 1
```

### 5. Additional SEO Considerations
- [ ] Create sitemap.xml for better indexing of allowed pages
- [ ] Add meta robots tags to individual pages for fine-grained control
- [ ] Implement proper canonical URLs
- [ ] Ensure proper 404 handling for disallowed paths

### 6. Testing & Validation
- [ ] Test robots.txt is accessible at `/robots.txt` in development
- [ ] Use Google's robots.txt tester tool
- [ ] Verify with `curl http://localhost:6002/robots.txt` locally
- [ ] Check that authenticated routes return proper 401/403 status codes

### 7. Firebase Configuration
- [ ] Ensure Firebase hosting serves robots.txt correctly
- [ ] Update firebase.json if needed to include robots.txt in public files
- [ ] Test in Firebase emulator that robots.txt is served with correct MIME type

### 8. Implementation Steps
1. Create robots.txt file in webapp-v2/public/ directory
2. Add the recommended content above
3. Test locally with Firebase emulator
4. Verify accessibility at root domain
5. Deploy to production
6. Monitor search console for crawling issues

### Notes
- The current draft is too restrictive with `Disallow: /` after allowing specific paths
- Need to be more specific about what to block vs allow
- Consider different rules for different crawlers if needed (e.g., Googlebot vs others)
- Remember that robots.txt is publicly visible - don't expose sensitive path information