# Webapp Rebuild Task 4: Migrate Landing Page

## Status: ✅ COMPLETED

## Overview
Migrate the landing page to Preact, including the complex Three.js globe animation, as the first real page migration to prove the approach.

## Prerequisites
- [x] Working Preact app with basic routing (already have this)
- [x] Firebase hosting configured for webapp-v2 (already done at `/v2/*`)

## Current State
- Static HTML at `webapp/src/pages/index.html`
- Complex Three.js globe in `globe.ts`
- GSAP animations for scroll effects
- Custom CSS animations
- Static content sections

## Target State
- Fully functional Preact landing page
- Globe animation working identically
- All animations preserved
- Improved performance
- Component-based structure

## Implementation Steps

### Phase 1: Component Structure (1 hour)

1. **Page component** (`webapp-v2/src/pages/LandingPage.tsx`)
   - [ ] Create main page component
   - [ ] Import required styles
   - [ ] Set up page layout
   - [ ] Add SEO metadata

2. **Section components**
   ```
   components/landing/
   ├── HeroSection.tsx        # Hero with globe
   ├── FeaturesSection.tsx    # Feature cards
   ├── HowItWorksSection.tsx  # Process steps
   ├── CTASection.tsx         # Call to action
   └── Globe.tsx              # Globe wrapper
   ```

3. **Layout structure**
   - [ ] Responsive grid system
   - [ ] Mobile-first approach
   - [ ] Preserve exact spacing
   - [ ] Match current breakpoints

### Phase 2: Globe Animation (3 hours)

1. **Three.js integration** (`components/landing/Globe.tsx`)
   - [ ] Port `globe.ts` logic to Preact component
   - [ ] Use `useEffect` for initialization
   - [ ] Handle cleanup on unmount
   - [ ] Preserve all animations

2. **Performance optimization**
   - [ ] Lazy load Three.js
   - [ ] Use `requestAnimationFrame` properly
   - [ ] Implement visibility observer
   - [ ] Pause when off-screen

3. **Responsive handling**
   - [ ] Canvas resize on window change
   - [ ] Touch controls for mobile
   - [ ] Fallback for low-end devices
   - [ ] Loading state while initializing

### Phase 3: Content Migration (2 hours)

1. **Hero section**
   - [ ] Port heading and tagline
   - [ ] Integrate globe component
   - [ ] Add CTA buttons
   - [ ] Preserve animations

2. **Features section**
   - [ ] Create feature card component
   - [ ] Port all feature content
   - [ ] Add hover animations
   - [ ] Implement grid layout

3. **How it works**
   - [ ] Create step component
   - [ ] Port process content
   - [ ] Add connecting lines
   - [ ] Scroll animations

4. **Static content**
   - [ ] Port all text content
   - [ ] Maintain SEO structure
   - [ ] Add proper headings
   - [ ] Include all CTAs

### Phase 4: Animations and Interactions (2 hours)

1. **GSAP integration**
   - [ ] Install and configure GSAP
   - [ ] Port scroll triggers
   - [ ] Recreate fade animations
   - [ ] Test performance

2. **Scroll animations**
   - [ ] Feature cards entrance
   - [ ] Process steps reveal
   - [ ] Parallax effects
   - [ ] Smooth scrolling

3. **Micro-interactions**
   - [ ] Button hover states
   - [ ] Card hover effects
   - [ ] Link transitions
   - [ ] Loading states

### Phase 5: Styling and Polish (1 hour)

1. **Tailwind styling**
   - [ ] Convert CSS to Tailwind
   - [ ] Create custom utilities
   - [ ] Ensure pixel-perfect match
   - [ ] Dark mode support

2. **Performance optimization**
   - [ ] Optimize images
   - [ ] Implement lazy loading
   - [ ] Minimize CSS
   - [ ] Tree-shake unused code

3. **SEO and metadata**
   - [ ] Add meta tags
   - [ ] Open Graph tags
   - [ ] Structured data
   - [ ] Sitemap entry

## In-Browser Testing Checklist

### Visual Testing

1. **Desktop (1920x1080)**
   - [ ] Globe renders correctly
   - [ ] All animations work
   - [ ] Layout matches original
   - [ ] No visual glitches
   - [ ] Smooth scrolling

2. **Tablet (768x1024)**
   - [ ] Responsive layout works
   - [ ] Globe scales properly
   - [ ] Touch interactions work
   - [ ] Content readable
   - [ ] No horizontal scroll

3. **Mobile (375x667)**
   - [ ] Mobile layout correct
   - [ ] Globe performs well
   - [ ] All content accessible
   - [ ] CTAs easily tappable
   - [ ] Fast loading

### Functional Testing

1. **Globe interaction**
   - [ ] Auto-rotation works
   - [ ] Mouse drag works
   - [ ] Touch drag works
   - [ ] Zoom works (if implemented)
   - [ ] No memory leaks

