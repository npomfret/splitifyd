# Robots.txt Creation Task

## Current Status
✅ **COMPLETED** - robots.txt has been successfully created and deployed to the Firebase emulator.

## Implementation Plan

### 1. Analyze Current Application Structure
- [x] Review webapp-v2 routing structure to identify all public and private pages
- [x] Check Firebase hosting configuration for URL patterns
- [x] Identify API endpoints that should be blocked from crawling

### 2. Define Crawling Strategy
- [x] **Public Pages to Allow:**
  - `/` (homepage)
  - `/pricing` (pricing page)
  - `/about` (if exists)
  - `/terms` (terms of service)
  - `/privacy` (privacy policy)
  - `/contact` (contact page)
  - `/faq` (if exists)

- [x] **Private/Protected Pages to Disallow:**
  - `/dashboard/*` (user dashboard)
  - `/groups/*` (group pages)
  - `/add-expense/*` (expense forms)
  - `/settings/*` (user settings)
  - `/profile/*` (user profiles)
  - `/auth/*` (authentication pages)
  - `/api/*` (API endpoints)
  - `/admin/*` (admin pages if any)

### 3. Create robots.txt File
- [x] Location: `/Users/nickpomfret/projects/splitifyd-2/webapp-v2/public/robots.txt`
- [x] Ensure it's served from the root domain path

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
- [x] Test robots.txt is accessible at `/robots.txt` in development
- [ ] Use Google's robots.txt tester tool (for production)
- [x] Verify with `curl http://localhost:6002/robots.txt` locally
- [ ] Check that authenticated routes return proper 401/403 status codes

### 7. Firebase Configuration
- [x] Ensure Firebase hosting serves robots.txt correctly
- [x] Update firebase.json if needed to include robots.txt in public files (Vite handles this)
- [x] Test in Firebase emulator that robots.txt is served with correct MIME type (text/plain)

### 8. Implementation Steps
1. ✅ Create robots.txt file in webapp-v2/public/ directory
2. ✅ Add the recommended content above
3. ✅ Test locally with Firebase emulator
4. ✅ Verify accessibility at root domain
5. ⏳ Deploy to production (pending)
6. ⏳ Monitor search console for crawling issues (post-deployment)

### Notes
- ✅ Fixed overly restrictive `Disallow: /` rule
- ✅ Implemented specific allow/disallow rules based on actual app routes
- ✅ Added support for both root (`/`) and production (`/v2/`) URL patterns
- ✅ Protected sensitive paths without exposing internal structure

## Implementation Details

### Created File
**Location:** `/Users/nickpomfret/projects/splitifyd-2/webapp-v2/public/robots.txt`

### Key Decisions
1. **Removed redundant Allow directives:** Everything is allowed by default, so explicit allows are unnecessary
2. **Fixed regex patterns:** Removed `$` anchors from file patterns for better crawler compatibility
3. **Improved structure:** Reorganized with clear section headers for better readability
4. **Block private pages:** Dashboard, groups, expenses, join pages, API endpoints
5. **Block development artifacts:** Source files, node_modules, build files
6. **Added crawl delay:** Set to 1 second to be respectful to server resources
7. **Prepared for sitemap:** Included commented sitemap location for future implementation

### Improvements Made (Based on Code Review)
- ✅ Removed unnecessary Allow directives (implicit by default)
- ✅ Fixed regex syntax - removed `$` from patterns like `/*.js$` → `/*.js`
- ✅ Reorganized file structure with clear section headers
- ✅ Added metadata (URL, last updated date)
- ✅ Improved comments for clarity

### Verification
- ✅ File accessible at `http://localhost:6002/robots.txt`
- ✅ Correct Content-Type: `text/plain; charset=utf-8`
- ✅ Content properly formatted and valid robots.txt syntax
- ✅ Vite build process automatically copies public files to dist directory
- ✅ Follows robots.txt best practices and standards