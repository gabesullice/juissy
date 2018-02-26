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

  all(type, { max = -1, sort = '', filter = '' } = {}) {
    return this.withLink(type).then(baseLink => {
      var link = `${baseLink}`;
      if (filter.length) {
        link += `?${filter}`;
      }
      if (sort.length) {
        link += `${filter.length ? '&' : '?'}sort=${sort}`;
      }
      var collectionRequests = [];
      var collection = [];
      const inFlight = new Set([]);
      const doRequest = nextLink => {
        inFlight.add(nextLink);
        return this.fetchDocument(nextLink).then(doc => {
          inFlight.delete(nextLink);
          link = doc.links.next || false;
          collection.push(...(this.documentData(doc) || []));
          return Promise.resolve(collection);
        });
      };
      const advance = () => {
        if (link && !inFlight.has(link)) {
          collectionRequests.push(doRequest(link));
        }
        if (!collection.length && collectionRequests.length) {
          return collectionRequests.shift();
        } else {
          return Promise.resolve(collection);
        }
      };

      var count = 0;
      const cursor = (function*() {
        while (collection.length || inFlight.size || link) {
          yield advance().then(view => {
            const resource = view.shift();
            return resource || null;
          });
        }
      })();

      return {
        forEach: function(g) {
          return new Promise((resolve, reject) => {
            const f = next => {
              if (next) {
                next
                  .then(resource => {
                    count++;
                    if (resource) g(resource);
                    f(max === -1 || count < max ? cursor.next().value : false);
                  })
                  .catch(reject);
              } else {
                const addMore = (many = -1) => {
                  return many === -1 ? (max = -1) : (max += many);
                };
                resolve(
                  collection.length || inFlight.size || link ? addMore : false,
                );
              }
            };
            f(max === -1 || count < max ? cursor.next().value : false);
          });
        },
      };
    });
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
