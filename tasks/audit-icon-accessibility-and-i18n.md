# Audit & Refactor: Icon Accessibility and Internationalization

## Summary
- Completed a pass over every TSX component in `webapp-v2` with a focus on icon usage, icon-only controls, and related i18n coverage.
- Recurrent issues: missing `aria-label` on icon-only buttons, reliance on `title` attributes as the only user-facing copy, and hard-coded English strings in accessibility attributes.
- Decorative icons (status glyphs, empty-state art) rarely set `aria-hidden`, so screen readers get extra noise.
- There is still no shared tooltip primitive; several places lean on `title`, which is inconsistent for both accessibility and UX.
- Positive counterexamples exist (e.g. `ExpenseBasicFields` clock button, `CurrencyAmountInput` trigger), so we have patterns worth standardising.

## Detailed Findings

### Missing Accessible Labels or Non-i18n Labels
| Location | Issue | Notes |
| --- | --- | --- |
| `webapp-v2/src/components/group/MembersListWithManagement.tsx:157` | Remove-member button renders `<UserMinusIcon>` inside `<Button>` without `ariaLabel` or tooltip text. | Screen readers announce "button" with no context; needs translation-backed `ariaLabel` (and likely a tooltip). |
| `webapp-v2/src/components/settlements/SettlementHistory.tsx:170-188` | Edit/Delete buttons rely solely on `title`. | Add `aria-label={t(...)}` for both states; keep or replace the tooltip behaviour once we have a proper component. |
| `webapp-v2/src/components/group/ShareGroupModal.tsx:174-235` | Close button and copy-to-clipboard button have no `aria-label`. Copy button only has a `title`. | Add translated `aria-label`s (close, copy link) and align tooltip behaviour with whatever standard we land on. |
| `webapp-v2/src/components/dashboard/CreateGroupModal.tsx:128-136` | Dialog close button lacks `aria-label`. | Should mirror other modals (`GroupSettingsModal`, `SettlementForm`) that already expose translated labels. |
| `webapp-v2/src/components/comments/CommentInput.tsx:117-135` | `aria-label` values are hard-coded English strings (`'Comment text'`, `'Send comment'`). | Replace with existing translation keys (`comments.input.ariaLabel`, `comments.input.sendAriaLabel`). |
| `webapp-v2/src/components/expense/ExpenseActions.tsx:56` | Copy button passes `ariaLabel='Copy expense'` literal. | Use the `expenseComponents.expenseActions.copy`/`copyExpense` translation instead of a hand-written string. |
| `webapp-v2/src/components/ui/CurrencyAmountInput.tsx:136-208` | Currency search input uses `aria-label='Search currencies'` literal. | Either add a new key (e.g. `uiComponents.currencyAmountInput.searchAriaLabel`) or reuse an existing one. |

### Tooltip & Hover Copy Gaps
- `SettlementHistory` and `ShareGroupModal` are the most obvious cases relying on `title`. Users on touch devices or screen readers get little value from this.
- `GroupHeader`’s cog button exposes an `ariaLabel` but no visible hover help; UX team may want parity with other icon-only controls.
- We still do not have a shared Tooltip component. If we plan to require tooltips for icon-only buttons, we should build one instead of repeating `title`.

### Decorative Icons Announcing to Screen Readers
- Empty-state icons and inline glyphs (e.g. `CommentsList`, `Alert`, `ConfirmDialog`, header icon in `ShareGroupModal`, status icon in `GroupCard`) omit `aria-hidden='true'`.
- These SVGs sit next to real text, so screen readers hear "graphic" before the actual message. Add `aria-hidden` (or `role='presentation'`) where the icon is purely decorative.

### Positive Patterns Worth Reusing
- `ExpenseBasicFields.tsx:228-235` handles the clock button correctly: translated `aria-label`, `title`, and an obvious affordance.
- `GroupCard.tsx:91-108` sets both translated `aria-label`s and hover copy for icon-only quick actions.
- `GroupSettingsModal.tsx:813-821` shows the expected modal-close pattern that other dialogs should follow.
- `Pagination.tsx:54-82` uses visually hidden labels (`sr-only`) combined with `aria-hidden` icons, a solid example for any next/previous controls.

## Recommendations
1. **Standardise icon-only controls**: Require a translated `aria-label` and visible helper text (tooltip or inline) for any button without textual children.
2. **Introduce an accessible Tooltip primitive**: Wrap the hover/focus copy instead of sprinkling `title`. Something small (e.g. headless + portal) is enough.
3. **Enforce translation use in accessibility attributes**: add ESLint rule or review checklist flagging raw strings in `aria-label`/`aria-labelledby`.
4. **Mark decorative SVGs as hidden**: Add `aria-hidden='true'` (and optionally `focusable='false'`) to icons whose meaning is already conveyed by nearby text.
5. **Document the patterns**: capture the good examples above in our component guidelines so new work follows the same recipe.

Once these items are addressed we should re-run a targeted audit (or add automated checks) to keep icon accessibility and i18n from drifting again.

## Next Steps
1. **Add the missing labels/tooltips**: Update the flagged components so every icon-only control uses translation-backed `aria-label`s and, where appropriate, the forthcoming tooltip helper (e.g. remove-member button, settlement edit/delete, share modal close/copy, create group close, comment input send button, expense copy button, currency search input).
2. **Introduce the shared tooltip component**: Implement an accessible tooltip primitive and roll it out to icon-only controls across the app, replacing raw `title` attributes for a consistent experience.
