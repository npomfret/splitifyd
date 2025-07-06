# Optimize GroupService.getGroup and getGroupMembers

**Problem**: The `GroupService.getGroup` and `GroupService.getGroupMembers` methods in `webapp/js/groups.js` currently fetch all user groups via `apiService.getGroups()` and then filter the results in memory to find the specific group or its members. This is highly inefficient, especially for users with many groups, as it fetches unnecessary data on every call to these methods. It leads to increased network traffic and client-side processing.

**File**: `webapp/js/groups.js`

**Suggested Solution**:
1. **Direct API Call for Single Group**: Modify `GroupService.getGroup` to make a direct API call to fetch a single group by its ID (e.g., `apiService.getGroup(groupId)`). The backend already provides an endpoint for this (`/getDocument?id=...`). This ensures only the requested group's data is fetched.
2. **Derive Members from Group**: Once `GroupService.getGroup` is optimized to fetch a single group, `GroupService.getGroupMembers` can simply call `GroupService.getGroup(groupId)` and extract the `members` array from the returned group object. This avoids fetching all groups just to get members of one.
3. **Consider Caching (Optional)**: For frequently accessed group data, a client-side cache (e.g., in-memory or `IndexedDB`) could be implemented to reduce redundant API calls, but this should be done after optimizing direct fetches.

**Behavior Change**: This is a pure refactoring with no behavior change. The application's functionality will remain the same, but the performance of fetching group details and members will be significantly improved.

**Risk**: Low. The changes are localized to the `GroupService` methods and involve changing the data fetching strategy. As long as the API endpoints are correctly called and data is handled, the risk of side effects is minimal.

**Complexity**: Low. This is a straightforward optimization that involves making direct API calls instead of filtering a large dataset.

**Benefit**: High. This change will significantly improve the performance of fetching group details and members, reduce network traffic, and decrease client-side processing, leading to a more responsive user experience.