# Apply Dangerous Property Check Consistently

**Problem**: The `isDangerousProperty` function in `firebase/functions/src/utils/security.ts` is currently used to identify potentially dangerous property names (e.g., `__proto__`, `constructor`, `prototype`) primarily during document sanitization. However, these properties can be exploited in prototype pollution attacks if they appear anywhere in an incoming request body, not just within document data. Applying this check only during document sanitization leaves other endpoints vulnerable.

**File**: `firebase/functions/src/utils/security.ts`

**Suggested Solution**:
1. **Integrate into Request Validation Middleware**: Integrate the `isDangerousProperty` check into the `validateRequestStructure` middleware (or a similar early validation step, such as a custom body parser) to ensure that no dangerous properties are present in *any* incoming request body, regardless of the specific endpoint or data type. This provides a more comprehensive first line of defense.
2. **Recursive Check**: Ensure the check is applied recursively to all nested objects and arrays within the request body, as dangerous properties can be deeply embedded.
3. **Fail Fast**: If a dangerous property is detected, the request should be immediately rejected with an appropriate error response (e.g., `400 Bad Request`).

**Behavior Change**: This is a behavior change. The application will now reject requests that contain dangerous properties at an earlier stage, which may affect some malformed or malicious requests that previously might have bypassed this check. This is a security enhancement.

**Risk**: Low. The changes are localized to the validation logic and are unlikely to have any unintended side effects on legitimate requests. Thorough testing with various valid and invalid payloads is recommended.

**Complexity**: Medium. This change involves integrating the dangerous property check into the existing request validation logic, potentially requiring modifications to the recursive validation traversal.

**Benefit**: High. This change will significantly improve the security of the application by preventing prototype pollution and other related attacks across all API endpoints, making the application more resilient to common web vulnerabilities.