2. **Navigation**
   - [ ] All links work
   - [ ] Smooth scroll to sections
   - [ ] CTA buttons navigate correctly
   - [ ] External links open in new tab

3. **Performance**
   - [ ] Page loads < 3 seconds
   - [ ] Globe initializes smoothly
   - [ ] Animations don't stutter
   - [ ] Memory usage stable
   - [ ] No console errors

### Cross-browser Testing

- [ ] Chrome (Windows/Mac)
- [ ] Firefox (Windows/Mac)
- [ ] Safari (Mac/iOS)
- [ ] Edge (Windows)
- [ ] Chrome (Android)

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Sufficient color contrast
- [ ] Focus indicators visible
- [ ] Alt text for images

## Migration Verification

1. **Side-by-side comparison**
   - [ ] Open legacy at `/legacy/`
   - [ ] Open new at `/app/`
   - [ ] Compare visually
   - [ ] Test all interactions
   - [ ] Verify identical behavior

2. **Performance comparison**
   - [ ] Measure load time
   - [ ] Check bundle size
   - [ ] Monitor memory usage
   - [ ] Test on slow network

## Deliverables

1. **Working landing page** in Preact
2. **Globe animation** fully functional
3. **All content** migrated
4. **Animations** preserved
5. **Tests** for critical functionality

## Success Criteria

- [ ] Pixel-perfect match to original
- [ ] All animations working
- [ ] Globe performs smoothly
- [ ] Page loads faster than original
- [ ] No console errors
- [ ] Passes all browser tests

## Common Issues & Solutions

1. **Globe performance issues**
   - Reduce polygon count
   - Implement LOD (Level of Detail)
   - Use OffscreenCanvas
   - Throttle render calls

2. **Animation conflicts**
   - Use GSAP context
   - Cleanup on unmount
   - Avoid animation queuing
   - Use RAF for smooth updates

3. **Bundle size too large**
   - Code split Three.js
   - Use dynamic imports
   - Tree shake GSAP
   - Optimize images

## Detailed Implementation Plan

### Approach Selection
After analyzing the current implementation, I've chosen a **component-first approach** that preserves all animations while improving performance:

1. **Three.js Integration Strategy**
   - Create a dedicated Globe component that encapsulates all Three.js logic
   - Use Preact's lifecycle hooks for proper initialization and cleanup
   - Implement lazy loading to improve initial page load

2. **Animation Migration Strategy**
   - Keep GSAP for complex animations (proven performance)
   - Replace ScrollReveal with Intersection Observer + CSS for better control
   - Use CSS transitions for micro-interactions

3. **Component Architecture**
   ```
   LandingPage.tsx
   ├── components/landing/
   │   ├── Globe.tsx           (Three.js globe wrapper)
   │   ├── HeroSection.tsx     (Hero with globe background)
   │   ├── FeaturesGrid.tsx    (Features section)
   │   ├── FeatureCard.tsx     (Individual feature)
   │   └── CTASection.tsx      (Call-to-action)
   ```

### Implementation Phases

#### Phase 1: Basic Structure (1 hour)
1. Create LandingPage.tsx with route setup
2. Create component directory structure
3. Set up basic layout matching current design
4. Import and configure Tailwind utilities

#### Phase 2: Globe Component (2 hours)
1. Port globe.ts to Globe.tsx component
2. Implement proper cleanup on unmount
3. Add loading state while Three.js initializes
4. Optimize for mobile (reduce polygons, pause when off-screen)

#### Phase 3: Content Migration (1.5 hours)
1. Migrate all text content to components
2. Convert inline styles to Tailwind classes
3. Ensure responsive grid layouts
4. Add proper semantic HTML

#### Phase 4: Animation System (1.5 hours)
1. Set up GSAP with proper Preact integration
2. Implement scroll-triggered animations
3. Add entrance animations for features
4. Ensure smooth performance

#### Phase 5: Testing & Polish (1 hour)
1. Cross-browser testing
2. Performance optimization
3. Accessibility improvements
4. Final visual polish

### Key Decisions
- **Keep Three.js**: The globe is a signature element, worth the bundle size
- **Keep GSAP**: Already in use, excellent performance for complex animations
- **Replace ScrollReveal**: Use Intersection Observer for better control
- **Tailwind-first**: Convert all styles to Tailwind utilities where possible

### Risk Mitigation
- **Bundle size**: Lazy load Three.js and GSAP
- **Performance**: Use visibility observer to pause globe when off-screen
- **Mobile**: Simplified globe for mobile devices
- **Fallback**: Static image for browsers without WebGL

## Timeline

- Start Date: When instructed
- End Date: Same day
- Duration: ~7 hours (optimized from original estimate)

## Notes

- This is the proof of concept - take extra care
- Document any deviations from original
- Performance is critical for first impression
- Consider A/B testing the new version
- Focus on maintaining visual fidelity while improving performance