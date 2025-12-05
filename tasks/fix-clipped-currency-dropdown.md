# Fix clipped currency selection dropdown in expense form

**Problem:** The dropdown for the currency selection in the expense form gets visually clipped when it extends beyond the border of its containing element, specifically the "expense detail" container. This degrades the user experience as the full list of currencies is not visible.

**Proposed Solution:** Adjust the styling of the currency selection dropdown and/or its parent containers to prevent clipping. This typically involves modifying CSS properties such as `z-index`, `overflow`, `position`, or `clip-path` to ensure the dropdown renders fully on top of other content.

**Technical Notes:**
- Investigate the component structure around the currency selection in `webapp-v2/src/components/expense-form/` or similar paths.
- Identify the specific component responsible for the currency dropdown (e.g., a `CurrencySelector` component or similar input).
- Examine the CSS of the dropdown element itself and its immediate parent containers (e.g., the "expense detail" container) for properties that might restrict its visibility, such as `overflow: hidden`, `position: relative` without a sufficient `z-index`, or `clip-path`.
- The fix might involve increasing the `z-index` of the dropdown, ensuring `position: absolute` or `fixed` if necessary, or adjusting `overflow` on parent elements.
