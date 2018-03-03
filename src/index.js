import DClient from './lib';

const client = new DClient('http://jsonapi.test:8080');

const logRecipe = label => async (recipe, relationships) => {
  let tags = [];
  await relationships.tags.consume(tag => tags.push(tag.attributes.name));
  console.group(`${label}:`, recipe.attributes.title);
  console.log('Dish:', recipe.attributes.title);
  console.log('Tags:', tags.join(', '));
  console.groupEnd(`${label}:`, recipe.attributes.title);
}

async function getRecipes(options) {
  const feed = await client.all('node--recipe', options).catch(console.log);
  let next = await feed.consume(logRecipe('Initial')).catch(console.log);
  while (next) {
    next(options.limit);
    next = await feed.consume(logRecipe('Subsequent')).catch(console.log);
  }
}

const filter = client.filter((c, param) => {
  return c.and(
    c('status', 1),
    c.or(c.contains('title', param('paramOne')), c.startsWith('title', 'Thai')),
  );
});

const options = {limit: 3, sort: 'title', relationships: {tags: 'field_tags'}};
getRecipes(options).then(() => {
  console.log('Unfiltered query is done!\n\n');
  options.filter = filter.compile({paramOne: 'easy'});
  getRecipes(options).then(() => console.log('Filtered query is done!'));
});


//client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(logResourceAs('Individual'))
//  .catch(error => console.log('Error:', error));
