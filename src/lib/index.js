import Filter from './filters.js';

export default class DrupalClient {
  constructor(baseUrl, logger) {
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

  get(type, id) {
    return this.withLink(type)
      .then(link => this.fetchDocument(`${link}/${id}`))
      .then(doc => this.documentData(doc))
      .catch(err => {
        this.logger.log(err);
        return null;
      });
  }

  all(type, { limit = -1, sort = '', filter = '' } = {}) {
    return this.withLink(type).then(baseLink => {
      var link = `${baseLink}`;
      if (filter.length) {
        link += `?${filter}`;
      }
      if (sort.length) {
        link += `${filter.length ? '&' : '?'}sort=${sort}`;
        link += `&page[limit]=2`;
      }

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

      var count = 0;
      const cursor = (function*() {
        while (buffer.length || inFlight.size || link) {
          yield limit === -1 || count < limit ? advance().then(buffer => {
            count++
            const resource = buffer.shift();
            return resource || null;
          }) : false;
        }
      })();
      cursor.canContinue = () => buffer.length || inFlight.size || link;
      cursor.addMore = (many = -1) => many === -1 ? (limit = -1) : (limit += many);

      return this.toStream(cursor);
    });
  }

  toStream(cursor) {
    return {
      subscribe: function(g) {
        return new Promise((resolve, reject) => {
          const f = next => {
            if (next) {
              next
                .then(resource => {
                  if (resource) g(resource);
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

  withLink(type) {
    return new Promise((resolve, reject) => {
      this.links
        .then(links => {
          if (!links.hasOwnProperty(type)) {
            reject(`'${type}' is not a valid type for ${this.baseUrl}.`);
          }
          resolve(links[type]);
        })
        .catch(reject);
    });
  }

  filter(f) {
    return new Filter(f);
  }

}
