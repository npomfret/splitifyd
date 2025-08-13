# Feature: Automatic User Theme Colors

## Overview

To make it easier to visually distinguish between users in lists, expenses, and settlements, this feature will automatically assign a unique, persistent color to each user. This color will be used to style UI elements associated with that user, providing at-a-glance recognition.

## Key Concepts

-   **Automatic Assignment:** When a new user signs up, a color will be automatically assigned to them from a predefined palette.
-   **Persistence:** The assigned color will be stored in the user's profile document in Firestore so it remains consistent across all sessions and devices.
-   **Visual Association:** This color will be used as a visual tag for the user throughout the application.

## Implementation Details

### 1. Predefined Color Palette

-   A predefined palette of WCAG AA compliant colors (minimum 4.5:1 contrast ratio) should be created.
-   The palette should contain 16 colors to ensure variety with graceful overflow handling.
-   Colors should be tested for colorblind accessibility using tools like Stark or ColorBrewer.
-   Both light and dark mode variants should be included.
-   The colors should be stored in a shared configuration file accessible to both frontend and backend.

**Enhanced Palette with Accessibility:**
```typescript
// firebase/functions/src/constants/user-colors.ts (shared via @shared alias)
export interface UserColorPalette {
  light: string;
  dark: string;
  name: string;
  contrastRatio: number;
}

export const USER_COLORS: UserColorPalette[] = [
  { light: '#1f5582', dark: '#4a9eff', name: 'Ocean Blue', contrastRatio: 4.6 },
  { light: '#0f5132', dark: '#25d366', name: 'Forest Green', contrastRatio: 4.8 },
  { light: '#842029', dark: '#f87171', name: 'Crimson Red', contrastRatio: 4.5 },
  { light: '#59359a', dark: '#a855f7', name: 'Royal Purple', contrastRatio: 4.7 },
  { light: '#b45309', dark: '#fbbf24', name: 'Amber Yellow', contrastRatio: 4.6 },
  { light: '#0f766e', dark: '#2dd4bf', name: 'Teal', contrastRatio: 4.9 },
  { light: '#c2410c', dark: '#fb923c', name: 'Tangerine', contrastRatio: 4.5 },
  { light: '#7c2d12', dark: '#fca5a5', name: 'Rose', contrastRatio: 4.8 },
  { light: '#365314', dark: '#84cc16', name: 'Lime', contrastRatio: 4.6 },
  { light: '#075985', dark: '#0ea5e9', name: 'Sky Blue', contrastRatio: 4.7 },
  { light: '#701a75', dark: '#d946ef', name: 'Fuchsia', contrastRatio: 4.5 },
  { light: '#92400e', dark: '#f59e0b', name: 'Gold', contrastRatio: 4.8 },
  { light: '#164e63', dark: '#06b6d4', name: 'Cyan', contrastRatio: 4.6 },
  { light: '#7c3aed', dark: '#8b5cf6', name: 'Violet', contrastRatio: 4.5 },
  { light: '#0c4a6e', dark: '#0284c7', name: 'Blue', contrastRatio: 4.9 },
  { light: '#991b1b', dark: '#ef4444', name: 'Red', contrastRatio: 4.7 }
];

// Fallback patterns for colorblind users
export const COLOR_PATTERNS = ['solid', 'dots', 'stripes', 'diagonal'] as const;
```

### 2. Color Assignment Logic

-   **On User Creation:** A new Firebase Cloud Function that triggers on user creation (`auth.user().onCreate()`) will be responsible for assigning a color.
-   **Race Condition Safe Assignment Strategy:**
    1.  Use Firestore transactions to atomically increment a global counter stored in `/system/colorAssignment`
    2.  Hash-based fallback: If transaction fails after retries, use `userId.hashCode() % USER_COLORS.length`
    3.  The counter loops back to 0 when it reaches `USER_COLORS.length`
    4.  Pattern assignment: Assign pattern variants for users beyond the 16th to ensure visual distinction

**Enhanced Assignment Implementation:**
```typescript
// firebase/functions/src/user-management/assign-theme-color.ts
import { USER_COLORS, COLOR_PATTERNS } from '@shared/constants/user-colors';
import { FieldValue } from 'firebase-admin/firestore';

export async function assignThemeColor(userId: string): Promise<{color: UserColorPalette, pattern: string}> {
  const systemDoc = db.collection('system').doc('colorAssignment');
  
  try {
    // Atomic counter increment with transaction
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(systemDoc);
      const currentIndex = doc.exists ? (doc.data()?.lastColorIndex || 0) : 0;
      const nextIndex = (currentIndex + 1) % USER_COLORS.length;
      
      transaction.set(systemDoc, { 
        lastColorIndex: nextIndex, 
        totalAssigned: FieldValue.increment(1),
        lastAssignedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      
      return nextIndex;
    });
    
    const colorIndex = result;
    const totalAssigned = (await systemDoc.get()).data()?.totalAssigned || 0;
    const patternIndex = Math.floor(totalAssigned / USER_COLORS.length) % COLOR_PATTERNS.length;
    
    return {
      color: USER_COLORS[colorIndex],
      pattern: COLOR_PATTERNS[patternIndex]
    };
    
  } catch (error) {
    // Fallback to hash-based assignment if transaction fails
    console.warn('Color assignment transaction failed, using hash fallback:', error);
    const hashIndex = simpleHash(userId) % USER_COLORS.length;
    return {
      color: USER_COLORS[hashIndex],
      pattern: COLOR_PATTERNS[0] // Default to solid pattern
    };
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
```

