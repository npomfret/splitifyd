# Analyse
Clean up and optimize code in: $ARGUMENTS

## Instructions

You will run a thorough analysis the code in $ARGUMENTS using the following guidelines:

**!! Simplify !!**
 * Find and remove unnecessary complexity
 * Eliminate unnecessary intermediate variables
 * Replace verbose constructs with concise equivalents
 * Use modern language features (destructuring, optional chaining, etc.)
 * Over engineering is BAD. Sometimes the simple approach is best

**Remove Unused Elements**
 * Delete unused imports, variables, functions, and methods
 * Remove unreachable code and dead code paths
 * Eliminate unused dependencies and type definitions
 * Remove commented*out code blocks

**Improve Naming**
 * Rename files to reflect their actual purpose and content
 * Replace vague names (data, item, thing, temp) with descriptive ones
 * Use consistent naming conventions throughout
 * Ensure function names clearly describe what they do (createUser vs getUserData)
 * Make variable names self*documenting

**Eliminate Duplication**
 * Extract common patterns into reusable functions
 * Remove duplicate logic and consolidate similar code
 * Create shared utilities for repeated operations
 * Identify and merge similar functions with slight variations

**Remove Unnecessary Comments**
 * Delete comments that merely restate what the code does
 * Remove outdated or incorrect comments
 * Keep only comments that explain WHY, not WHAT
 * Preserve complex business logic explanations

**Formatting and code style**
 * Consolidate artificially wrapped lines that don't improve readability
 * Use long lines when they're clearer than wrapped versions
 * Keep natural breaks at logical boundaries
 * Maintain readability as the primary concern
 * certain code patterns, like function-chaining, can benefit greatly from line wrapping

**Performance & Efficiency**
 * Replace inefficient algorithms or data structures
 * Eliminate unnecessary object creation in loops
 * Add memoization for expensive computations
 * Convert synchronous operations to async where beneficial
 * Fix memory leaks (event listeners, timers, references)

**Error Handling & Robustness**
 * Type safety is (almost always) a good thing
 * Add missing error handling or replace generic catch*all blocks
 * Establish consistent error handling patterns
 * Replace silent failures with proper logging or handling
 * Add input validation where missing
 * Remove hardcoded assumptions that could break

**Security Issues**
 * Remove hardcoded secrets, API keys, or passwords
 * Fix SQL injection vulnerabilities
 * Address XSS vulnerabilities in web code
 * Replace insecure random number generation
 * Add missing input sanitization

**Code Structure & Architecture**
 * Break down god objects/functions doing too many things
 * Reduce tight coupling between modules
 * Add abstractions for repeated patterns
 * Fix inappropriate use of inheritance vs composition
 * Resolve circular dependencies

**Resource Management**
 * Ensure file handles, database connections, streams are properly closed
 * Add cleanup in finally blocks or destructors
 * Optimize inefficient database queries (fix N+1 problems)
 * Release large objects from memory when no longer needed
 
**Configuration & Environment**
 * Extract hardcoded values to configuration
 * Separate environment*specific code from business logic
 * Add feature flags for experimental code
 * Establish consistent configuration patterns

**Documentation & Metadata**
 * Add or update missing JSDoc/docstrings
 * Clean up inconsistent TODO/FIXME comments
 * Add type annotations where beneficial
 * Update outdated package.json or dependency files

**Testing & Debugging**
 * Remove console.log statements left in production code
 * Clean up debug flags or development*only code
 * Add missing edge case handling
 * Simplify overly complex test setups

**Eliminate try/catch/log**
 * in general, it is ok to let exceptions bubble out.  if we have a bug we want to know about it and the app should crash
 * catch and log is fine in some places, but we always want to be in a **known state**

**Find and fix questionable technology choices**
 * explain the problem, suggest an improvement. Be brief.

**Build**
 * Check for missing builds
 * Check for complex builds
 * Check for builds using out of date technology
 * Check for builds using confusing or (very) non-standard patterns
 * Check deployment is accurately documented
 * Check running the app locally is accurately documented

# Report back

Collect all issues and make a list of your top 5. I want:

 * important stuff
 * easy / simple stuff
 * big impact stuff  

Write them to a file in the root of the project called `refactorings.md` (overwrite the file if it is present). Use the heading "Suggested refactorings for $ARGUMENTS"