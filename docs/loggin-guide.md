# Loggin guide

Don't use the console. Always use a logger (including in-browser)

Audit changes instead of logging them:

Bad:
```
logger.debug('user name changed from steve to bob')
```

Better:
```
logger.debug('detected name change', {before: 'steve', after: 'bob'}))
```

In the browser, avoid logging objects (because the output is difficult to copy). Instead, JSON.stringify them (the logger should handle this)

Avoid `try/catch/log` as it often results in inconsisent state. It is often desireable to have exceptions bubble out.  We want to know if the app is broken.

Avoid `try/catch/log/throw` unless you are adding context as errors often get logged multiple times. Instead, as node doesn't have exception chaining, this is ok:

```
    try {
        // do thing that might go wrong
    } catch (e: any) {
        e.someExtraContext = foo;
        throw e;
    }
```