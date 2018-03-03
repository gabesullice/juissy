import Filter from './filters.js';

export default class DrupalClient {

  constructor(baseUrl, logger = console) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.links = new Promise((resolve, reject) => {
      this.fetchDocument(`${baseUrl}/jsonapi`)
        .then(doc => resolve(doc.links || {}))
        .catch(err => {
          this.logger.log('Unable to resolve resource links.');
          reject(err);
        });
    });
  }

  async get(type, id) {
    const link = `${await this.getLink(type)}/${id}`;
    return this.documentData(await this.fetchDocument(link));
  }

  async all(type, { limit = -1, sort = '', filter = '', relationships = null} = {}) {
    let link = await this.collectionLink(type, {sort, filter, page: 'page[limit]=2'});
    return this.toConsumer(this.paginate(link, limit), relationships);
  }

  paginate(link, limit) {
    var buffer = [];
    var resourceCount = 0;
    const inFlight = new Set([]);

    const doRequest = nextLink => {
      inFlight.add(nextLink);
      return this.fetchDocument(nextLink).then(doc => {
        inFlight.delete(nextLink);
        link = doc.links.next || false;
        var resources = this.documentData(doc);
        resourceCount += (resources) ? resources.length : 0;
        buffer.push(...(resources || []));
        return Promise.resolve(buffer);
      });
    };

    var collectionRequests = [];
    const advance = () => {
      if (link && !inFlight.has(link) && (limit === -1 || resourceCount < limit)) {
        collectionRequests.push(doRequest(link));
      }
      return !buffer.length && collectionRequests.length
        ? collectionRequests.shift().then(() => buffer)
        : Promise.resolve(buffer);
    };

    const cursor = (function*() {
      while (buffer.length || inFlight.size || link) {
        yield limit === -1 || resourceCount < limit ? advance().then(buffer => {
          const resource = buffer.shift();
          return resource || null;
        }) : false;
      }
    })();
    cursor.canContinue = () => buffer.length || inFlight.size || link;
    cursor.addMore = (many = -1) => many === -1 ? (limit = -1) : (limit += many);

    return cursor;
  }

  toConsumer(cursor, relationships = null) {
    const self = this;
    return {
      consume: function(consumer) {
        const decoratedConsumer = self.decorateWithRelationships(consumer, relationships);
        return new Promise((resolve, reject) => {
          const f = next => {
            if (next) {
              next
                .then(resource => {
                  decoratedConsumer(resource);
                  f(cursor.next().value);
                })
                .catch(reject);
            } else {
              resolve(
                cursor.canContinue() ? cursor.addMore : false,
              );
            }
          };
          f(cursor.next().value);
        });
      },
    };
  }

  decorateWithRelationships(consumer, relationships = null) {
    const decorated = !relationships
      ? consumer
      : resource => {
        const mirror = {};
        Object.getOwnPropertyNames(relationships).forEach(relationship => {
          const target = typeof relationships[relationship] === 'string'
            ? {field: relationships[relationship]}
            : relationship;
          let path = [], link;
          mirror[relationship] = (link = extractValue(`relationships.${target.field}.links.related`, resource))
            ? this.toConsumer(this.paginate(link, target.limit || -1))
            : Promise.reject();
        });
        consumer(resource, mirror);
      };
    return resource => {
      // Only call the consumer with non-null values.
      if (resource) decorated(resource);
    };
  }

  fetchDocument(url) {
    return fetch(url).then(
      res => (res.ok ? res.json() : Promise.reject(res.statusText)),
    );
  }

  documentData(doc) {
    if (doc.hasOwnProperty('data')) {
      return doc.data;
    }
    if (doc.hasOwnProperty('errors')) {
      doc.errors.forEach(this.logger.log);
      return null;
    } else {
      this.logger.log(
        'The server returned an unprocessable document with no data or errors.',
      );
    }
  }

  getLink(type) {
    return this.links.then(links => {
      if (!links.hasOwnProperty(type)) {
        Promise.reject(`'${type}' is not a valid type for ${this.baseUrl}.`);
      }
      return links[type];
    });
  }

  filter(f) {
    return new Filter(f);
  }

  async collectionLink(type, {sort, filter, page} = {}) {
    let query = '';
    query += filter.length ? `?${filter}` : '';
    query += sort.length ? `${query.length ? '&' : '?'}sort=${sort}` : '';
    query += page.length ? `${query.length ? '&' : '?'}${page}` : '';
    return `${await this.getLink(type)}${query}`;
  }

}

function extractValue(path, obj) {
  return path.split('.').reduce((exists, part) => exists && exists.hasOwnProperty(part) ? exists[part] : false, obj);
}
