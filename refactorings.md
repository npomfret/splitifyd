# Suggested refactorings for splitifyd

## Top 5 Refactoring Priorities



### 2. 🧹 **Remove Try/Catch/Log Anti-patterns**
**Files:** 
- `firebase/functions/src/index.ts:32-38` (health check)
- `firebase/functions/src/auth/middleware.ts:143-148` (optional auth)

**Issue:** Catching and logging errors prevents fail-fast behavior  
**Impact:** Medium - Hides bugs, violates CLAUDE.md principles  
**Fix:** Remove try/catch or re-throw errors  
**Effort:** Low - Simple removal  

### 3. ⚡ **Fix Memory Leak in Token Refresh**
**File:** `firebase/public/app.js:469-472`  
**Issue:** `setInterval` runs forever, never cleared on sign-out  
**Impact:** Medium - Memory leak, unnecessary API calls  
**Fix:** Clear interval on sign-out, use token expiry time  
**Effort:** Medium - Track interval ID and clear properly  

### 4. 🗑️ **Remove Over-Engineered Configuration System**
**Files:**
- `firebase/functions/src/config/config.ts:75-177`
- `firebase/functions/src/utils/logger.ts:32-77`

**Issue:** Excessive abstraction and complexity for simple configs  
**Impact:** High - Code clarity and maintainability  
**Fix:** Simplify to direct configuration values, use Firebase logger directly  
**Effort:** Medium - Requires updating references  

## Additional Easy Wins

- **Remove unused constants** in `firebase/functions/src/constants.ts`
- **Remove debug token info** from `firebase/public/app.js:79-80` 
- **Replace magic numbers** with named constants throughout
- **Rename `InMemoryRateLimiter`** to `UserRateLimiter` for clarity
- **Remove emulator config** from production code