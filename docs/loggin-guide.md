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