import DClient from './lib';

const client = new DClient('https://jsonapi.test', {
  authorization: `Basic ${btoa('root:root')}`,
});

(async () => {
  const options = {
    limit: 5,
    sort: '-title',
    relationships: {
      image: {
        field: 'field_image',
        anticipate: {
          file: '.data.attributes.url',
        },
      },
      tags: {
        field: 'field_tags',
        relationships: {
          vocabulary: 'vid',
        },
      },
    },
  };
  (await client.all('node--recipe', options)).consume(
    logRecipe('Initial'),
    true,
  );
})();

//options.filter = filter.compile({paramOne: 'easy'});
const filter = client.filter((c, param) => {
  return c.and(
    c('status', 1),
    c.or(c.contains('title', param('paramOne')), c.startsWith('title', 'Thai')),
  );
});

const logRecipe = label => async (recipe, relationships) => {
  let tags = [];
  let vocabs = [];
  let images = [];

  await relationships.image.consume(async image => {
    images.push(image.attributes.url);
  });

  await relationships.tags.consume(async (tag, relationships) => {
    tags.push(tag.attributes.name);

    await relationships.vocabulary.consume(vocab => {
      vocabs.push(vocab.attributes.name);
    });
  });

  const ul = document.getElementById('recipes');
  const li = document.createElement('li');
  const img = document.createElement('img');
  images.forEach(src => (img.src = src));
  li.appendChild(img);
  li.appendChild(document.createTextNode(recipe.attributes.title));
  ul.appendChild(li);
};

//client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(logResourceAs('Individual'))
//  .catch(error => console.log('Error:', error));