**Error Handling & Retry Logic:**
- Transaction retries: 3 attempts with exponential backoff
- If all transactions fail: Hash-based assignment using userId
- If Cloud Function fails entirely: Frontend fallback assigns temporary color from client-side hash
- Background repair job runs daily to fix any missing color assignments

### 3. Data Model Changes

**User Document Structure (Enhanced):**
```typescript
// /users/{userId}
interface UserProfile {
  displayName: string;
  email: string;
  createdAt: Timestamp;
  themeColor: {
    light: string;      // e.g., "#1f5582"
    dark: string;       // e.g., "#4a9eff"
    name: string;       // e.g., "Ocean Blue"
    pattern: string;    // 'solid' | 'dots' | 'stripes' | 'diagonal'
    assignedAt: Timestamp;
    colorIndex: number; // For debugging/analytics
  };
}
```

**System Collection (New):**
```typescript
// /system/colorAssignment
interface ColorAssignmentSystem {
  lastColorIndex: number;     // 0-15, tracks last assigned color
  totalAssigned: number;      // Total users with colors assigned
  lastAssignedAt: Timestamp;  // For monitoring/debugging
}

// /system/themeConfig (Optional: For future A/B testing)
interface ThemeConfig {
  enablePatterns: boolean;
  fallbackToHash: boolean;
  repairJobEnabled: boolean;
  lastRepairRun: Timestamp;
}
```

**Shared Type Definitions:**
```typescript
// firebase/functions/src/types/webapp-shared-types.ts (accessible via @shared)
export interface UserThemeColor {
  light: string;
  dark: string;
  name: string;
  pattern: 'solid' | 'dots' | 'stripes' | 'diagonal';
  assignedAt: string; // ISO timestamp for API responses
  colorIndex: number;
}

export interface UserProfileResponse {
  displayName: string;
  email: string;
  createdAt: string;
  themeColor: UserThemeColor;
}
```

### 4. UI/UX Application

**Enhanced Visual Elements with Accessibility:**

-   **Avatars:** Color-filled circles with initials, plus pattern overlay for colorblind users
-   **Member Lists:** Colored dots with pattern indicators and optional tooltips showing color names
-   **Expense Lists:** Left border colors with subtle pattern backgrounds
-   **Settlements:** Color coding with icons and patterns for transaction clarity
-   **Form Labels:** Subtle color accents for user-specific form sections

**Implementation Strategy:**
```typescript
// webapp-v2/src/components/ui/UserThemeProvider.tsx
interface UserThemeProviderProps {
  themeColor: UserThemeColor;
  isDarkMode: boolean;
  reduceMotion: boolean;
  children: React.ReactNode;
}

export function UserThemeProvider({ themeColor, isDarkMode, children }: UserThemeProviderProps) {
  const colorValue = isDarkMode ? themeColor.dark : themeColor.light;
  const patternClass = `pattern-${themeColor.pattern}`;
  
  return (
    <div 
      className={`user-theme-context ${patternClass}`}
      style={{
        '--user-color': colorValue,
        '--user-color-light': `${colorValue}20`, // 20% opacity
        '--user-color-contrast': getContrastColor(colorValue),
        '--user-pattern': themeColor.pattern,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
```

**CSS Implementation with Patterns:**
```css
/* Base user color utilities */
.user-avatar {
  background: var(--user-color);
  color: var(--user-color-contrast);
  position: relative;
}

.user-avatar.pattern-dots::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.3) 2px, transparent 2px);
  background-size: 8px 8px;
}

.user-avatar.pattern-stripes::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.3) 0px,
    rgba(255,255,255,0.3) 2px,
    transparent 2px,
    transparent 6px
  );
}

.expense-item {
  border-left: 4px solid var(--user-color);
  background: linear-gradient(to right, var(--user-color-light), transparent 50%);
}

.expense-item.pattern-dots {
  background-image: 
    linear-gradient(to right, var(--user-color-light), transparent 50%),
    radial-gradient(circle, var(--user-color-light) 1px, transparent 1px);
  background-size: 100% 100%, 8px 8px;
}

/* User indicator dot with accessibility */
.user-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--user-color);
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.user-indicator[title]::before {
  content: attr(title);
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 1000;
}

.user-indicator:hover::before {
  opacity: 1;
}

/* Responsive design for mobile */
@media (max-width: 640px) {
  .user-indicator {
    width: 16px;
    height: 16px;
  }
  
  .expense-item {
    border-left-width: 3px;
  }
}
```

