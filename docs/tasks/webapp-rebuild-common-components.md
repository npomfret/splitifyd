# Webapp Rebuild Task: Common UI Components

## Overview
Create a set of reusable, type-safe UI components that will form the foundation for all webapp pages. These components will ensure consistency, reduce duplication, and accelerate development of subsequent features.

## Prerequisites
- [x] Preact app with TypeScript and Tailwind configured
- [x] Basic routing set up
- [x] No other dependencies - this is a foundation task

## Current State
- Basic pages exist but no shared component library
- Potential for code duplication across pages
- No consistent design system implementation

## Target State
- Well-documented component library
- Type-safe props with full TypeScript support
- Consistent styling with Tailwind
- Accessibility built-in
- Ready for use in all future pages

## Implementation Plan

### Phase 1: Core Form Components (2 hours)

#### 1.1 Input Component (`components/ui/Input.tsx`)
```typescript
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number';
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}
```

Features:
- Consistent styling with focus states
- Error message display
- Label support with proper accessibility
- Loading/disabled states
- Auto-focus support
- Input validation feedback

#### 1.2 Button Component (`components/ui/Button.tsx`)
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
}
```

Features:
- Multiple visual variants
- Loading spinner integration
- Proper disabled states
- Keyboard navigation support
- Focus management

#### 1.3 Form Component (`components/ui/Form.tsx`)
```typescript
interface FormProps {
  onSubmit: (e: Event) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}
```

Features:
- Handles form submission
- Prevents double submission
- Error boundary for form errors
- Accessible form structure

### Phase 2: Display Components (1.5 hours)

#### 2.1 Card Component (`components/ui/Card.tsx`)
```typescript
interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
```

Features:
- Consistent card styling
- Click handling for interactive cards
- Hover states
- Optional header section

#### 2.2 Alert Component (`components/ui/Alert.tsx`)
```typescript
interface AlertProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}
```

Features:
- Color-coded by type
- Optional dismiss button
- Icon support
- Accessible alert role

#### 2.3 LoadingSpinner Component (`components/ui/LoadingSpinner.tsx`)
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  fullScreen?: boolean;
}
```

Features:
- Multiple sizes
- Customizable color
- Full-screen overlay option
- Smooth animation

### Phase 3: Layout Components (1 hour)

#### 3.1 Container Component (`components/ui/Container.tsx`)
```typescript
interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}
```

Features:
- Responsive max-width constraints
- Consistent padding
- Center alignment

#### 3.2 Stack Component (`components/ui/Stack.tsx`)
```typescript
interface StackProps {
  direction?: 'horizontal' | 'vertical';
  spacing?: 'xs' | 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  children: React.ReactNode;
}
```

Features:
- Flexible layout helper
- Consistent spacing
- Alignment options

### Phase 4: Component Documentation (0.5 hours)

1. **Usage examples** for each component
2. **Props documentation** with TypeScript
3. **Accessibility notes**
4. **Common patterns** and best practices

### Commit Plan

This task will be broken into 3 commits:

1. **Commit 1: Form components** (Input, Button, Form)
   - Essential for auth pages and forms
   - ~2 hours of work

2. **Commit 2: Display components** (Card, Alert, LoadingSpinner)
   - Needed for dashboard and group pages
   - ~1.5 hours of work

3. **Commit 3: Layout components & docs** (Container, Stack, documentation)
   - Foundation for consistent layouts
   - ~1.5 hours of work

## Testing Approach

Each component should include:
- Rendering tests
- User interaction tests
- Accessibility tests
- Edge case handling

## Success Criteria

- [ ] All components render without errors
- [ ] TypeScript types are comprehensive
- [ ] Components are accessible (ARIA compliant)
- [ ] Consistent Tailwind styling
- [ ] No console warnings
- [ ] Components are reusable across pages

## Implementation Notes

1. **Use Tailwind classes** for all styling
2. **Avoid inline styles** except for dynamic values
3. **Ensure keyboard navigation** works properly
4. **Test with screen readers** where applicable
5. **Keep components simple** - single responsibility
6. **Document props clearly** with JSDoc comments

## Why This Task?

1. **No dependencies** - can start immediately
2. **Foundation for all future work** - speeds up development
3. **Reduces code duplication** - DRY principle
4. **Improves consistency** - better UX
5. **Small, focused scope** - can be completed quickly

## Timeline

- Start Date: When instructed
- Duration: ~5 hours total
- Can be done in phases/commits