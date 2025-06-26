Create a bill splitting web app along the lines of the popular app Splitwise.

## Features

 * a user can create or join a "project"
 * projects have an ID, the id will be used in the URL
 * there is almost no security, if a user visits the url of a project then they are given the option to join it if they are not a member already
 * the home page should allow a user to:
   * create a project
   * join a project if they have the ID or url
   * select a project they already are a member of
 * a user can add, edit and remove expenses
 * make sure that if 2 users add an expense (the most common operation) at the same time then both are kept
 * if 2 users edit the same expense, use a UTC timestamp to resolve who wins
 * expenses have a currency, do not make any attempt to handle cross currency problems, track expenses by currency
 * when adding an expense, the default currency should be the one the user used last
 * implement the "simplified balances" and "suggested payments" features that splitwise has
 * a user can add a "settlement" that represents a real world payment, balances should update accordingly
 * the UI should:
   * be clean and basic, we will jazz it up later
   * will work on a desktop browser AND mobile phone
 * a user can leave a project

## Tech

 * it should be able to run locally and restart when changes are detected
 * use jsonbin https://api.jsonbin.io/v3 for the backend, research how to use it.  the api key is `$2a$10$hm7J97lLcGQCE9NGfef8ReIVgLddJrgsro7DJE14.vYdD.b01my1e`
 * make it quick, all backend data relevant to a user should be cached in browser storage
 * use a "best effort" approach to merging data on the client
 * js /css or any other resources should be refenced with relative urls (so the app can work deployed locally and in github-pages)
 * any data that looks "incorrect" (perhaps from a previous version of the app) should be logged and deleted
 * be verbose with logging
 * follow "clean code" principles
