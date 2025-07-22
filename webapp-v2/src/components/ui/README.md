# UI Component Library

A collection of reusable, accessible, and type-safe UI components built with Preact and Tailwind CSS.

## Table of Contents

- [Form Components](#form-components)
  - [Input](#input)
  - [Button](#button)
  - [Form](#form)
- [Display Components](#display-components)
  - [Card](#card)
  - [Alert](#alert)
  - [LoadingSpinner](#loadingspinner)
- [Layout Components](#layout-components)
  - [Container](#container)
  - [Stack](#stack)
- [Accessibility](#accessibility)
- [Best Practices](#best-practices)

## Form Components

### Input

A flexible input component with built-in error handling and accessibility.

#### Usage

```tsx
import { Input } from '../components/ui';

// Basic usage
<Input 
  label="Email"
  type="email"
  placeholder="Enter your email"
  value={email}
  onChange={setEmail}
/>

// With error handling
<Input 
  label="Password"
  type="password"
  error={passwordError}
  required
/>

// Disabled state
<Input 
  label="Username"
  disabled
  value="locked-user"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'text' \| 'email' \| 'password' \| 'number'` | `'text'` | Input type |
| `label` | `string` | - | Field label |
| `error` | `string` | - | Error message to display |
| `placeholder` | `string` | - | Placeholder text |
| `disabled` | `boolean` | `false` | Disable input |
| `required` | `boolean` | `false` | Mark field as required |
| `value` | `string` | - | Controlled value |
| `onChange` | `(value: string) => void` | - | Change handler |
| `onBlur` | `() => void` | - | Blur handler |

### Button

A versatile button component with multiple variants and states.

#### Usage

```tsx
import { Button } from '../components/ui';

// Primary button
<Button onClick={handleSubmit}>
  Submit
</Button>

// Loading state
<Button loading={isSubmitting} type="submit">
  Save Changes
</Button>

// Variants
<Button variant="secondary">Cancel</Button>
<Button variant="danger" size="sm">Delete</Button>
<Button variant="ghost">Learn More</Button>

// Full width
<Button fullWidth>
  Continue
</Button>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Show loading spinner |
| `disabled` | `boolean` | `false` | Disable button |
| `fullWidth` | `boolean` | `false` | Full width button |
| `onClick` | `() => void` | - | Click handler |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Button type |

### Form

A form wrapper that handles submission and validation.

#### Usage

```tsx
import { Form, Input, Button } from '../components/ui';

<Form onSubmit={handleSubmit}>
  <Input 
    label="Email"
    type="email"
    required
  />
  <Input 
    label="Password"
    type="password"
    required
  />
  <Button type="submit">
    Log In
  </Button>
</Form>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSubmit` | `(data: Record<string, any>) => void \| Promise<void>` | - | Submit handler |
| `validationRules` | `Record<string, ValidationRule>` | - | Field validation rules |
| `className` | `string` | - | Additional CSS classes |

## Display Components

### Card

A container component for grouping related content.

#### Usage

```tsx
import { Card } from '../components/ui';

// Basic card
<Card>
  <p>Card content goes here</p>
</Card>

// With title and subtitle
<Card 
  title="Monthly Summary"
  subtitle="January 2024"
>
  <p>Your expenses this month...</p>
</Card>

// Clickable card
<Card 
  onClick={() => navigate('/details')}
  className="hover:shadow-lg"
>
  <p>Click to view details</p>
</Card>

// Custom padding
<Card padding="lg">
  <h2>Large padded content</h2>
</Card>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Card title |
| `subtitle` | `string` | - | Card subtitle |
| `onClick` | `() => void` | - | Makes card clickable |
| `className` | `string` | - | Additional CSS classes |
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Padding size |

### Alert

A notification component for displaying messages to users.

#### Usage

```tsx
import { Alert } from '../components/ui';

// Info alert
<Alert 
  type="info"
  message="New features have been added"
/>

// Success with title
<Alert 
  type="success"
  title="Payment Successful"
  message="Your payment has been processed"
/>

// Dismissible error
<Alert 
  type="error"
  message="Failed to save changes"
  dismissible
  onDismiss={() => setShowError(false)}
/>

// Warning alert
<Alert 
  type="warning"
  title="Low Balance"
  message="Your account balance is below $10"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'info' \| 'success' \| 'warning' \| 'error'` | - | Alert type |
| `title` | `string` | - | Alert title |
| `message` | `string` | - | Alert message |
| `dismissible` | `boolean` | `false` | Show dismiss button |
| `onDismiss` | `() => void` | - | Dismiss handler |

### LoadingSpinner

An animated loading indicator.

#### Usage

```tsx
import { LoadingSpinner } from '../components/ui';

// Inline spinner
{isLoading && <LoadingSpinner />}

// Different sizes
<LoadingSpinner size="sm" />
<LoadingSpinner size="lg" />

// Custom color
<LoadingSpinner color="text-blue-500" />

// Full screen overlay
<LoadingSpinner fullScreen />
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Spinner size |
| `color` | `string` | `'text-primary-600'` | Color class |
| `fullScreen` | `boolean` | `false` | Full screen overlay |

## Layout Components

### Container

A responsive container with max-width constraints.

#### Usage

```tsx
import { Container } from '../components/ui';

// Default container
<Container>
  <h1>Page Title</h1>
  <p>Content goes here...</p>
</Container>

// Small width
<Container maxWidth="sm">
  <form>...</form>
</Container>

// Full width
<Container maxWidth="full">
  <table>...</table>
</Container>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxWidth` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'lg'` | Maximum width |
| `className` | `string` | - | Additional CSS classes |

### Stack

A flexible layout component for consistent spacing.

#### Usage

```tsx
import { Stack } from '../components/ui';

// Vertical stack (default)
<Stack spacing="md">
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</Stack>

// Horizontal stack
<Stack direction="horizontal" spacing="sm">
  <Button>Save</Button>
  <Button variant="secondary">Cancel</Button>
</Stack>

// With alignment
<Stack 
  direction="horizontal" 
  spacing="lg" 
  align="center"
>
  <h2>Title</h2>
  <Button size="sm">Action</Button>
</Stack>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `direction` | `'horizontal' \| 'vertical'` | `'vertical'` | Stack direction |
| `spacing` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Space between items |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch'` | `'stretch'` | Item alignment |
| `className` | `string` | - | Additional CSS classes |

## Accessibility

All components follow accessibility best practices:

- **Semantic HTML**: Components use appropriate HTML elements
- **ARIA attributes**: Proper roles and labels where needed
- **Keyboard navigation**: Full keyboard support for interactive elements
- **Focus management**: Clear focus indicators and logical tab order
- **Screen reader support**: Descriptive labels and announcements

### Examples

```tsx
// Button with loading state announces to screen readers
<Button loading>
  Save // Screen reader: "Save, loading"
</Button>

// Alert with proper role
<Alert type="error" message="Error occurred" />
// Rendered with role="alert" for immediate announcement

// Input with error is associated via aria-describedby
<Input 
  label="Email"
  error="Invalid email format"
/>
```

## Best Practices

### 1. Consistent Spacing

Use the Stack component for consistent spacing instead of custom margins:

```tsx
// ❌ Avoid
<div>
  <Card className="mb-4">...</Card>
  <Card className="mb-4">...</Card>
</div>

// ✅ Preferred
<Stack spacing="md">
  <Card>...</Card>
  <Card>...</Card>
</Stack>
```

### 2. Error Handling

Always provide clear error messages:

```tsx
// ❌ Avoid
<Input error={true} />

// ✅ Preferred
<Input error="Please enter a valid email address" />
```

### 3. Loading States

Show loading states for async operations:

```tsx
// ✅ Good pattern
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  try {
    await saveData();
  } finally {
    setIsLoading(false);
  }
};

<Button loading={isLoading} onClick={handleSubmit}>
  Save Changes
</Button>
```

### 4. Responsive Design

Components are responsive by default. Use Container for page-level constraints:

```tsx
// ✅ Responsive page layout
<Container maxWidth="xl">
  <Stack spacing="lg">
    <h1>Dashboard</h1>
    <Stack direction="horizontal" spacing="md">
      {/* Stacks automatically wrap on small screens */}
    </Stack>
  </Stack>
</Container>
```

### 5. Composition

Combine components for complex UI:

```tsx
// ✅ Form with validation feedback
<Card>
  <Form onSubmit={handleSubmit}>
    <Stack spacing="md">
      <Input 
        label="Name"
        error={errors.name}
        required
      />
      {submitError && (
        <Alert 
          type="error" 
          message={submitError}
          dismissible
        />
      )}
      <Button type="submit" loading={isSubmitting}>
        Create Account
      </Button>
    </Stack>
  </Form>
</Card>
```

### 6. TypeScript

Always use TypeScript for type safety:

```tsx
// ✅ Properly typed event handlers
const handleEmailChange = (value: string) => {
  setEmail(value);
  validateEmail(value);
};

<Input 
  type="email"
  value={email}
  onChange={handleEmailChange}
/>
```