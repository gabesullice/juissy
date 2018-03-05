import DClient from './lib';

const client = new DClient('http://jsonapi.test:8080', {
  authorization: `Basic ${btoa('root:root')}`,
});

(async () => {
  const options = {
    limit: 3,
    sort: 'title',
    relationships: {
      tags: {
        field: 'field_tags',
        relationships: {
          vocabulary: 'vid'
        },
      },
    }
  };
  //options.filter = filter.compile({paramOne: 'easy'});
  const feed = await client.all('node--recipe', options);
  let next = await feed.consume(logRecipe('Initial'));
  while (next) {
    next(options.limit);
    next = await feed.consume(logRecipe('Subsequent'))
  }
})()

const filter = client.filter((c, param) => {
  return c.and(
    c('status', 1),
    c.or(
      c.contains('title', param('paramOne')),
      c.startsWith('title', 'Thai')
    ),
  );
});

const logRecipe = label => async (recipe, relationships) => {
  let tags = [];
  let vocabs = [];
  await relationships.tags.consume(async (tag, relationships) => {
    tags.push(tag.attributes.name);

    await relationships.vocabulary.consume(vocab => {
      vocabs.push(vocab.attributes.name);
    });
  });

  console.groupCollapsed(`${label}: ${recipe.attributes.title}`);
  console.log('Dish:', recipe.attributes.title);
  console.log('Tags:', tags.length ? tags.join(', '): 'n/a');
  console.log('Vocabularies:', vocabs.length ? vocabs.join(', '): 'n/a');
  console.groupEnd(`${label}: ${recipe.attributes.title}`);
}

//client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(logResourceAs('Individual'))
//  .catch(error => console.log('Error:', error));
