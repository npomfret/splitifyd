## Testing

We have just 2 types of test:

- unit tests - these do not need the emulator to be running
- integration tests - these DO need the emulator to be running

## Tech choices 

We use Jest as a test runner and Playwright for in-browser testing.

## Example run commands

Each build file _should_ follow the same patther with its run targets. 

```
npm run test:unit
npm run test:integration # runs only the integration tests (the emulator is not needed) 
npm run test # runs all tests (the emulator is not needed) 
```

To run just one test:

```shell
npx jest src/<...path...>.test.ts --verbose --json --outputFile test-report.json 
```

## Guidelines for Writing Tests

- Test complexity must be lower than the code they exercise
- Focus on behaviour, not implementation details
- Avoid complex mocking setups; prefer builder patterns (see below) or in-browser testing
- Remove pointless, outdated, redundant, duplicated, outdated, pedantic or low‑benefit tests
- Never test features that don’t exist (yet)
- Ignore theoretical edge cases that won’t occur - **don't be pedantic**
- Avoid high maintenance tests with low benefit
- Factor out complex setup in order to make tests easy to read
- Fail fast!!: Test state regularly and early; fail quickly with great error messages
- Use specific matchers: Test for the exact condition you need, not just "something changed"
- Set reasonable timeouts: Start with 1-5 seconds, adjust based on actual operation timing
- Provide descriptive error messages: Include context about what condition was expected

## Builders

Mocks are useful, but the builder pattern is simple and very powerful. It can be used to reduce the lines of coded needed in test setup **and** helps to focus the test on what's important.

Avoid this:

```typescript
const foo = {
    name: "bob",
    age: 66,
    location: "the moon",// only this one is imporant
    occupation: "stunt guy"
}

const res = app.doSomething(foo);

assert(res)...
```

Instead, use a builder:
```typescript
const foo = new FooBuilder()
    .withLocation("the moon")
    .build();

const res = app.doSomething(foo);

assert(res)...
```

## Testing Asynchronous Operations with Polling

For testing asynchronous operations where the timing is unpredictable (background jobs, database triggers, eventual consistency, etc.), use a polling pattern rather than fixed delays.

### The Pattern

The polling pattern repeatedly calls a data source until a matcher function returns true, or until a timeout is reached:

```typescript
// Generic polling method
async function pollUntil<T>(
  fetcher: () => Promise<T>,      // Function that retrieves data
  matcher: (value: T) => boolean, // Function that tests the condition
  options: {
    timeout?: number;    // Total timeout in ms (default: 10000)
    interval?: number;   // Polling interval in ms (default: 500)
    errorMsg?: string;   // Custom error message
  } = {}
): Promise<T> {
  const { timeout = 10000, interval = 500, errorMsg = 'Condition not met' } = options;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await fetcher();
      if (await matcher(result)) {
        return result;
      }
    } catch (error) {
      // Log but continue polling (or fail fast if needed)
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`${errorMsg} after ${timeout}ms`);
}
```

### Usage Example

```typescript
// Wait for async operation to complete
const result = await pollUntil(
  () => api.getResource(id),                    // How to fetch data
  (data) => data.status === 'completed',       // What condition to check
  { timeout: 15000, errorMsg: 'Operation did not complete' }
);

// Test the final state
expect(result.value).toBe(expectedValue);
```

## Firebase Trigger Testing Patterns

When testing Firebase triggers (Firestore document changes, Cloud Functions), avoid flaky timing-based approaches.

### ❌ Avoid These Anti-Patterns

```typescript
// DON'T: Fixed timeouts with listeners
const changePromise = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error('Timeout after 2 seconds'));
  }, 2000);  // Arbitrary fixed timeout
  
  const listener = db.collection('changes').onSnapshot(snapshot => {
    // Complex listener logic...
    clearTimeout(timeout);
    resolve(data);
  });
});
```

```typescript
// DON'T: Arbitrary sleep delays
await new Promise(resolve => setTimeout(resolve, 2000));
const changes = await getChanges();  // Hope trigger fired by now
```

### ✅ Use Condition-Based Polling

```typescript
// DO: Use the pollForChange helper
import { pollForChange } from '../support/changeCollectionHelpers';

const change = await pollForChange(
  FirestoreCollections.TRANSACTION_CHANGES,
  (doc) => doc.id === expectedId && 
           doc.type === 'settlement' &&
           doc.users.includes(userId),
  { timeout: 5000, groupId }
);
```

### Key Principles

1. **Poll for specific conditions**, not arbitrary time periods
2. **Use existing helpers** like `pollForChange` instead of custom listeners
3. **Check for exact state** you expect (all required fields/values)
4. **Set reasonable timeouts** (5-10 seconds for triggers)
5. **Clean up properly** - remove unused listener variables and callbacks

