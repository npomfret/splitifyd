## Code principles

 * embrace fail fast - if something isn't right, we want to know. Check stuff early, and blow up if it's not 100% correct
 * in general, it's ok for exceptions to bubble out - we want to crash if the app is broken
 * try/catch/log is only ok in certain scenarios
 * in general, less is more - keep code neat and tidy
 * tidy up after make a change; don't leave unused stuff lying around
 * do not worry about backward compatibility unless you have been instructed otherwise
 * always consider security, performance and scalability - sometimes none are important, sometimes they all are
 * be modern and always use the latest APIs / patterns / libraries
 * don't comment; write clear code instead
 * don't log; audit changes instead (using a logger)
 * in general, less in more when it comes to lines of code
 * log line are fine, but certain code patterns benefit from line wrapping (such as function-chaining)
 * avoid creating "private" functions/methods if they are only called in once place
 * minimise mutable state in classes - it always creates complexity

##  General behaviour

 * add new files to git, but never commit or push anything
 * don't ever use quick hacks, especially something that might cause a security problem in the future
 * assume all code is production-ready
 * 