# Task: Webapp-v2 Hardening & Cleanup

## Focus
Last remaining hardening item: simplify `enhancedGroupsStore` and `enhancedGroupDetailStore` by teasing apart pagination, realtime, and auxiliary responsibilities.

## Plan
1. Introduce helper modules for the groups store (pagination controller, error state manager, refresh/realtime coordinator) without changing the public API.
2. Refactor `enhancedGroupsStore` to compose those helpers so pagination, realtime wiring, and error handling stay encapsulated while existing behaviour remains intact.
3. Add analogous helpers for the group-detail store (paginated collections, realtime orchestration, external integration hooks).
4. Refactor `enhancedGroupDetailStore` to lean on the helpers, keeping core state updates concise and readable.
5. Update or extend tests/docs as needed and run targeted checks after the refactor.
