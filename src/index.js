import DClient from './lib';

const client = new DClient('http://jsonapi.test:8080', console);

const logger = label => {
  return resource => console.log(`${label}:`, resource.attributes.title);
};

client
  .all('node--recipe', { max: 3, sort: 'title' })
  .then(cursor => {
    return cursor.forEach(logger('Initial')).then(more => {
      console.log(`There are ${more ? 'more' : 'no more'} resources!`);
      more(10);
      cursor.forEach(logger('Additional')).then(evenMore => {
        console.log(`There are ${evenMore ? 'more' : 'no more'} resources!`);
      });
    });
  })
  .catch(error => console.log('Error:', error));

//client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(resource => console.log('Individual:', resource))
//  .catch(error => console.log('Error:', error));
