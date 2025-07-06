# Common Mistakes

## Backward Compatible Code
DO NOT write any code for _backward compatibility_ reasons. This project is a demo, there is no legacy data or legancy systems to integrate with.

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