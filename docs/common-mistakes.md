# Common Mistakes

## Backward Compatible Code
 - DO NOT write any code for _backward compatibility_ reasons (unless instructed to do so). This project is a demo, there is no legacy data or legacy systems to integrate with.
 - Similarly, there is no existing data that can't be deleted. NEVER write migration scripts, or code to handle multiple formats
 - if data formats need to change, we will write a migration script.

## Keep it working
The project needs to work locally, via the firebase emulator AND in a deployed firbase environment.

There are important configuration differences, largely around cross site scripting issues.

MAKE SURE THE APP WILL RUN after a change is made.  Do not reduce security.

## No hacking
 - Do not _bodge_ code in because it's easy
 - Do not write _fallback_ logic in case data isn't in the expected format - it will be
 - try/catch/log is usually an antipattern that leads to unknown state
 - it's often ok to let exceptions bubble out
 - read the latest documentation for the API's you are using

## Type safety is good
 - Wherever possible, embrace the available type system
 - If there is a build that compiles code, after making a change: run it!

## Write and run tests
 - no need to over-test; but under testing is very bad
 - some tests can be deleted
 - test should be conceptually simpler than the code they are testing

## Trust 
 - Trust data coming from the server
 - Do not trust data coming from any external system (or our users)

## Shell
 - run `pwd` BEFORE executing shell commands to ensure you are in the desired directory

## Keep it clean
 - Don't leave temporary files lying around. Delete them (don't got ignore them!)
 - DO not mix build artifacts with checked in files

## Content Security Policy (CSP)
 - NEVER use inline event handlers like `onclick="function()"` in HTML - they violate CSP
 - Always add event listeners via JavaScript using `addEventListener()` instead
 - This applies to all inline handlers: onclick, onchange, onsubmit, etc.

# Dependencies 
 - DO NOT USE AXIOS. NEVER USE AXIOS. Node has a perfectly good request library. 
 - Avoid using external libraries in general if possible

# Web
 - Do not bundle our js files into 1 file
 - Do not obfuscate or minimise

## Firebase Configuration
 - NEVER edit `firebase/firebase.json` directly - it is a build artifact
 - ALWAYS edit `firebase/firebase.template.json` instead
 - The build process generates `firebase.json` from the template