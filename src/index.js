import DClient from './lib';

const client = new DClient('http://jsonapi.test:8080', console);

const filter = client.filter((c, param) => {
  return c.and(
    c('status', 1),
    c.or(c.contains('title', param('paramOne')), c.startsWith('title', 'Thai')),
  );
});

const options = {
  limit: 3,
  sort: 'title',
  //filter: filter.compile({paramOne: 'easy'}),
  relationships: {
    author: 'uid',
    tags: {
      field: 'field_tags',
      relationships: {
        vocabulary: 'vid',
      },
    },
  }
};

client
  .all('node--recipe', options)
  .then(async feed => {
    while (more = await feed.consume(resource => console.log('Initial:', resource))) {
      console.log(`There are ${more ? 'more' : 'no more'} resources!`);
      more(2);
    }
  })
  .catch(error => console.log('Error:', error));
      //.then(more => {
      //});
      //console.log(`There are ${more ? 'more' : 'no more'} resources!`);
      //if (more) {
      //  more(20);
      //  feed.consume(resource => console.log('Initial:', resource)).then(evenMore => {
      //    console.log(`There are ${evenMore ? 'more' : 'no more'} resources!`);
      //  });
      //}

//client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(resource => console.log('Individual:', resource))
//  .catch(error => console.log('Error:', error));
