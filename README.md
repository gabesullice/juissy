d'Client
====

d'Client is a minimal experimental JSON API client for Drupal.

### Features:
- Zero-configuration
- Automatic pagination
- Late-binding filter compiler
- ???

### Example:
```js
// A client only needs a base URL. It doesn't need to know anything else!
const client = new DClient('http://jsonapi.test:8080');

// It's best to read the code beneath these comments, then fill in your gaps in
// understading with these comments.

// `client.all()` returns a Promise. You may specify a limit for number of
// resources to retrieve, sorting rules, and filters too! If no limit is given
// the client will *lazily* resolve every resource on the server!
  // The Promise returned by `client.all()` resolves to a feed.
    // You "consume" resources by specifing a function to run for every resolved
    // resource. This will run for every resource up to the given maximum or
    // until there are no more resources available.
      // `consume` itself returns a Promise that will resolve to either a
      // function or `false` if there are no more resources available.
          // The `more` function lets you increase the number of resources to be
          // resolved.
          // Once the maximum has been increased, you may consume the additional
          // resources.
            // While the second `consume` call is "nested" here for the sake of
            // example, you need not do the same. Just take care that `consume`
            // is not called again before the first `consume` has completed.

client.all('node--recipe', { limit: 3, sort: 'title' })
  .then(feed => {
    return feed.consume(print('Initial'))
      .then(more => {
        console.log(`There are ${more ? 'more' : 'no more'} resources!`);
        if (more) {
          more(10);
          feed
            .consume(print('Additional'))
            .then(evenMore => {
              console.log(`There are ${evenMore ? 'more' : 'no more'} resources!`);
            });
        }
      });
  })
  .catch(error => console.log('Error:', error));

// This will just print the title of every recieved resource.
const print = (label) => {
  return resource => console.log(`${label}:`, resource.attributes.title);
};
```

If the server had a total of 7 resources, the above would print:
```
Initial: Deep mediterranean quiche
Initial: Gluten free pizza
Initial: Super easy vegetarian pasta bake
There are more resources!
Additional: Thai green curry
Additional: Vegan chocolate brownies
Additional: Victoria sponge cake
Additional: Watercress soup
There are no more resources!
```

If we want to add a custom filter, we would do so like this:
```js
// `client.filter` receives a function that is passed all the components of a
// query builder.
const filter = client.filter((c, and, or, param) => {
  // Use the `and` and `or` function to build groups.
    // `c` is a shorthand for `c.eq`.
    // Nested groups are perfectly fine.
      // You can express other operators by calling methods on `c`.
      // You can 'parameterize' your queries with the param method.
      // You can even parameterize your operators!
  return and(
    c('status', 1),
    or(
      c.startsWith('title', 'Thai'),
      c.contains('title', param('myValueParam')),
      c.condition('title', 'chocolate', param('myOperatorParam')),
    ),
  );
});

const options = {
  limit: 3,
  sort: 'title',

  // `compile` will build a filter query string and replace your parameters.
  filter: filter.compile({
    myValueParam: 'easy',
    myOperatorParam: '<>',
  }),
};
```
