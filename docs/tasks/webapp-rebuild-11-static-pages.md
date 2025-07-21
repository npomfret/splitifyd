# Webapp Rebuild Task 11: Migrate Static Pages

## Overview
Migrate all static content pages (pricing, terms of service, privacy policy, cookie policy) to Preact with improved SEO and maintainability.

## Prerequisites
- [ ] Complete webapp-rebuild-10-join-group.md
- [ ] Basic Preact app structure working
- [ ] Routing system configured

## Current State
- Static HTML pages with basic content
- Minimal styling and layout
- No dynamic features
- Basic SEO meta tags

## Target State
- Component-based static pages
- Enhanced SEO optimization
- Better visual design
- Improved mobile experience
- Easy content management

## Implementation Steps

### Phase 1: Static Page Structure (1 hour)

1. **Base static page component** (`components/StaticPageLayout.tsx`)
   - [ ] Common layout for all static pages
   - [ ] Header with navigation
   - [ ] Footer with links
   - [ ] SEO metadata integration
   - [ ] Responsive design

2. **Individual page components**
   ```
   pages/static/
   ├── PricingPage.tsx
   ├── TermsOfServicePage.tsx
   ├── PrivacyPolicyPage.tsx
   └── CookiePolicyPage.tsx
   ```

### Phase 2: Pricing Page (1 hour)

1. **Pricing component** (`pages/static/PricingPage.tsx`)
   - [ ] Pricing tiers display
   - [ ] Feature comparison table
   - [ ] FAQ section
   - [ ] CTA buttons for signup
   - [ ] Contact information

2. **Pricing features**
   - [ ] Highlight free tier
   - [ ] Premium feature callouts
   - [ ] Billing period toggles (if applicable)
   - [ ] Currency selection (if applicable)
   - [ ] Testimonials or social proof

### Phase 3: Legal Pages (2 hours)

1. **Terms of Service** (`pages/static/TermsOfServicePage.tsx`)
   - [ ] Port existing terms content
   - [ ] Structured sections with navigation
   - [ ] Last updated date
   - [ ] Contact information
   - [ ] Clear typography hierarchy

2. **Privacy Policy** (`pages/static/PrivacyPolicyPage.tsx`)
   - [ ] Data collection practices
   - [ ] Cookie usage information
   - [ ] Third-party services
   - [ ] User rights and controls
   - [ ] Contact for privacy concerns

3. **Cookie Policy** (`pages/static/CookiePolicyPage.tsx`)
   - [ ] Types of cookies used
   - [ ] Purpose and necessity
   - [ ] Management instructions
   - [ ] Third-party cookies
   - [ ] Policy updates

### Phase 4: SEO and Metadata (1 hour)

1. **SEO optimization**
   - [ ] Unique meta titles for each page
   - [ ] Meta descriptions
   - [ ] Open Graph tags
   - [ ] Schema.org structured data
   - [ ] Canonical URLs

2. **Content optimization**
   - [ ] Proper heading hierarchy (H1, H2, H3)
   - [ ] Internal linking strategy
   - [ ] Keyword optimization
   - [ ] Mobile-friendly formatting
   - [ ] Fast loading content

### Phase 5: Content Management (1 hour)

1. **Content structure**
   - [ ] Separate content from components
   - [ ] Easy content updates
   - [ ] Version control for content
   - [ ] Consistent formatting

2. **Maintenance features**
   - [ ] Last updated timestamps
   - [ ] Change notifications
   - [ ] Content review reminders
   - [ ] Easy content deployment

## In-Browser Testing Checklist

### Page Loading

1. **All static pages load correctly**
   - [ ] Pricing page displays properly
   - [ ] Terms of service readable
   - [ ] Privacy policy accessible
   - [ ] Cookie policy loads

2. **Navigation and links**
   - [ ] Internal navigation works
   - [ ] External links open correctly
   - [ ] Breadcrumbs functional
   - [ ] Footer links work

### Content Display

1. **Typography and formatting**
   - [ ] Text readable on all devices
   - [ ] Proper heading hierarchy
   - [ ] Lists formatted correctly
   - [ ] Tables responsive

2. **Visual design**
   - [ ] Consistent with app branding
   - [ ] Good contrast ratios
   - [ ] Proper spacing
   - [ ] Professional appearance

### SEO Validation

1. **Meta tags**
   - [ ] Unique titles for each page
   - [ ] Descriptive meta descriptions
   - [ ] Open Graph tags present
   - [ ] Schema markup valid

2. **Content structure**
   - [ ] H1 tags unique and descriptive
   - [ ] Logical heading hierarchy
   - [ ] Internal links appropriate
   - [ ] Content accessible

### Mobile Experience

1. **Responsive design**
   - [ ] Text readable on mobile
   - [ ] Navigation works on touch
   - [ ] Tables scroll or adapt
   - [ ] No horizontal scroll

2. **Performance**
   - [ ] Fast loading on mobile
   - [ ] Minimal JavaScript needed
   - [ ] Efficient image usage
   - [ ] Good Core Web Vitals

### Legal Compliance

1. **Required information**
   - [ ] Terms cover all necessary points
   - [ ] Privacy policy complete
   - [ ] Cookie policy accurate
   - [ ] Contact information present

2. **Updates and maintenance**
   - [ ] Last updated dates accurate
   - [ ] Change notification system
   - [ ] Regular review process
   - [ ] Version control in place

## Deliverables

1. **Four static pages** fully migrated
2. **SEO optimization** implemented
3. **Responsive design** for all pages
4. **Content management** system
5. **Legal compliance** maintained

## Success Criteria

- [ ] All static pages working correctly
- [ ] Better SEO than original pages
- [ ] Improved mobile experience
- [ ] Easy content maintenance
- [ ] Legal requirements met
- [ ] Fast page loading

## Content Migration Notes

1. **Pricing page**
   - Verify current pricing accurate
   - Update feature lists
   - Check competitor positioning
   - Ensure legal compliance

2. **Legal pages**
   - Review with legal team
   - Update for current practices
   - Ensure GDPR compliance
   - Check regional requirements

3. **SEO considerations**
   - Research relevant keywords
   - Optimize for local search
   - Implement structured data
   - Plan content updates

## Timeline

- Start Date: TBD
- End Date: TBD
- Duration: ~6 hours

## Notes

- These pages are important for legal compliance
- SEO optimization can improve organic traffic
- Content accuracy is critical
- Consider automated testing for broken links