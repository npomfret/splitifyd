# Bug: Inconsistent Modal Background Blur

**Problem:** When a modal opens, the background blurs, but the amount or quality of this blur appears inconsistent across different modals in the application. Specifically, the "Invite Others" modal has been identified as exhibiting this inconsistency. This leads to a visually jarring and less polished user experience.

**Impact:** Inconsistent visual effects detract from the application's overall professionalism and can create a sense of instability for the user.

**Proposed Solution:**
Investigate the styling applied to the modal backgrounds, specifically the blur effect. Ensure that a consistent blur effect is applied to all modals throughout the application. This may involve:
1. Identifying the CSS properties responsible for the blur effect (e.g., `backdrop-filter: blur()`).
2. Standardizing the blur value and any other related styling across all modal implementations.
3. Checking if different modal components or their parent containers have conflicting styles that might override or interfere with the intended blur.

**Technical Notes:**
- Examine the `webapp-v2/src/components/ui/Modal.tsx` component, as it likely forms the base for most modals.
- Look into any specific styling or overrides applied to the "Invite Others" modal (e.g., in `webapp-v2/src/components/group/InviteOthersModal.tsx` or its parent components).
- Verify that `backdrop-filter` is consistently supported across target browsers or if there are fallback mechanisms in place.
- Consider if the issue is related to the stacking context or z-index of the modal or its backdrop.
