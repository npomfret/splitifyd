# Refactor
Clean up and optimize code in: $ARGUMENTS

## Instructions

You will analyse the code using the following guidelines:

1. **Remove Unused Elements**
    - Delete unused imports, variables, functions, and methods
    - Remove unreachable code and dead code paths
    - Eliminate unused dependencies and type definitions
    - Remove commented-out code blocks

2. **Simplify Verbose Code**
    - Replace verbose constructs with concise equivalents
    - Eliminate unnecessary intermediate variables
    - Use modern language features (destructuring, optional chaining, etc.)
    - Simplify complex conditional expressions where possible

3. **Improve Naming**
    - Rename files to reflect their actual purpose and content
    - Replace vague names (data, item, thing, temp) with descriptive ones
    - Use consistent naming conventions throughout
    - Ensure function names clearly describe what they do (createUser vs getUserData)
    - Make variable names self-documenting

4. **Eliminate Duplication**
    - Extract common patterns into reusable functions
    - Remove duplicate logic and consolidate similar code
    - Create shared utilities for repeated operations
    - Identify and merge similar functions with slight variations

5. **Remove Unnecessary Comments**
    - Delete comments that merely restate what the code does
    - Remove outdated or incorrect comments
    - Keep only comments that explain WHY, not WHAT
    - Preserve complex business logic explanations

6. **Remove Unnecessary Line Wrapping**
    - Consolidate artificially wrapped lines that don't improve readability
    - Use long lines when they're clearer than wrapped versions
    - Keep natural breaks at logical boundaries
    - Maintain readability as the primary concern

7. **Performance & Efficiency**
    - Replace inefficient algorithms or data structures
    - Eliminate unnecessary object creation in loops
    - Add memoization for expensive computations
    - Convert synchronous operations to async where beneficial
    - Fix memory leaks (event listeners, timers, references)

8. **Error Handling & Robustness**
    - Add missing error handling or replace generic catch-all blocks
    - Establish consistent error handling patterns
    - Replace silent failures with proper logging or handling
    - Add input validation where missing
    - Remove hardcoded assumptions that could break

9. **Security Issues**
    - Remove hardcoded secrets, API keys, or passwords
    - Fix SQL injection vulnerabilities
    - Address XSS vulnerabilities in web code
    - Replace insecure random number generation
    - Add missing input sanitization

10. **Code Structure & Architecture**
    - Break down god objects/functions doing too many things
    - Reduce tight coupling between modules
    - Add abstractions for repeated patterns
    - Fix inappropriate use of inheritance vs composition
    - Resolve circular dependencies

11. **Resource Management**
    - Ensure file handles, database connections, streams are properly closed
    - Add cleanup in finally blocks or destructors
    - Optimize inefficient database queries (fix N+1 problems)
    - Release large objects from memory when no longer needed

12. **Configuration & Environment**
    - Extract hardcoded values to configuration
    - Separate environment-specific code from business logic
    - Add feature flags for experimental code
    - Establish consistent configuration patterns

13. **Documentation & Metadata**
    - Add or update missing JSDoc/docstrings
    - Clean up inconsistent TODO/FIXME comments
    - Add type annotations where beneficial
    - Update outdated package.json or dependency files

14. **Testing & Debugging**
    - Remove console.log statements left in production code
    - Clean up debug flags or development-only code
    - Add missing edge case handling
    - Simplify overly complex test setups

## Focus Areas
- Prioritize changes that improve code clarity and maintainability
- Ensure all functionality remains exactly the same
- Preserve any complex business logic or edge case handling
- Maintain consistent style with the existing codebase
- Address security issues immediately
- Improve performance without sacrificing readability

# IMPORTANT
Pick just 1 single issue and "fix" it.