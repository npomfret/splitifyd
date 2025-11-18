# Task: Refactor Static Pages for White-Label Model

## Objective
Remove built-in policy/legal pages from the application and replace them with configurable external links that tenants can manage, aligning with the white-label business model.

## Background
- Current implementation has hardcoded Terms, Privacy, and Cookie policy pages in the app
- As a white-label platform, each tenant should manage their own legal documentation
- Tenants may want to link to external policy pages hosted on their own infrastructure
- The app should not maintain or serve legal content on behalf of tenants

## Current State
- Policy pages: `/terms`, `/privacy`, `/cookies` (components in `webapp-v2/src/pages/static/`)
- Routes defined in `App.tsx` for these pages
- `usePolicy` hook fetches policy content dynamically
- Footer links to these internal routes
- `PolicyAcceptanceModal` shows policies to users

## Deliverables

### 1. Tenant Configuration Schema
- [ ] Add `externalLinks` configuration to tenant branding settings
  ```typescript
  {
    tenant: {
      branding: {
        externalLinks?: {
          termsOfService?: string;    // URL to tenant's terms page
          privacyPolicy?: string;      // URL to tenant's privacy page
          cookiePolicy?: string;       // URL to tenant's cookie page
          // Future: support, help center, etc.
        }
      }
    }
  }
  ```
- [ ] Update tenant config types in shared package
- [ ] Add validation for URL format (must be valid HTTPS URLs)

### 2. Remove Static Policy Pages
- [ ] Delete `webapp-v2/src/pages/static/TermsOfServicePage.tsx`
- [ ] Delete `webapp-v2/src/pages/static/PrivacyPolicyPage.tsx`
- [ ] Delete `webapp-v2/src/pages/static/CookiePolicyPage.tsx`
- [ ] Remove corresponding routes from `App.tsx`
- [ ] Remove lazy-loaded imports for these pages
- [ ] Keep `PricingPage` if tenants use it, or remove if not needed

### 3. Update Policy System
- [ ] Modify `usePolicy` hook to handle external URLs
  - If tenant has `externalLinks` configured, return those
  - Otherwise, return empty/null (no policy links)
- [ ] Update `PolicyAcceptanceModal` behavior:
  - Option A: Remove it entirely (tenants handle acceptance externally)
  - Option B: Show modal with links to external policies
  - Option C: Make it configurable per tenant
- [ ] Update policy acceptance tracking in Firestore:
  - Continue tracking acceptance dates for audit purposes
  - But don't enforce acceptance if no external links configured

### 4. Footer Component Updates
- [ ] Update footer to use `externalLinks` configuration
- [ ] Links should open in new tab (`target="_blank" rel="noopener noreferrer"`)
- [ ] If no external links configured, hide policy link section entirely
- [ ] Example footer structure:
  ```tsx
  {config.tenant.branding.externalLinks && (
    <div class="footer-links">
      {externalLinks.termsOfService && (
        <a href={externalLinks.termsOfService} target="_blank" rel="noopener noreferrer">
          {t('footer.terms')}
        </a>
      )}
      {externalLinks.privacyPolicy && (
        <a href={externalLinks.privacyPolicy} target="_blank" rel="noopener noreferrer">
          {t('footer.privacy')}
        </a>
      )}
      {externalLinks.cookiePolicy && (
        <a href={externalLinks.cookiePolicy} target="_blank" rel="noopener noreferrer">
          {t('footer.cookies')}
        </a>
      )}
    </div>
  )}
  ```

### 5. Admin UI for Configuration
- [ ] Add "External Links" section to Tenant Branding page
- [ ] Input fields for each policy URL (optional)
- [ ] URL validation (must be HTTPS, valid format)
- [ ] Preview/test buttons to verify links work
- [ ] Save to Firestore tenant document

### 6. Database Migration
- [ ] No migration needed (additive change)
- [ ] Existing tenants will have no `externalLinks` → no footer links shown
- [ ] Document how to configure links in tenant admin guide

### 7. Testing
- [ ] Test with tenant that has no external links configured (footer hidden)
- [ ] Test with tenant that has some links configured (only those shown)
- [ ] Test with tenant that has all links configured (all shown in footer)
- [ ] Test URL validation (reject invalid URLs)
- [ ] Test links open in new tab
- [ ] Test policy acceptance modal behavior (if kept)
- [ ] Verify removed routes return 404

### 8. Documentation
- [ ] Update tenant admin documentation:
  - How to configure external policy links
  - Recommended: host policies on tenant's own domain
  - Legal disclaimer (tenant responsible for their own policies)
- [ ] Update developer documentation:
  - Remove references to built-in policy pages
  - Document `externalLinks` configuration schema

## Implementation Phases

### Phase 1: Schema & Configuration (Backend)
1. Update tenant config types in `@splitifyd/shared`
2. Add Firestore validation for `externalLinks` field
3. Add admin UI in Tenant Branding page for link configuration

### Phase 2: Frontend Refactoring
4. Update `usePolicy` hook and policy-related components
5. Update footer component to use external links
6. Decide on `PolicyAcceptanceModal` approach and implement

### Phase 3: Cleanup
7. Remove static policy page components and routes
8. Remove unused imports and dependencies
9. Run tests and fix any breaks

### Phase 4: Documentation & Testing
10. Write tenant admin guide for configuring links
11. Manual testing with various configurations
12. Automated tests for link rendering logic

## Open Questions

### Policy Acceptance Modal
**Question**: What should happen with the `PolicyAcceptanceModal`?

**Options**:
- A) **Remove entirely**: Tenants handle policy acceptance on their own sites before sending users to the app
- B) **Keep with external links**: Show modal with "Review our policies" and links to external pages
- C) **Configurable**: Tenant can enable/disable forced policy acceptance

**Recommendation**: Option A (remove) - simplest, cleanest white-label approach. If tenant needs acceptance tracking, they can build it themselves.

### Pricing Page
**Question**: Should we keep the `/pricing` page or remove it too?

**Analysis**:
- Currently conditionally rendered based on `showPricingPage` flag
- Also tenant-specific (per-tenant pricing)
- Could also be externalized

**Recommendation**: Keep for now (separate decision). Some tenants may want in-app pricing, others may prefer external. Can revisit later.

### Default/Sample Tenant
**Question**: Should the default tenant (for demos/testing) have sample external links?

**Recommendation**: No - keep it clean. Admins can add test URLs manually if needed.

## Success Criteria

- [ ] No hardcoded policy page components in the webapp
- [ ] Tenant can configure 0-3 external policy links
- [ ] Footer shows only configured links, hides section if none
- [ ] Links open in new tab with proper security attributes
- [ ] Admin UI allows easy configuration with validation
- [ ] Existing tenants continue to work (no footer links shown)
- [ ] Documentation explains how tenants should handle policies
- [ ] All tests pass

## Security Considerations

- **URL validation**: Must be HTTPS (prevent HTTP links)
- **XSS prevention**: URLs should be validated/sanitized before rendering
- **Open redirect**: Links use `rel="noopener noreferrer"` for security
- **Tenant isolation**: Each tenant only sees/edits their own links

## Future Enhancements

- Add more link types (support, help center, contact us, etc.)
- Allow custom link labels per tenant (i18n)
- Track link click analytics per tenant
- Support for footer customization (logo, social links, etc.)
