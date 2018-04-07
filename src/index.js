import Filter from './lib/filters.js';

export default class JuissyClient {
  constructor(
    baseUrl,
    {
      logger = console,
      authorization = null,
      enableExperimentalRouteResolver = false,
    } = {},
  ) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.authorization = authorization;
    this.links = this.fetchLinks();
    this.cache = {};
    if (enableExperimentalRouteResolver) {
      this.enableExperimentalRouteResolver();
    }
  }

  async get(type, id) {
    const link = `${await this.getLink(type)}/${id}`;
    return this.documentData(await this.fetchDocument(link));
  }

  async findAll(
    type,
    {
      limit = -1,
      sort = '',
      filter = '',
      attributes = null,
      relationships = {},
    } = {},
  ) {
    let link = await this.collectionLink(type, {
      sort,
      filter,
      attributes,
      page: limit === -1 || limit > 50 ? '' : `page[limit]=${limit}`,
    });
    let expanded = this.expandRelationships(relationships);
    return this.paginate(link, limit, expanded);
  }

  expandRelationships(relationships) {
    const expander = node => {
      return typeof node === 'string' ? { field: node } : node;
    };
    const objectMapper = (node, mapper, initial) => {
      return Object.getOwnPropertyNames(node).reduce((mapped, prop) => {
        mapped[prop] = mapper(node[prop]);
        if (node[prop].relationships) {
          mapped[prop].relationships = objectMapper(
            node[prop].relationships,
            mapper,
            {},
          );
        }
        return mapped;
      }, {});
    };
    return objectMapper(relationships, expander, {});
  }

  paginate(link, limit, relationships) {
    var buffer = [];
    var total = 0;
    const inFlight = new Set([]);

    const headers = {};
    if (relationships) {
      const paths = [];
      paths.push(`.links.next`);
      const addPaths = relationships => {
        Object.getOwnPropertyNames(relationships).forEach(name => {
          paths.push(
            `.data.[].relationships.${relationships[name].field}.links.related`,
          );
          if (relationships[name].anticipate) {
            Object.getOwnPropertyNames(relationships[name].anticipate).forEach(
              key => {
                paths.push(relationships[name].anticipate[key]);
              },
            );
          }
          if (relationships[name].relationships) {
            addPaths(relationships[name].relationships);
          }
        });
      };
      addPaths(relationships);
      if (paths.length) {
        headers['x-push-please'] = paths.join('; ');
      }
    }

    const doRequest = nextLink => {
      inFlight.add(nextLink);
      return this.fetchDocument(nextLink, headers).then(doc => {
        inFlight.delete(nextLink);
        link = doc.links.next || false;
        const data = this.documentData(doc);
        const resources = Array.isArray(data) ? data : [data];
        total += resources ? resources.length : 0;
        buffer.push(...(resources || []));
        return Promise.resolve(buffer);
      });
    };

    var collectionRequests = [];
    const advance = () => {
      if (link && !inFlight.has(link) && (limit === -1 || total < limit)) {
        collectionRequests.push(doRequest(link));
      }
      return !buffer.length && collectionRequests.length
        ? collectionRequests.shift().then(() => buffer)
        : Promise.resolve(buffer);
    };

    let count = 0;
    const cursor = (function*() {
      while (buffer.length || inFlight.size || link) {
        yield limit === -1 || count < limit
          ? advance().then(buffer => {
              count++;
              const resource = buffer.shift();
              return resource || null;
            })
          : false;
      }
    })();
    cursor.canContinue = () => buffer.length || inFlight.size || link;
    cursor.addMore = (many = -1) =>
      many === -1 ? (limit = -1) : (limit += many);

    if (link && !inFlight.has(link) && (limit === -1 || total < limit)) {
      collectionRequests.push(doRequest(link));
    }

    return this.toConsumer(cursor, relationships);
  }

  toConsumer(cursor, relationships = null) {
    const self = this;
    return {
      consume: function(consumer, preserveOrder = false) {
        const queue = [];
        const queuedConsumer = (resource, relationships) => {
          queue.push(
            preserveOrder
              ? () => {
                  return relationships
                    ? consumer(resource, relationships)
                    : consumer(resource);
                }
              : relationships
                ? consumer(resource, relationships)
                : consumer(resource),
          );
        };
        const decoratedConsumer = self.decorateWithRelationships(
          queuedConsumer,
          relationships,
        );
        return new Promise((resolve, reject) => {
          const f = next => {
            if (next) {
              // @note: using async/await for this 'then' caused browser crashes.
              next
                .then(resource => {
                  if (resource) decoratedConsumer(resource);
                  f(cursor.next().value);
                })
                .catch(reject);
            } else {
              Promise.all(queue)
                .then(() => {
                  resolve(cursor.canContinue() ? cursor.addMore : false);
                })
                .catch(reject);
            }
          };
          f(cursor.next().value);
        }).then(next => {
          return new Promise(async (resolve, reject) => {
            if (preserveOrder) {
              while (queue.length) {
                let fn = queue.shift();
                let ret = fn();
                if (ret instanceof Promise) {
                  await ret.catch(reject);
                }
              }
            }
            resolve(next);
          });
        });
      },
    };
  }

  debugger() {
    return error => {
      // @todo: this should actually check for errors.jsonapi
      if (error.errors) {
        const logError = error => {
          this.logger.info(
            `${error.title}: ${error.detail}. %s`,
            error.links.info,
          );
        };
        error.errors.forEach(logError);
      } else {
        //this.logger.log(error);
      }
    };
  }

  decorateWithRelationships(consumer, relationships = null) {
    const decorated = !relationships
      ? consumer
      : resource => {
          const mirror = {};
          Object.getOwnPropertyNames(relationships).forEach(relationship => {
            const target = relationships[relationship];
            let path = [],
              link;
            mirror[relationship] = (link = extractValue(
              `relationships.${target.field}.links.related`,
              resource,
            ))
              ? this.paginate(
                  link,
                  target.limit || -1,
                  target.relationships || null,
                )
              : Promise.reject();
          });
          return consumer(resource, mirror);
        };
    return decorated;
  }

  fetchDocument(url, headers = {}, overrides = {}) {
    const options = Object.assign(
      {
        headers: new Headers(
          Object.assign(
            {
              accept: 'application/vnd.api+json',
            },
            headers,
          ),
        ),
        credentials: 'include',
      },
      overrides,
    );
    if (this.authorization) {
      options.headers.set('authorization', this.authorization);
    }
    return fetch(url, options).then(res => {
      if (res.ok) {
        return res.json();
      } else {
        return new Promise(async (_, reject) => {
          reject(
            await res.json().catch(() => {
              reject(res.statusText);
            }),
          );
        });
      }
    });
  }

  documentData(doc) {
    if (doc.hasOwnProperty('data')) {
      return doc.data;
    }
    if (doc.hasOwnProperty('errors')) {
      throw new Error(doc);
    } else {
      throw new Error(
        'The server returned an unprocessable document with no data or errors.',
      );
    }
  }

  getLink(type, options = {}) {
    return this.links.then(links => {
      if (!links.hasOwnProperty(type)) {
        Promise.reject(`'${type}' is not a valid type for ${this.baseUrl}.`);
      }
      return links[type];
    });
  }

  fetchLinks() {
    return this.fetchDocument(`${this.baseUrl}/jsonapi`)
      .then(doc => doc.links)
      .catch(this.debugger());
  }

  filter(f) {
    return new Filter(f);
  }

  async collectionLink(type, { sort, filter, page, attributes } = {}) {
    let query = '';
    query += filter.length ? `?${filter}` : '';
    query += sort.length ? `${query.length ? '&' : '?'}sort=${sort}` : '';
    query += attributes
      ? `${query.length ? '&' : '?'}fields[${type}]=${attributes.join(',')}`
      : '';
    query += page.length ? `${query.length ? '&' : '?'}${page}` : '';
    return `${await this.getLink(
      type /*, headers, {credentials: 'include'}*/,
    )}${query}`;
  }

  enableExperimentalRouteResolver(enable = true) {
    this.resolve = enable
      ? async path => {
          try {
            const headers = {
              'x-push-please': '.jsonapi.individual',
              accept: 'application/json',
            };
            const resolution = await this.fetchDocument(
              `${this.baseUrl}/router/translate-path?path=${path}&_format=json`,
              headers,
            );
            return this.get(
              resolution.jsonapi.resourceName,
              resolution.entity.uuid,
            );
          } catch (resolution) {
            throw new Error(resolution.message);
          }
        }
      : undefined;
  }
}

function extractValue(path, obj) {
  return path
    .split('.')
    .reduce(
      (exists, part) =>
        exists && exists.hasOwnProperty(part) ? exists[part] : false,
      obj,
    );
}
