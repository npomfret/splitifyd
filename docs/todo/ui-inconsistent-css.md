# Inconsistent CSS on Static Pages

## Problem
- **Location**: `webapp/css/static-pages.css`
- **Description**: The CSS for the static pages (Terms of Service, Privacy Policy) is completely different from the main application's styling (`main.css`). It uses a different color scheme, a "cursive" font, and has a generally unprofessional appearance that clashes with the rest of the site.
- **Current vs Expected**:
  - **Current**: Static pages have a jarring and inconsistent design.
  - **Expected**: Static pages should use the same visual identity (colors, fonts, layout principles) as the main application to provide a seamless user experience.

## Solution
1.  **Remove `static-pages.css`**: Delete the `webapp/css/static-pages.css` file.
2.  **Update HTML to use `main.css`**: In `terms-of-service.html` and `privacy-policy.html`, change the stylesheet link to point to `main.css`.
3.  **Add a Container for Static Content**: Wrap the content of the static pages in a container that can be styled to match the application's look and feel. A simple container with a white background, padding, and box-shadow would work well.

Example HTML structure for `terms-of-service.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    ...
    <link rel="stylesheet" href="css/main.css">
</head>
<body>
    <header class="dashboard-header">
        <div class="dashboard-container">
            <h1 class="dashboard-title"><a href="index.html" class="dashboard-title-link">Splitifyd</a></h1>
        </div>
    </header>
    <main class="dashboard-main">
        <div class="dashboard-container">
            <div class="static-content-card">
                <h1>Terms of Service</h1>
                <section>
                    ...
                </section>
            </div>
        </div>
    </main>
</body>
</html>
```

4.  **Add Styles for Static Content**: Add a small number of styles to `main.css` to format the static content container.

```css
/* In webapp/css/main.css */
.static-content-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-md);
  max-width: 800px;
  margin: 0 auto;
}

.static-content-card h1 {
  font-size: var(--font-size-3xl);
  margin-bottom: var(--space-lg);
}

.static-content-card h2 {
  font-size: var(--font-size-2xl);
  margin-top: var(--space-xl);
  margin-bottom: var(--space-md);
}
```

## Impact
- **Type**: Pure refactoring / UI improvement.
- **Risk**: Low
- **Complexity**: Simple
- **Benefit**: Medium impact (improves UI consistency and professionalism).

## Implementation Notes
- This is a quick win that will significantly improve the look and feel of the static pages.
- The goal is to reuse as much of the existing `main.css` as possible.
