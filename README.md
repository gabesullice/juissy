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

// `client.all()` returns a Promise. You may specify a max number of resource to
// retrieve, sorting rules, and filters too! If no maximum is given the client
// will *lazily* resolve every resource on the server!
client.all('node--recipe', { max: 3, sort: 'title' })

  // The Promise returned by `client.all()` resolves to a cursor.
  .then(cursor => {

    // You "consume" resources by specifing a function to run for every resolved
    // resource. This will run for every resource up to the given maximum or
    // until there are no more resources available.
    return cursor.forEach(print('Initial'))

      // `forEach` itself returns a Promise that will resolve to either a
      // function or `false` if there are no more resources available.
      .then(more => {
        console.log(`There are ${more ? 'more' : 'no more'} resources!`);
        if (more) {

          // The `more` function lets you increase the number of resources to be
          // resolved.
          more(10);

          // Once the maximum has been increased, you may consume the additional
          // resources.
          cursor.forEach(print('Additional'))
            .then(evenMore => {
              console.log(`There are ${evenMore ? 'more' : 'no more'} resources!`);
            });

          // While the second `forEach` call is "nested" here for the sake of
          // example, you need not do the same. Just take care that `forEach`
          // is not called again before the first `forEach` has completed.
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
  max: 3,
  sort: 'title',

  // `compile` will build a filter query string and replace your parameters.
  filter: filter.compile({
    myValueParam: 'easy',
    myOperatorParam: '<>',
  }),
};
```
