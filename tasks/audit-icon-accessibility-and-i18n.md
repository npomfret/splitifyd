# Audit & Refactor: Icon Accessibility and Internationalization

## Summary
- Completed a pass over every TSX component in `webapp-v2` with a focus on icon usage, icon-only controls, and related i18n coverage.
- Recurrent issues remain around decorative icons (status glyphs, empty-state art) that lack `aria-hidden`, so assistive tech still gets extra noise.
- Introduced a shared `Tooltip` primitive and converted high-traffic icon-only controls to use translated `aria-label`s plus hover/focus copy instead of raw `title`.
- Positive counterexamples (e.g. `ExpenseBasicFields` clock button, `Pagination` nav) continue to serve as patterns to mirror.

## Detailed Findings

### Progress On Icon-Only Controls
| Location | Status | Notes |
| --- | --- | --- |
| `webapp-v2/src/components/group/MembersListWithManagement.tsx:153` | ✅ Updated | Uses shared tooltip + `membersList.removeMemberAriaLabel`; icon marked `aria-hidden`. |
| `webapp-v2/src/components/settlements/SettlementHistory.tsx:169` | ✅ Updated | Edit/delete actions wrap the tooltip helper with translated labels (locked vs editable states). |
| `webapp-v2/src/components/group/ShareGroupModal.tsx:175` | ✅ Updated | Close + copy buttons expose translated `aria-label`s and tooltip copy; decorative SVGs hidden. |
| `webapp-v2/src/components/dashboard/CreateGroupModal.tsx:128` | ✅ Updated | Close button matches modal pattern with tooltip + `aria-hidden` glyph. |
| `webapp-v2/src/components/comments/CommentInput.tsx:118` | ✅ Updated | Textarea and send button now consume translation keys, with tooltip for icon-only submit. |
| `webapp-v2/src/components/expense/ExpenseActions.tsx:56` | ✅ Updated | Copy action pulls `copyExpense` translation; decorative SVG hidden. |
| `webapp-v2/src/components/ui/CurrencyAmountInput.tsx:148` | ✅ Updated | Search field now uses new `uiComponents.currencyAmountInput.searchAriaLabel` key. |
| `webapp-v2/src/components/group/GroupHeader.tsx:26` | ✅ Updated | Settings cog wrapped in tooltip for parity with other icon-only controls. |
| `webapp-v2/src/components/join-group/DisplayNameConflictModal.tsx:139` | ✅ Updated | Modal close button uses tooltip helper and translation-backed label. |
| `webapp-v2/src/components/policy/PolicyAcceptanceModal.tsx:129` | ✅ Updated | Close affordance gains tooltip and hidden decorative icon. |
| `webapp-v2/src/components/settlements/SettlementForm.tsx:321` | ✅ Updated | Close button matches shared modal pattern. |
| `webapp-v2/src/components/ui/Alert.tsx:90` | ✅ Updated | Dismiss action gets tooltip and hides icon from screen readers. |
| `webapp-v2/src/components/group/ExpenseItem.tsx:99` | ✅ Updated | Row-level copy shortcut uses tooltip + translation; icon hidden. |

### Tooltip & Hover Copy Gaps
- Shared `Tooltip` helper (`webapp-v2/src/components/ui/Tooltip.tsx`) now covers the high-priority icon-only buttons. Remaining raw `title` usage is limited to informational context (e.g. the paid-by theme dot in `ExpenseItem`), but we should sweep again after upcoming feature work.

### Decorative Icons Announcing to Screen Readers
- Empty-state icons and inline glyphs (e.g. `CommentsList`, `ConfirmDialog`, status icon in `GroupCard`) still omit `aria-hidden='true'`.
- These SVGs sit next to real text, so screen readers hear "graphic" before the actual message. Add `aria-hidden` (or `role='presentation'`) where the icon is purely decorative.

### Positive Patterns Worth Reusing
- `ExpenseBasicFields.tsx:228-235` handles the clock button correctly: translated `aria-label`, `title`, and an obvious affordance.
- `GroupCard.tsx:91-108` sets both translated `aria-label`s and hover copy for icon-only quick actions.
- `GroupSettingsModal.tsx:813-821` now leverages the tooltip helper for the modal-close pattern we expect other dialogs to follow.
- `Pagination.tsx:54-82` uses visually hidden labels (`sr-only`) combined with `aria-hidden` icons, a solid example for any next/previous controls.

## Recommendations
1. **Standardise icon-only controls**: Require a translated `aria-label` and visible helper text (tooltip or inline) for any button without textual children.
2. **Adopt the shared Tooltip helper** everywhere: eliminate lingering `title` attributes in interactive contexts and ensure translated copy flows through the component.
3. **Enforce translation use in accessibility attributes**: add ESLint rule or review checklist flagging raw strings in `aria-label`/`aria-labelledby`.
4. **Mark decorative SVGs as hidden**: Add `aria-hidden='true'` (and optionally `focusable='false'`) to icons whose meaning is already conveyed by nearby text.
5. **Document the patterns**: capture the good examples above in our component guidelines so new work follows the same recipe.

Once these items are addressed we should re-run a targeted audit (or add automated checks) to keep icon accessibility and i18n from drifting again.

## Next Steps
1. **Sweep decorative/static icons**: Track remaining non-interactive icons and add `aria-hidden`/`role='presentation'` where meaning is duplicated by text.
2. **Replace residual `title` usage**: Identify remaining interactive controls still relying on `title` (e.g. theme dots, legacy components) and migrate them to the tooltip helper with translated content.
3. **Codify lint guardrails**: Add ESLint/custom rule to flag literal strings in `aria-*` props and missing `aria-hidden` on SVGs nested beside textual content.
4. **Update design/system docs**: Publish the tooltip + aria-label patterns in the component guidelines so new work defaults to the accessible approach.