**Frontend Store Integration:**
```typescript
// webapp-v2/src/stores/user-theme-store.ts
import type { UserThemeColor } from '@shared/types/webapp-shared-types';

class UserThemeStoreImpl {
  private userColors = new Map<string, UserThemeColor>();
  
  getUserColor(userId: string): UserThemeColor | null {
    return this.userColors.get(userId) || null;
  }
  
  setUserColor(userId: string, color: UserThemeColor): void {
    this.userColors.set(userId, color);
  }
  
  generateCSSCustomProperties(userId: string, isDarkMode: boolean): Record<string, string> {
    const color = this.getUserColor(userId);
    if (!color) return {};
    
    const colorValue = isDarkMode ? color.dark : color.light;
    return {
      '--user-color': colorValue,
      '--user-color-light': `${colorValue}20`,
      '--user-color-contrast': getContrastColor(colorValue),
      '--user-pattern': color.pattern,
    };
  }
}
```

## Benefits

-   **Improved Scannability:** Makes it much faster to identify who paid for what in a long list of expenses.
-   **Enhanced UX:** Adds a layer of visual polish and personality to the application.
-   **Better Organization:** Helps to visually group and categorize information related to specific users.
-   **No User Effort:** The automatic assignment means users get this benefit without any configuration.
-   **Accessibility Compliant:** WCAG AA compliance with colorblind-friendly patterns and tooltips.
-   **Scalable Design:** Handles unlimited users with graceful color recycling and pattern variations.

## Implementation Roadmap

### Phase 1: Backend Foundation (Week 1-2)
1. **Color Constants & Types**
   - Create `firebase/functions/src/constants/user-colors.ts`
   - Define shared types in `webapp-shared-types.ts`
   - Set up system collection schema

2. **Cloud Function Implementation**
   - Implement `assignThemeColor` function with transaction logic
   - Add fallback hash-based assignment
   - Create user creation trigger (`auth.user().onCreate()`)

3. **Database Migration**
   - Update existing users with default colors (optional background job)
   - Initialize `/system/colorAssignment` document

### Phase 2: Frontend Integration (Week 2-3)
1. **Store & API Integration**
   - Create `user-theme-store.ts` with color management
   - Add Zod schemas for theme color validation in `apiSchemas.ts`
   - Update API client to fetch user theme colors

2. **UI Components**
   - Build `UserThemeProvider` component
   - Create base avatar component with pattern support
   - Implement user indicator dots with tooltips

3. **CSS Framework**
   - Add pattern classes and CSS custom properties
   - Ensure dark mode compatibility
   - Mobile responsive adjustments

### Phase 3: Feature Integration (Week 3-4)
1. **Core Features**
   - Apply colors to expense lists
   - Add colored avatars to member lists
   - Implement settlement visual coding

2. **Accessibility Features**
   - Add pattern overlays for colorblind users
   - Implement color name tooltips
   - Ensure keyboard navigation compatibility

### Phase 4: Testing & Polish (Week 4-5)
1. **Comprehensive Testing**
   - Unit tests for color assignment logic
   - Integration tests for Cloud Function triggers
   - E2E tests for UI color application
   - Accessibility testing with screen readers

2. **Performance & Monitoring**
   - Add analytics for color assignment success rates
   - Monitor transaction failure rates
   - Performance testing with high user registration volume

## Testing Strategy

### Backend Tests
```typescript
// firebase/functions/__tests__/user-management/assign-theme-color.test.ts
describe('Theme Color Assignment', () => {
  test('should assign sequential colors with transactions', async () => {
    // Test atomic counter increment
  });
  
  test('should fallback to hash assignment on transaction failure', async () => {
    // Test fallback mechanism
  });
  
  test('should handle color overflow with patterns', async () => {
    // Test pattern assignment for users > 16
  });
});
```

### Frontend Tests
```typescript
// webapp-v2/src/components/ui/UserThemeProvider.test.tsx
describe('UserThemeProvider', () => {
  test('should apply correct CSS custom properties', () => {
    // Test CSS variable generation
  });
  
  test('should handle dark mode color switching', () => {
    // Test light/dark mode compatibility
  });
  
  test('should support pattern overlays', () => {
    // Test accessibility pattern rendering
  });
});
```

### E2E Tests
```typescript
// e2e-tests/tests/user-theme-colors.e2e.test.ts
authenticatedPageTest('user theme colors display correctly', async ({
  authenticatedPage,
  dashboardPage
}) => {
  // Test color visibility in expense lists
  // Test avatar color application
  // Test tooltip functionality
});
```

### Accessibility Tests
- Screen reader compatibility testing
- Color contrast ratio validation
- Colorblind simulation testing (Protanopia, Deuteranopia, Tritanopia)
- Keyboard navigation with pattern indicators

## Future Enhancements

1. **User Preferences**
   - Allow users to change their assigned color
   - Color preference API endpoints
   - UI for color selection

2. **Advanced Features**
   - Group-aware color assignment to avoid conflicts
   - Seasonal color palette variations
   - Custom pattern designs

3. **Analytics**
   - Color preference tracking
   - Visual accessibility usage metrics
   - Performance impact monitoring
