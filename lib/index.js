/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__lib__ = __webpack_require__(1);


if ('serviceWorker' in navigator) {
  // Register a service worker hosted at the root of the
  // site using the default scope.
  navigator.serviceWorker.register('/src/sw.js').then(function (registration) {
    console.log('Service worker registration succeeded:', registration);
  }).catch(function (error) {
    console.log('Service worker registration failed:', error);
  });
} else {
  console.log('Service workers are not supported.');
}

const client = new __WEBPACK_IMPORTED_MODULE_0__lib__["a" /* default */]('https://blog.test', {//authorization: `Basic ${btoa('root:root')}`,
});
client.all('node--post').then(consumer => {
  consumer.consume(console.log);
}).catch(client.debugger()); //(async () => {
//  const options = {
//    limit: 5,
//    sort: '-title',
//    relationships: {
//      image: {
//        field: 'field_image',
//        anticipate: {
//          file: '.data.attributes.url',
//        },
//      },
//      tags: {
//        field: 'field_tags',
//        relationships: {
//          vocabulary: 'vid',
//        },
//      },
//    },
//  };
//  (await client.all('node--recipe', options)).consume(
//    logRecipe('Initial'),
//    true,
//  );
//})();
//options.filter = filter.compile({paramOne: 'easy'});

const filter = client.filter((c, param) => {
  return c.and(c('status', 1), c.or(c.contains('title', param('paramOne')), c.startsWith('title', 'Thai')));
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
  images.forEach(src => img.src = src);
  li.appendChild(img);
  li.appendChild(document.createTextNode(recipe.attributes.title));
  ul.appendChild(li);
}; //client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(console.log)
//  .catch(error => console.log('Error:', error));

/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__filters_js__ = __webpack_require__(2);

class DrupalClient {
  constructor(baseUrl, {
    logger = console,
    authorization = null
  } = {}) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.authorization = authorization;
    this.links = Promise.resolve({
      'node--post': '/jsonapi/node/post'
    });
    this.cache = {};
  }

  async get(type, id) {
    const link = `${await this.getLink(type)}/${id}`;
    return this.documentData((await this.fetchDocument(link)));
  }

  async all(type, {
    limit = -1,
    sort = '',
    filter = '',
    relationships = {}
  } = {}) {
    let link = await this.collectionLink(type, {
      sort,
      filter,
      page: 'page[limit]=50'
    });
    let expanded = this.expandRelationships(relationships);
    return this.paginate(link, limit, expanded);
  }

  expandRelationships(relationships) {
    const expander = node => {
      return typeof node === 'string' ? {
        field: node
      } : node;
    };

    const objectMapper = (node, mapper, initial) => {
      return Object.getOwnPropertyNames(node).reduce((mapped, prop) => {
        mapped[prop] = mapper(node[prop]);

        if (node[prop].relationships) {
          mapped[prop].relationships = objectMapper(node[prop].relationships, mapper, {});
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
          paths.push(`.data.[].relationships.${relationships[name].field}.links.related`);

          if (relationships[name].anticipate) {
            Object.getOwnPropertyNames(relationships[name].anticipate).forEach(key => {
              paths.push(relationships[name].anticipate[key]);
            });
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

      return !buffer.length && collectionRequests.length ? collectionRequests.shift().then(() => buffer) : Promise.resolve(buffer);
    };

    let count = 0;

    const cursor = function* () {
      while (buffer.length || inFlight.size || link) {
        yield limit === -1 || count < limit ? advance().then(buffer => {
          count++;
          const resource = buffer.shift();
          return resource || null;
        }) : false;
      }
    }();

    cursor.canContinue = () => buffer.length || inFlight.size || link;

    cursor.addMore = (many = -1) => many === -1 ? limit = -1 : limit += many;

    if (link && !inFlight.has(link) && (limit === -1 || total < limit)) {
      collectionRequests.push(doRequest(link));
    }

    return this.toConsumer(cursor, relationships);
  }

  toConsumer(cursor, relationships = null) {
    const self = this;
    return {
      consume: function consume(consumer, preserveOrder = false) {
        const queue = [];

        const queuedConsumer = (resource, relationships) => {
          queue.push(preserveOrder ? () => {
            return relationships ? consumer(resource, relationships) : consumer(resource);
          } : relationships ? consumer(resource, relationships) : consumer(resource));
        };

        const decoratedConsumer = self.decorateWithRelationships(queuedConsumer, relationships);
        return new Promise((resolve, reject) => {
          const f = next => {
            if (next) {
              // @note: using async/await for this 'then' caused browser crashes.
              next.then(resource => {
                if (resource) decoratedConsumer(resource);
                f(cursor.next().value);
              }).catch(reject);
            } else {
              Promise.all(queue).then(() => {
                resolve(cursor.canContinue() ? cursor.addMore : false);
              }).catch(reject);
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
      }
    };
  }

  debugger() {
    return error => {
      // @todo: this should actually check for errors.jsonapi
      if (error.errors) {
        const logError = error => {
          this.logger.info(`${error.title}: ${error.detail}. %s`, error.links.info);
        };

        error.errors.forEach(logError);
      } else {//this.logger.log(error);
      }
    };
  }

  decorateWithRelationships(consumer, relationships = null) {
    const decorated = !relationships ? consumer : resource => {
      const mirror = {};
      Object.getOwnPropertyNames(relationships).forEach(relationship => {
        const target = relationships[relationship];
        let path = [],
            link;
        mirror[relationship] = (link = extractValue(`relationships.${target.field}.links.related`, resource)) ? this.paginate(link, target.limit || -1, target.relationships || null) : Promise.reject();
      });
      return consumer(resource, mirror);
    };
    return decorated;
  }

  fetchDocument(url, headers = {}, overrides = {}) {
    const options = Object.assign({
      headers: new Headers(Object.assign({
        accept: 'application/vnd.api+json'
      }, headers)),
      credentials: 'include'
    }, overrides);

    if (this.authorization) {
      options.headers.set('authorization', this.authorization);
    }

    return fetch(url, options).then(res => {
      if (res.ok) {
        return res.json();
      } else {
        return new Promise(async (_, reject) => {
          reject((await res.json().catch(() => {
            reject(res.statusText);
          })));
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
      throw new Error('The server returned an unprocessable document with no data or errors.');
    }
  }

  getLink(type, headers = {}, options = {}) {
    return this.links.then(links => {
      if (!links.hasOwnProperty(type)) {
        Promise.reject(`'${type}' is not a valid type for ${this.baseUrl}.`);
      }

      return this.baseUrl + links[type];
    });
  }

  filter(f) {
    return new __WEBPACK_IMPORTED_MODULE_0__filters_js__["a" /* default */](f);
  }

  async collectionLink(type, {
    sort,
    filter,
    page
  } = {}) {
    let query = '';
    query += filter.length ? `?${filter}` : '';
    query += sort.length ? `${query.length ? '&' : '?'}sort=${sort}` : '';
    query += page.length ? `${query.length ? '&' : '?'}${page}` : '';
    return `${await this.getLink(type
    /*, headers, {credentials: 'include'}*/
    )}${query}`;
  }

}
/* harmony export (immutable) */ __webpack_exports__["a"] = DrupalClient;


function extractValue(path, obj) {
  return path.split('.').reduce((exists, part) => exists && exists.hasOwnProperty(part) ? exists[part] : false, obj);
}

/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
class Filter {
  constructor(f) {
    this.conditions = f(Conditions, key => parameters => parameters[key]);
  }

  compile(parameters) {
    const id = function* () {
      let counter = 1;

      while (true) {
        yield counter++;
      }
    }();

    const compiler = (acc, item, _, parentID = null) => {
      const currentID = id.next().value;
      const prefix = acc.length ? `${acc}&` : '';

      if (item.members) {
        const root = `filter[${currentID}][group]`;
        const self = parentID ? `${root}[conjunction]=${item.conjunction}&${root}[memberOf]=${parentID}` : `${root}[conjunction]=${item.conjunction}`;
        return `${prefix}${item.members.reduce((acc, item, _) => compiler(acc, item, _, currentID), self)}`;
      } else {
        const root = `filter[${currentID}][condition]`;
        const processed = Conditions.process(item, parameters);
        let self = '';
        self += `${root}[path]=${encodeURIComponent(processed.path)}`;

        if (Conditions.unaryOperators.has(processed.operator)) {
          self += `&${root}[value]=${encodeURIComponent(processed.value)}`;
        } else if (!Conditions.nullOperators.has(processed.operator)) {
          processed.value.forEach(item => {
            self += `&${root}[value][]=${encodeURIComponent(item)}`;
          });
        }

        self += `&${root}[operator]=${encodeURIComponent(processed.operator)}`;
        return parentID ? `${prefix}${self}&${root}[memberOf]=${parentID}` : `${prefix}${self}`;
      }
    };

    return compiler('', this.conditions);
  }

}
/* harmony export (immutable) */ __webpack_exports__["a"] = Filter;

const Groups = {
  and: (...members) => {
    return Groups.group(members, 'AND');
  },
  or: (...members) => {
    return Groups.group(members, 'OR');
  },
  group: (members, conjunction) => {
    return {
      conjunction,
      members
    };
  }
};

const Conditions = function Conditions(path, value) {
  return Conditions.eq(path, value);
};

Conditions.and = Groups.and;
Conditions.or = Groups.or;

Conditions.eq = (path, value) => {
  return Conditions.condition(path, value, '=');
};

Conditions.notEq = (path, value) => {
  return Conditions.condition(path, value, '<>');
};

Conditions.gt = (path, value) => {
  return Conditions.condition(path, value, '>');
};

Conditions.gtEq = (path, value) => {
  return Conditions.condition(path, value, '>=');
};

Conditions.lt = (path, value) => {
  return Conditions.condition(path, value, '<');
};

Conditions.ltEq = (path, value) => {
  return Conditions.condition(path, value, '<=');
};

Conditions.startsWith = (path, value) => {
  return Conditions.condition(path, value, 'STARTS_WITH');
};

Conditions.contains = (path, value) => {
  return Conditions.condition(path, value, 'CONTAINS');
};

Conditions.endsWith = (path, value) => {
  return Conditions.condition(path, value, 'ENDS_WITH');
};

Conditions.in = (path, value) => {
  return Conditions.condition(path, value, 'IN');
};

Conditions.notIn = (path, value) => {
  return Conditions.condition(path, value, 'NOT IN');
};

Conditions.between = (path, value) => {
  return Conditions.condition(path, value, 'BETWEEN');
};

Conditions.notBetween = (path, value) => {
  return Conditions.condition(path, value, 'NOT BETWEEN');
};

Conditions.null = path => {
  return Conditions.condition(path, undefined, 'IS NULL');
};

Conditions.notNull = path => {
  return Conditions.condition(path, undefined, 'IS NOT NULL');
};

Conditions.condition = (path, value, operator) => {
  return Conditions.validate({
    path,
    value,
    operator
  });
};

Conditions.unaryOperators = new Set(['=', '<>', '>', '>=', '<', '<=', 'STARTS_WITH', 'CONTAINS', 'ENDS_WITH']);
Conditions.unaryValueTypes = new Set(['string', 'boolean', 'number']);
Conditions.binaryOperators = new Set(['BETWEEN', 'NOT BETWEEN']);
Conditions.stringOperators = new Set(['STARTS_WITH', 'CONTAINS', 'ENDS_WITH']);
Conditions.nullOperators = new Set(['IS NULL', 'IS NOT NULL']);

Conditions.validate = condition => {
  if (condition.operator instanceof Function || condition.value instanceof Function) {
    return condition;
  }

  if (Conditions.nullOperators.has(condition.operator)) {
    if (typeof condition.value !== 'undefined') {
      throw new Error(`Conditions with an '${condition.operator}' operator must not specify a value.`);
    }
  } else if (Conditions.unaryOperators.has(condition.operator)) {
    if (!Conditions.unaryValueTypes.has(typeof condition.value)) {
      throw new Error(`The '${condition.operator}' operator requires a single value.`);
    }

    if (Conditions.stringOperators.has(condition.operator) && typeof condition.value != 'string') {
      throw new Error(`The '${condition.operator}' operator requires that the condition value be a string.`);
    }
  } else {
    if (!Array.isArray(condition.value)) {
      throw new Error(`The '${condition.operator}' operator requires an array of values.`);
    }

    if (Conditions.binaryOperators.has(condition.operator) && condition.value.length !== 2) {
      throw new Error(`The '${condition.operator}' operator requires an array of exactly 2 values.`);
    }
  }

  return condition;
};

Conditions.process = (condition, parameters) => {
  let revalidate = false;

  const replace = item => {
    if (item instanceof Function) {
      revalidate = true;
      return item(parameters);
    }

    return item;
  };

  const processed = {
    path: replace(condition.path),
    operator: replace(condition.operator)
  };

  if (!Conditions.nullOperators.has(processed.operator)) {
    processed.value = replace(condition.value);
  }

  if (revalidate) {
    Conditions.validate(processed);
  }

  return processed;
};

/***/ })
/******/ ]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgNWExZTFlZGM2NmNmOTUyMTRhNTQiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbIm5hdmlnYXRvciIsInNlcnZpY2VXb3JrZXIiLCJyZWdpc3RlciIsInRoZW4iLCJyZWdpc3RyYXRpb24iLCJjb25zb2xlIiwibG9nIiwiY2F0Y2giLCJlcnJvciIsImNsaWVudCIsImFsbCIsImNvbnN1bWVyIiwiY29uc3VtZSIsImRlYnVnZ2VyIiwiZmlsdGVyIiwiYyIsInBhcmFtIiwiYW5kIiwib3IiLCJjb250YWlucyIsInN0YXJ0c1dpdGgiLCJsb2dSZWNpcGUiLCJsYWJlbCIsInJlY2lwZSIsInJlbGF0aW9uc2hpcHMiLCJ0YWdzIiwidm9jYWJzIiwiaW1hZ2VzIiwiaW1hZ2UiLCJwdXNoIiwiYXR0cmlidXRlcyIsInVybCIsInRhZyIsIm5hbWUiLCJ2b2NhYnVsYXJ5Iiwidm9jYWIiLCJ1bCIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJsaSIsImNyZWF0ZUVsZW1lbnQiLCJpbWciLCJmb3JFYWNoIiwic3JjIiwiYXBwZW5kQ2hpbGQiLCJjcmVhdGVUZXh0Tm9kZSIsInRpdGxlIiwiRHJ1cGFsQ2xpZW50IiwiY29uc3RydWN0b3IiLCJiYXNlVXJsIiwibG9nZ2VyIiwiYXV0aG9yaXphdGlvbiIsImxpbmtzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJjYWNoZSIsImdldCIsInR5cGUiLCJpZCIsImxpbmsiLCJnZXRMaW5rIiwiZG9jdW1lbnREYXRhIiwiZmV0Y2hEb2N1bWVudCIsImxpbWl0Iiwic29ydCIsImNvbGxlY3Rpb25MaW5rIiwicGFnZSIsImV4cGFuZGVkIiwiZXhwYW5kUmVsYXRpb25zaGlwcyIsInBhZ2luYXRlIiwiZXhwYW5kZXIiLCJub2RlIiwiZmllbGQiLCJvYmplY3RNYXBwZXIiLCJtYXBwZXIiLCJpbml0aWFsIiwiT2JqZWN0IiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsInJlZHVjZSIsIm1hcHBlZCIsInByb3AiLCJidWZmZXIiLCJ0b3RhbCIsImluRmxpZ2h0IiwiU2V0IiwiaGVhZGVycyIsInBhdGhzIiwiYWRkUGF0aHMiLCJhbnRpY2lwYXRlIiwia2V5IiwibGVuZ3RoIiwiam9pbiIsImRvUmVxdWVzdCIsIm5leHRMaW5rIiwiYWRkIiwiZG9jIiwiZGVsZXRlIiwibmV4dCIsImRhdGEiLCJyZXNvdXJjZXMiLCJBcnJheSIsImlzQXJyYXkiLCJjb2xsZWN0aW9uUmVxdWVzdHMiLCJhZHZhbmNlIiwiaGFzIiwic2hpZnQiLCJjb3VudCIsImN1cnNvciIsInNpemUiLCJyZXNvdXJjZSIsImNhbkNvbnRpbnVlIiwiYWRkTW9yZSIsIm1hbnkiLCJ0b0NvbnN1bWVyIiwic2VsZiIsInByZXNlcnZlT3JkZXIiLCJxdWV1ZSIsInF1ZXVlZENvbnN1bWVyIiwiZGVjb3JhdGVkQ29uc3VtZXIiLCJkZWNvcmF0ZVdpdGhSZWxhdGlvbnNoaXBzIiwicmVqZWN0IiwiZiIsInZhbHVlIiwiZm4iLCJyZXQiLCJlcnJvcnMiLCJsb2dFcnJvciIsImluZm8iLCJkZXRhaWwiLCJkZWNvcmF0ZWQiLCJtaXJyb3IiLCJyZWxhdGlvbnNoaXAiLCJ0YXJnZXQiLCJwYXRoIiwiZXh0cmFjdFZhbHVlIiwib3ZlcnJpZGVzIiwib3B0aW9ucyIsImFzc2lnbiIsIkhlYWRlcnMiLCJhY2NlcHQiLCJjcmVkZW50aWFscyIsInNldCIsImZldGNoIiwicmVzIiwib2siLCJqc29uIiwiXyIsInN0YXR1c1RleHQiLCJoYXNPd25Qcm9wZXJ0eSIsIkVycm9yIiwicXVlcnkiLCJvYmoiLCJzcGxpdCIsImV4aXN0cyIsInBhcnQiLCJGaWx0ZXIiLCJjb25kaXRpb25zIiwiQ29uZGl0aW9ucyIsInBhcmFtZXRlcnMiLCJjb21waWxlIiwiY291bnRlciIsImNvbXBpbGVyIiwiYWNjIiwiaXRlbSIsInBhcmVudElEIiwiY3VycmVudElEIiwicHJlZml4IiwibWVtYmVycyIsInJvb3QiLCJjb25qdW5jdGlvbiIsInByb2Nlc3NlZCIsInByb2Nlc3MiLCJlbmNvZGVVUklDb21wb25lbnQiLCJ1bmFyeU9wZXJhdG9ycyIsIm9wZXJhdG9yIiwibnVsbE9wZXJhdG9ycyIsIkdyb3VwcyIsImdyb3VwIiwiZXEiLCJjb25kaXRpb24iLCJub3RFcSIsImd0IiwiZ3RFcSIsImx0IiwibHRFcSIsImVuZHNXaXRoIiwiaW4iLCJub3RJbiIsImJldHdlZW4iLCJub3RCZXR3ZWVuIiwibnVsbCIsInVuZGVmaW5lZCIsIm5vdE51bGwiLCJ2YWxpZGF0ZSIsInVuYXJ5VmFsdWVUeXBlcyIsImJpbmFyeU9wZXJhdG9ycyIsInN0cmluZ09wZXJhdG9ycyIsIkZ1bmN0aW9uIiwicmV2YWxpZGF0ZSIsInJlcGxhY2UiXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsbUNBQTJCLDBCQUEwQixFQUFFO0FBQ3ZELHlDQUFpQyxlQUFlO0FBQ2hEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDhEQUFzRCwrREFBK0Q7O0FBRXJIO0FBQ0E7O0FBRUE7QUFDQTs7Ozs7Ozs7OztBQzdEQTs7QUFFQSxJQUFJLG1CQUFtQkEsU0FBdkIsRUFBa0M7QUFDaEM7QUFDQTtBQUNBQSxZQUFVQyxhQUFWLENBQXdCQyxRQUF4QixDQUFpQyxZQUFqQyxFQUErQ0MsSUFBL0MsQ0FBb0QsVUFBU0MsWUFBVCxFQUF1QjtBQUN6RUMsWUFBUUMsR0FBUixDQUFZLHdDQUFaLEVBQXNERixZQUF0RDtBQUNE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QUl3QyxhQUFhLEtBQWpCOztBQUNBLFFBQU1DLFVBQVVwQyxRQUFRO0FBQ3RCLFFBQUlBLGdCQUFnQmtDLFFBQXBCLEVBQThCO0FBQzVCQyxtQkFBYSxJQUFiO0FBQ0EsYUFBT25DLEtBQUtMLFVBQUwsQ0FBUDtBQUNEOztBQUNELFdBQU9LLElBQVA7QUFDRCxHQU5EOztBQU9BLFFBQU1PLFlBQVk7QUFDaEJyQyxVQUFNa0UsUUFBUXBCLFVBQVU5QyxJQUFsQixDQURVO0FBRWhCeUMsY0FBVXlCLFFBQVFwQixVQUFVTCxRQUFsQjtBQUZNLEdBQWxCOztBQUlBLE1BQUksQ0FBQ2pCLFdBQVdrQixhQUFYLENBQXlCdkUsR0FBekIsQ0FBNkJrRSxVQUFVSSxRQUF2QyxDQUFMLEVBQXVEO0FBQ3JESixjQUFVaEQsS0FBVixHQUFrQjZFLFFBQVFwQixVQUFVekQsS0FBbEIsQ0FBbEI7QUFDRDs7QUFDRCxNQUFJNEUsVUFBSixFQUFnQjtBQUNkekMsZUFBV29DLFFBQVgsQ0FBb0J2QixTQUFwQjtBQUNEOztBQUNELFNBQU9BLFNBQVA7QUFDRCxDQXBCRCxDIiwiZmlsZSI6ImluZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiIFx0Ly8gVGhlIG1vZHVsZSBjYWNoZVxuIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcblxuIFx0Ly8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbiBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblxuIFx0XHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcbiBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pIHtcbiBcdFx0XHRyZXR1cm4gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0uZXhwb3J0cztcbiBcdFx0fVxuIFx0XHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuIFx0XHR2YXIgbW9kdWxlID0gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0gPSB7XG4gXHRcdFx0aTogbW9kdWxlSWQsXG4gXHRcdFx0bDogZmFsc2UsXG4gXHRcdFx0ZXhwb3J0czoge31cbiBcdFx0fTtcblxuIFx0XHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cbiBcdFx0bW9kdWxlc1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cbiBcdFx0Ly8gRmxhZyB0aGUgbW9kdWxlIGFzIGxvYWRlZFxuIFx0XHRtb2R1bGUubCA9IHRydWU7XG5cbiBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbiBcdFx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xuIFx0fVxuXG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcblxuIFx0Ly8gZGVmaW5lIGdldHRlciBmdW5jdGlvbiBmb3IgaGFybW9ueSBleHBvcnRzXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSBmdW5jdGlvbihleHBvcnRzLCBuYW1lLCBnZXR0ZXIpIHtcbiBcdFx0aWYoIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBuYW1lKSkge1xuIFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBuYW1lLCB7XG4gXHRcdFx0XHRjb25maWd1cmFibGU6IGZhbHNlLFxuIFx0XHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcbiBcdFx0XHRcdGdldDogZ2V0dGVyXG4gXHRcdFx0fSk7XG4gXHRcdH1cbiBcdH07XG5cbiBcdC8vIGdldERlZmF1bHRFeHBvcnQgZnVuY3Rpb24gZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBub24taGFybW9ueSBtb2R1bGVzXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm4gPSBmdW5jdGlvbihtb2R1bGUpIHtcbiBcdFx0dmFyIGdldHRlciA9IG1vZHVsZSAmJiBtb2R1bGUuX19lc01vZHVsZSA/XG4gXHRcdFx0ZnVuY3Rpb24gZ2V0RGVmYXVsdCgpIHsgcmV0dXJuIG1vZHVsZVsnZGVmYXVsdCddOyB9IDpcbiBcdFx0XHRmdW5jdGlvbiBnZXRNb2R1bGVFeHBvcnRzKCkgeyByZXR1cm4gbW9kdWxlOyB9O1xuIFx0XHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQoZ2V0dGVyLCAnYScsIGdldHRlcik7XG4gXHRcdHJldHVybiBnZXR0ZXI7XG4gXHR9O1xuXG4gXHQvLyBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGxcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubyA9IGZ1bmN0aW9uKG9iamVjdCwgcHJvcGVydHkpIHsgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIHByb3BlcnR5KTsgfTtcblxuIFx0Ly8gX193ZWJwYWNrX3B1YmxpY19wYXRoX19cbiBcdF9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiXCI7XG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oX193ZWJwYWNrX3JlcXVpcmVfXy5zID0gMCk7XG5cblxuXG4vLyBXRUJQQUNLIEZPT1RFUiAvL1xuLy8gd2VicGFjay9ib290c3RyYXAgNWExZTFlZGM2NmNmOTUyMTRhNTQiLCJpbXBvcnQgRENsaWVudCBmcm9tICcuL2xpYic7XG5cbmlmICgnc2VydmljZVdvcmtlcicgaW4gbmF2aWdhdG9yKSB7XG4gIC8vIFJlZ2lzdGVyIGEgc2VydmljZSB3b3JrZXIgaG9zdGVkIGF0IHRoZSByb290IG9mIHRoZVxuICAvLyBzaXRlIHVzaW5nIHRoZSBkZWZhdWx0IHNjb3BlLlxuICBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWdpc3RlcignL3NyYy9zdy5qcycpLnRoZW4oZnVuY3Rpb24ocmVnaXN0cmF0aW9uKSB7XG4gICAgY29uc29sZS5sb2coJ1NlcnZpY2Ugd29ya2VyIHJlZ2lzdHJhdGlvbiBzdWNjZWVkZWQ6JywgcmVnaXN0cmF0aW9uKTtcbiAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyb3IpIHtcbiAgICBjb25zb2xlLmxvZygnU2VydmljZSB3b3JrZXIgcmVnaXN0cmF0aW9uIGZhaWxlZDonLCBlcnJvcik7XG4gIH0pO1xufSBlbHNlIHtcbiAgY29uc29sZS5sb2coJ1NlcnZpY2Ugd29ya2VycyBhcmUgbm90IHN1cHBvcnRlZC4nKTtcbn1cblxuY29uc3QgY2xpZW50ID0gbmV3IERDbGllbnQoJ2h0dHBzOi8vYmxvZy50ZXN0Jywge1xuICAvL2F1dGhvcml6YXRpb246IGBCYXNpYyAke2J0b2EoJ3Jvb3Q6cm9vdCcpfWAsXG59KTtcblxuY2xpZW50LmFsbCgnbm9kZS0tcG9zdCcpLnRoZW4oY29uc3VtZXIgPT4ge1xuICBjb25zdW1lci5jb25zdW1lKGNvbnNvbGUubG9nKTtcbn0pLmNhdGNoKGNsaWVudC5kZWJ1Z2dlcigpKTtcblxuLy8oYXN5bmMgKCkgPT4ge1xuLy8gIGNvbnN0IG9wdGlvbnMgPSB7XG4vLyAgICBsaW1pdDogNSxcbi8vICAgIHNvcnQ6ICctdGl0bGUnLFxuLy8gICAgcmVsYXRpb25zaGlwczoge1xuLy8gICAgICBpbWFnZToge1xuLy8gICAgICAgIGZpZWxkOiAnZmllbGRfaW1hZ2UnLFxuLy8gICAgICAgIGFudGljaXBhdGU6IHtcbi8vICAgICAgICAgIGZpbGU6ICcuZGF0YS5hdHRyaWJ1dGVzLnVybCcsXG4vLyAgICAgICAgfSxcbi8vICAgICAgfSxcbi8vICAgICAgdGFnczoge1xuLy8gICAgICAgIGZpZWxkOiAnZmllbGRfdGFncycsXG4vLyAgICAgICAgcmVsYXRpb25zaGlwczoge1xuLy8gICAgICAgICAgdm9jYWJ1bGFyeTogJ3ZpZCcsXG4vLyAgICAgICAgfSxcbi8vICAgICAgfSxcbi8vICAgIH0sXG4vLyAgfTtcbi8vICAoYXdhaXQgY2xpZW50LmFsbCgnbm9kZS0tcmVjaXBlJywgb3B0aW9ucykpLmNvbnN1bWUoXG4vLyAgICBsb2dSZWNpcGUoJ0luaXRpYWwnKSxcbi8vICAgIHRydWUsXG4vLyAgKTtcbi8vfSkoKTtcblxuLy9vcHRpb25zLmZpbHRlciA9IGZpbHRlci5jb21waWxlKHtwYXJhbU9uZTogJ2Vhc3knfSk7XG5jb25zdCBmaWx0ZXIgPSBjbGllbnQuZmlsdGVyKChjLCBwYXJhbSkgPT4ge1xuICByZXR1cm4gYy5hbmQoXG4gICAgYygnc3RhdHVzJywgMSksXG4gICAgYy5vcihjLmNvbnRhaW5zKCd0aXRsZScsIHBhcmFtKCdwYXJhbU9uZScpKSwgYy5zdGFydHNXaXRoKCd0aXRsZScsICdUaGFpJykpLFxuICApO1xufSk7XG5cbmNvbnN0IGxvZ1JlY2lwZSA9IGxhYmVsID0+IGFzeW5jIChyZWNpcGUsIHJlbGF0aW9uc2hpcHMpID0+IHtcbiAgbGV0IHRhZ3MgPSBbXTtcbiAgbGV0IHZvY2FicyA9IFtdO1xuICBsZXQgaW1hZ2VzID0gW107XG5cbiAgYXdhaXQgcmVsYXRpb25zaGlwcy5pbWFnZS5jb25zdW1lKGFzeW5jIGltYWdlID0+IHtcbiAgICBpbWFnZXMucHVzaChpbWFnZS5hdHRyaWJ1dGVzLnVybCk7XG4gIH0pO1xuXG4gIGF3YWl0IHJlbGF0aW9uc2hpcHMudGFncy5jb25zdW1lKGFzeW5jICh0YWcsIHJlbGF0aW9uc2hpcHMpID0+IHtcbiAgICB0YWdzLnB1c2godGFnLmF0dHJpYnV0ZXMubmFtZSk7XG5cbiAgICBhd2FpdCByZWxhdGlvbnNoaXBzLnZvY2FidWxhcnkuY29uc3VtZSh2b2NhYiA9PiB7XG4gICAgICB2b2NhYnMucHVzaCh2b2NhYi5hdHRyaWJ1dGVzLm5hbWUpO1xuICAgIH0pO1xuICB9KTtcblxuICBjb25zdCB1bCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNpcGVzJyk7XG4gIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgY29uc3QgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XG4gIGltYWdlcy5mb3JFYWNoKHNyYyA9PiAoaW1nLnNyYyA9IHNyYykpO1xuICBsaS5hcHBlbmRDaGlsZChpbWcpO1xuICBsaS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShyZWNpcGUuYXR0cmlidXRlcy50aXRsZSkpO1xuICB1bC5hcHBlbmRDaGlsZChsaSk7XG59O1xuXG4vL2NsaWVudC5nZXQoJ25vZGUtLXJlY2lwZScsICcyNWMwNDhiNi02OWU5LTQ2ZjQtOTg2ZC00YjgwYjAxZGUyZTYnKVxuLy8gIC50aGVuKGNvbnNvbGUubG9nKVxuLy8gIC5jYXRjaChlcnJvciA9PiBjb25zb2xlLmxvZygnRXJyb3I6JywgZXJyb3IpKTtcblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9pbmRleC5qcyIsImltcG9ydCBGaWx0ZXIgZnJvbSAnLi9maWx0ZXJzLmpzJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRHJ1cGFsQ2xpZW50IHtcbiAgY29uc3RydWN0b3IoYmFzZVVybCwgeyBsb2dnZXIgPSBjb25zb2xlLCBhdXRob3JpemF0aW9uID0gbnVsbCB9ID0ge30pIHtcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xuICAgIHRoaXMubG9nZ2VyID0gbG9nZ2VyO1xuICAgIHRoaXMuYXV0aG9yaXphdGlvbiA9IGF1dGhvcml6YXRpb247XG4gICAgdGhpcy5saW5rcyA9IFByb21pc2UucmVzb2x2ZSh7XG4gICAgICAnbm9kZS0tcG9zdCc6ICcvanNvbmFwaS9ub2RlL3Bvc3QnLFxuICAgIH0pO1xuICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgfVxuXG4gIGFzeW5jIGdldCh0eXBlLCBpZCkge1xuICAgIGNvbnN0IGxpbmsgPSBgJHthd2FpdCB0aGlzLmdldExpbmsodHlwZSl9LyR7aWR9YDtcbiAgICByZXR1cm4gdGhpcy5kb2N1bWVudERhdGEoYXdhaXQgdGhpcy5mZXRjaERvY3VtZW50KGxpbmspKTtcbiAgfVxuXG4gIGFzeW5jIGFsbChcbiAgICB0eXBlLFxuICAgIHsgbGltaXQgPSAtMSwgc29ydCA9ICcnLCBmaWx0ZXIgPSAnJywgcmVsYXRpb25zaGlwcyA9IHt9IH0gPSB7fSxcbiAgKSB7XG4gICAgbGV0IGxpbmsgPSBhd2FpdCB0aGlzLmNvbGxlY3Rpb25MaW5rKHR5cGUsIHtcbiAgICAgIHNvcnQsXG4gICAgICBmaWx0ZXIsXG4gICAgICBwYWdlOiAncGFnZVtsaW1pdF09NTAnLFxuICAgIH0pO1xuICAgIGxldCBleHBhbmRlZCA9IHRoaXMuZXhwYW5kUmVsYXRpb25zaGlwcyhyZWxhdGlvbnNoaXBzKTtcbiAgICByZXR1cm4gdGhpcy5wYWdpbmF0ZShsaW5rLCBsaW1pdCwgZXhwYW5kZWQpO1xuICB9XG5cbiAgZXhwYW5kUmVsYXRpb25zaGlwcyhyZWxhdGlvbnNoaXBzKSB7XG4gICAgY29uc3QgZXhwYW5kZXIgPSBub2RlID0+IHtcbiAgICAgIHJldHVybiB0eXBlb2Ygbm9kZSA9PT0gJ3N0cmluZycgPyB7IGZpZWxkOiBub2RlIH0gOiBub2RlO1xuICAgIH07XG4gICAgY29uc3Qgb2JqZWN0TWFwcGVyID0gKG5vZGUsIG1hcHBlciwgaW5pdGlhbCkgPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG5vZGUpLnJlZHVjZSgobWFwcGVkLCBwcm9wKSA9PiB7XG4gICAgICAgIG1hcHBlZFtwcm9wXSA9IG1hcHBlcihub2RlW3Byb3BdKTtcbiAgICAgICAgaWYgKG5vZGVbcHJvcF0ucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgIG1hcHBlZFtwcm9wXS5yZWxhdGlvbnNoaXBzID0gb2JqZWN0TWFwcGVyKFxuICAgICAgICAgICAgbm9kZVtwcm9wXS5yZWxhdGlvbnNoaXBzLFxuICAgICAgICAgICAgbWFwcGVyLFxuICAgICAgICAgICAge30sXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwcGVkO1xuICAgICAgfSwge30pO1xuICAgIH07XG4gICAgcmV0dXJuIG9iamVjdE1hcHBlcihyZWxhdGlvbnNoaXBzLCBleHBhbmRlciwge30pO1xuICB9XG5cbiAgcGFnaW5hdGUobGluaywgbGltaXQsIHJlbGF0aW9uc2hpcHMpIHtcbiAgICB2YXIgYnVmZmVyID0gW107XG4gICAgdmFyIHRvdGFsID0gMDtcbiAgICBjb25zdCBpbkZsaWdodCA9IG5ldyBTZXQoW10pO1xuXG4gICAgY29uc3QgaGVhZGVycyA9IHt9O1xuICAgIGlmIChyZWxhdGlvbnNoaXBzKSB7XG4gICAgICBjb25zdCBwYXRocyA9IFtdO1xuICAgICAgcGF0aHMucHVzaChgLmxpbmtzLm5leHRgKTtcbiAgICAgIGNvbnN0IGFkZFBhdGhzID0gcmVsYXRpb25zaGlwcyA9PiB7XG4gICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHJlbGF0aW9uc2hpcHMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICAgICAgcGF0aHMucHVzaChcbiAgICAgICAgICAgIGAuZGF0YS5bXS5yZWxhdGlvbnNoaXBzLiR7cmVsYXRpb25zaGlwc1tuYW1lXS5maWVsZH0ubGlua3MucmVsYXRlZGAsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAocmVsYXRpb25zaGlwc1tuYW1lXS5hbnRpY2lwYXRlKSB7XG4gICAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhyZWxhdGlvbnNoaXBzW25hbWVdLmFudGljaXBhdGUpLmZvckVhY2goXG4gICAgICAgICAgICAgIGtleSA9PiB7XG4gICAgICAgICAgICAgICAgcGF0aHMucHVzaChyZWxhdGlvbnNoaXBzW25hbWVdLmFudGljaXBhdGVba2V5XSk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVsYXRpb25zaGlwc1tuYW1lXS5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICBhZGRQYXRocyhyZWxhdGlvbnNoaXBzW25hbWVdLnJlbGF0aW9uc2hpcHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgYWRkUGF0aHMocmVsYXRpb25zaGlwcyk7XG4gICAgICBpZiAocGF0aHMubGVuZ3RoKSB7XG4gICAgICAgIGhlYWRlcnNbJ3gtcHVzaC1wbGVhc2UnXSA9IHBhdGhzLmpvaW4oJzsgJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZG9SZXF1ZXN0ID0gbmV4dExpbmsgPT4ge1xuICAgICAgaW5GbGlnaHQuYWRkKG5leHRMaW5rKTtcbiAgICAgIHJldHVybiB0aGlzLmZldGNoRG9jdW1lbnQobmV4dExpbmssIGhlYWRlcnMpLnRoZW4oZG9jID0+IHtcbiAgICAgICAgaW5GbGlnaHQuZGVsZXRlKG5leHRMaW5rKTtcbiAgICAgICAgbGluayA9IGRvYy5saW5rcy5uZXh0IHx8IGZhbHNlO1xuICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5kb2N1bWVudERhdGEoZG9jKTtcbiAgICAgICAgY29uc3QgcmVzb3VyY2VzID0gQXJyYXkuaXNBcnJheShkYXRhKSA/IGRhdGEgOiBbZGF0YV07XG4gICAgICAgIHRvdGFsICs9IHJlc291cmNlcyA/IHJlc291cmNlcy5sZW5ndGggOiAwO1xuICAgICAgICBidWZmZXIucHVzaCguLi4ocmVzb3VyY2VzIHx8IFtdKSk7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoYnVmZmVyKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICB2YXIgY29sbGVjdGlvblJlcXVlc3RzID0gW107XG4gICAgY29uc3QgYWR2YW5jZSA9ICgpID0+IHtcbiAgICAgIGlmIChsaW5rICYmICFpbkZsaWdodC5oYXMobGluaykgJiYgKGxpbWl0ID09PSAtMSB8fCB0b3RhbCA8IGxpbWl0KSkge1xuICAgICAgICBjb2xsZWN0aW9uUmVxdWVzdHMucHVzaChkb1JlcXVlc3QobGluaykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuICFidWZmZXIubGVuZ3RoICYmIGNvbGxlY3Rpb25SZXF1ZXN0cy5sZW5ndGhcbiAgICAgICAgPyBjb2xsZWN0aW9uUmVxdWVzdHMuc2hpZnQoKS50aGVuKCgpID0+IGJ1ZmZlcilcbiAgICAgICAgOiBQcm9taXNlLnJlc29sdmUoYnVmZmVyKTtcbiAgICB9O1xuXG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBjb25zdCBjdXJzb3IgPSAoZnVuY3Rpb24qKCkge1xuICAgICAgd2hpbGUgKGJ1ZmZlci5sZW5ndGggfHwgaW5GbGlnaHQuc2l6ZSB8fCBsaW5rKSB7XG4gICAgICAgIHlpZWxkIGxpbWl0ID09PSAtMSB8fCBjb3VudCA8IGxpbWl0XG4gICAgICAgICAgPyBhZHZhbmNlKCkudGhlbihidWZmZXIgPT4ge1xuICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICBjb25zdCByZXNvdXJjZSA9IGJ1ZmZlci5zaGlmdCgpO1xuICAgICAgICAgICAgICByZXR1cm4gcmVzb3VyY2UgfHwgbnVsbDtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgOiBmYWxzZTtcbiAgICAgIH1cbiAgICB9KSgpO1xuICAgIGN1cnNvci5jYW5Db250aW51ZSA9ICgpID0+IGJ1ZmZlci5sZW5ndGggfHwgaW5GbGlnaHQuc2l6ZSB8fCBsaW5rO1xuICAgIGN1cnNvci5hZGRNb3JlID0gKG1hbnkgPSAtMSkgPT5cbiAgICAgIG1hbnkgPT09IC0xID8gKGxpbWl0ID0gLTEpIDogKGxpbWl0ICs9IG1hbnkpO1xuXG4gICAgaWYgKGxpbmsgJiYgIWluRmxpZ2h0LmhhcyhsaW5rKSAmJiAobGltaXQgPT09IC0xIHx8IHRvdGFsIDwgbGltaXQpKSB7XG4gICAgICBjb2xsZWN0aW9uUmVxdWVzdHMucHVzaChkb1JlcXVlc3QobGluaykpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnRvQ29uc3VtZXIoY3Vyc29yLCByZWxhdGlvbnNoaXBzKTtcbiAgfVxuXG4gIHRvQ29uc3VtZXIoY3Vyc29yLCByZWxhdGlvbnNoaXBzID0gbnVsbCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiB7XG4gICAgICBjb25zdW1lOiBmdW5jdGlvbihjb25zdW1lciwgcHJlc2VydmVPcmRlciA9IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IHF1ZXVlID0gW107XG4gICAgICAgIGNvbnN0IHF1ZXVlZENvbnN1bWVyID0gKHJlc291cmNlLCByZWxhdGlvbnNoaXBzKSA9PiB7XG4gICAgICAgICAgcXVldWUucHVzaChcbiAgICAgICAgICAgIHByZXNlcnZlT3JkZXJcbiAgICAgICAgICAgICAgPyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgICAgICAgICA/IGNvbnN1bWVyKHJlc291cmNlLCByZWxhdGlvbnNoaXBzKVxuICAgICAgICAgICAgICAgICAgICA6IGNvbnN1bWVyKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIDogcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgICAgID8gY29uc3VtZXIocmVzb3VyY2UsIHJlbGF0aW9uc2hpcHMpXG4gICAgICAgICAgICAgICAgOiBjb25zdW1lcihyZXNvdXJjZSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgZGVjb3JhdGVkQ29uc3VtZXIgPSBzZWxmLmRlY29yYXRlV2l0aFJlbGF0aW9uc2hpcHMoXG4gICAgICAgICAgcXVldWVkQ29uc3VtZXIsXG4gICAgICAgICAgcmVsYXRpb25zaGlwcyxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjb25zdCBmID0gbmV4dCA9PiB7XG4gICAgICAgICAgICBpZiAobmV4dCkge1xuICAgICAgICAgICAgICAvLyBAbm90ZTogdXNpbmcgYXN5bmMvYXdhaXQgZm9yIHRoaXMgJ3RoZW4nIGNhdXNlZCBicm93c2VyIGNyYXNoZXMuXG4gICAgICAgICAgICAgIG5leHRcbiAgICAgICAgICAgICAgICAudGhlbihyZXNvdXJjZSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2UpIGRlY29yYXRlZENvbnN1bWVyKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICAgIGYoY3Vyc29yLm5leHQoKS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIFByb21pc2UuYWxsKHF1ZXVlKVxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHJlc29sdmUoY3Vyc29yLmNhbkNvbnRpbnVlKCkgPyBjdXJzb3IuYWRkTW9yZSA6IGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgZihjdXJzb3IubmV4dCgpLnZhbHVlKTtcbiAgICAgICAgfSkudGhlbihuZXh0ID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKHByZXNlcnZlT3JkZXIpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGxldCBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgbGV0IHJldCA9IGZuKCk7XG4gICAgICAgICAgICAgICAgaWYgKHJldCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgICAgICAgIGF3YWl0IHJldC5jYXRjaChyZWplY3QpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZShuZXh0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBkZWJ1Z2dlcigpIHtcbiAgICByZXR1cm4gZXJyb3IgPT4ge1xuICAgICAgLy8gQHRvZG86IHRoaXMgc2hvdWxkIGFjdHVhbGx5IGNoZWNrIGZvciBlcnJvcnMuanNvbmFwaVxuICAgICAgaWYgKGVycm9yLmVycm9ycykge1xuICAgICAgICBjb25zdCBsb2dFcnJvciA9IGVycm9yID0+IHtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKFxuICAgICAgICAgICAgYCR7ZXJyb3IudGl0bGV9OiAke2Vycm9yLmRldGFpbH0uICVzYCxcbiAgICAgICAgICAgIGVycm9yLmxpbmtzLmluZm8sXG4gICAgICAgICAgKTtcbiAgICAgICAgfTtcbiAgICAgICAgZXJyb3IuZXJyb3JzLmZvckVhY2gobG9nRXJyb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy90aGlzLmxvZ2dlci5sb2coZXJyb3IpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBkZWNvcmF0ZVdpdGhSZWxhdGlvbnNoaXBzKGNvbnN1bWVyLCByZWxhdGlvbnNoaXBzID0gbnVsbCkge1xuICAgIGNvbnN0IGRlY29yYXRlZCA9ICFyZWxhdGlvbnNoaXBzXG4gICAgICA/IGNvbnN1bWVyXG4gICAgICA6IHJlc291cmNlID0+IHtcbiAgICAgICAgICBjb25zdCBtaXJyb3IgPSB7fTtcbiAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhyZWxhdGlvbnNoaXBzKS5mb3JFYWNoKHJlbGF0aW9uc2hpcCA9PiB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSByZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcF07XG4gICAgICAgICAgICBsZXQgcGF0aCA9IFtdLFxuICAgICAgICAgICAgICBsaW5rO1xuICAgICAgICAgICAgbWlycm9yW3JlbGF0aW9uc2hpcF0gPSAobGluayA9IGV4dHJhY3RWYWx1ZShcbiAgICAgICAgICAgICAgYHJlbGF0aW9uc2hpcHMuJHt0YXJnZXQuZmllbGR9LmxpbmtzLnJlbGF0ZWRgLFxuICAgICAgICAgICAgICByZXNvdXJjZSxcbiAgICAgICAgICAgICkpXG4gICAgICAgICAgICAgID8gdGhpcy5wYWdpbmF0ZShcbiAgICAgICAgICAgICAgICAgIGxpbmssXG4gICAgICAgICAgICAgICAgICB0YXJnZXQubGltaXQgfHwgLTEsXG4gICAgICAgICAgICAgICAgICB0YXJnZXQucmVsYXRpb25zaGlwcyB8fCBudWxsLFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgOiBQcm9taXNlLnJlamVjdCgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybiBjb25zdW1lcihyZXNvdXJjZSwgbWlycm9yKTtcbiAgICAgICAgfTtcbiAgICByZXR1cm4gZGVjb3JhdGVkO1xuICB9XG5cbiAgZmV0Y2hEb2N1bWVudCh1cmwsIGhlYWRlcnMgPSB7fSwgb3ZlcnJpZGVzID0ge30pIHtcbiAgICBjb25zdCBvcHRpb25zID0gT2JqZWN0LmFzc2lnbihcbiAgICAgIHtcbiAgICAgICAgaGVhZGVyczogbmV3IEhlYWRlcnMoXG4gICAgICAgICAgT2JqZWN0LmFzc2lnbihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgYWNjZXB0OiAnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgICksXG4gICAgICAgICksXG4gICAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICB9LFxuICAgICAgb3ZlcnJpZGVzLFxuICAgICk7XG4gICAgaWYgKHRoaXMuYXV0aG9yaXphdGlvbikge1xuICAgICAgb3B0aW9ucy5oZWFkZXJzLnNldCgnYXV0aG9yaXphdGlvbicsIHRoaXMuYXV0aG9yaXphdGlvbik7XG4gICAgfVxuICAgIHJldHVybiBmZXRjaCh1cmwsIG9wdGlvbnMpLnRoZW4ocmVzID0+IHtcbiAgICAgIGlmIChyZXMub2spIHtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKF8sIHJlamVjdCkgPT4ge1xuICAgICAgICAgIHJlamVjdChcbiAgICAgICAgICAgIGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICByZWplY3QocmVzLnN0YXR1c1RleHQpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBkb2N1bWVudERhdGEoZG9jKSB7XG4gICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eSgnZGF0YScpKSB7XG4gICAgICByZXR1cm4gZG9jLmRhdGE7XG4gICAgfVxuICAgIGlmIChkb2MuaGFzT3duUHJvcGVydHkoJ2Vycm9ycycpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZG9jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnVGhlIHNlcnZlciByZXR1cm5lZCBhbiB1bnByb2Nlc3NhYmxlIGRvY3VtZW50IHdpdGggbm8gZGF0YSBvciBlcnJvcnMuJyxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgZ2V0TGluayh0eXBlLCBoZWFkZXJzID0ge30sIG9wdGlvbnMgPSB7fSkge1xuICAgIHJldHVybiB0aGlzLmxpbmtzLnRoZW4obGlua3MgPT4ge1xuICAgICAgaWYgKCFsaW5rcy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkge1xuICAgICAgICBQcm9taXNlLnJlamVjdChgJyR7dHlwZX0nIGlzIG5vdCBhIHZhbGlkIHR5cGUgZm9yICR7dGhpcy5iYXNlVXJsfS5gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmJhc2VVcmwgKyBsaW5rc1t0eXBlXTtcbiAgICB9KTtcbiAgfVxuXG4gIGZpbHRlcihmKSB7XG4gICAgcmV0dXJuIG5ldyBGaWx0ZXIoZik7XG4gIH1cblxuICBhc3luYyBjb2xsZWN0aW9uTGluayh0eXBlLCB7IHNvcnQsIGZpbHRlciwgcGFnZSB9ID0ge30pIHtcbiAgICBsZXQgcXVlcnkgPSAnJztcbiAgICBxdWVyeSArPSBmaWx0ZXIubGVuZ3RoID8gYD8ke2ZpbHRlcn1gIDogJyc7XG4gICAgcXVlcnkgKz0gc29ydC5sZW5ndGggPyBgJHtxdWVyeS5sZW5ndGggPyAnJicgOiAnPyd9c29ydD0ke3NvcnR9YCA6ICcnO1xuICAgIHF1ZXJ5ICs9IHBhZ2UubGVuZ3RoID8gYCR7cXVlcnkubGVuZ3RoID8gJyYnIDogJz8nfSR7cGFnZX1gIDogJyc7XG4gICAgcmV0dXJuIGAke2F3YWl0IHRoaXMuZ2V0TGluayhcbiAgICAgIHR5cGUgLyosIGhlYWRlcnMsIHtjcmVkZW50aWFsczogJ2luY2x1ZGUnfSovLFxuICAgICl9JHtxdWVyeX1gO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RWYWx1ZShwYXRoLCBvYmopIHtcbiAgcmV0dXJuIHBhdGhcbiAgICAuc3BsaXQoJy4nKVxuICAgIC5yZWR1Y2UoXG4gICAgICAoZXhpc3RzLCBwYXJ0KSA9PlxuICAgICAgICBleGlzdHMgJiYgZXhpc3RzLmhhc093blByb3BlcnR5KHBhcnQpID8gZXhpc3RzW3BhcnRdIDogZmFsc2UsXG4gICAgICBvYmosXG4gICAgKTtcbn1cblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9saWIvaW5kZXguanMiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBGaWx0ZXIge1xuICBjb25zdHJ1Y3RvcihmKSB7XG4gICAgdGhpcy5jb25kaXRpb25zID0gZihDb25kaXRpb25zLCBrZXkgPT4gcGFyYW1ldGVycyA9PiBwYXJhbWV0ZXJzW2tleV0pO1xuICB9XG5cbiAgY29tcGlsZShwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgaWQgPSAoZnVuY3Rpb24qKCkge1xuICAgICAgbGV0IGNvdW50ZXIgPSAxO1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgeWllbGQgY291bnRlcisrO1xuICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICBjb25zdCBjb21waWxlciA9IChhY2MsIGl0ZW0sIF8sIHBhcmVudElEID0gbnVsbCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudElEID0gaWQubmV4dCgpLnZhbHVlO1xuICAgICAgY29uc3QgcHJlZml4ID0gYWNjLmxlbmd0aCA/IGAke2FjY30mYCA6ICcnO1xuICAgICAgaWYgKGl0ZW0ubWVtYmVycykge1xuICAgICAgICBjb25zdCByb290ID0gYGZpbHRlclske2N1cnJlbnRJRH1dW2dyb3VwXWA7XG4gICAgICAgIGNvbnN0IHNlbGYgPSBwYXJlbnRJRFxuICAgICAgICAgID8gYCR7cm9vdH1bY29uanVuY3Rpb25dPSR7XG4gICAgICAgICAgICAgIGl0ZW0uY29uanVuY3Rpb25cbiAgICAgICAgICAgIH0mJHtyb290fVttZW1iZXJPZl09JHtwYXJlbnRJRH1gXG4gICAgICAgICAgOiBgJHtyb290fVtjb25qdW5jdGlvbl09JHtpdGVtLmNvbmp1bmN0aW9ufWA7XG4gICAgICAgIHJldHVybiBgJHtwcmVmaXh9JHtpdGVtLm1lbWJlcnMucmVkdWNlKFxuICAgICAgICAgIChhY2MsIGl0ZW0sIF8pID0+IGNvbXBpbGVyKGFjYywgaXRlbSwgXywgY3VycmVudElEKSxcbiAgICAgICAgICBzZWxmLFxuICAgICAgICApfWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByb290ID0gYGZpbHRlclske2N1cnJlbnRJRH1dW2NvbmRpdGlvbl1gO1xuICAgICAgICBjb25zdCBwcm9jZXNzZWQgPSBDb25kaXRpb25zLnByb2Nlc3MoaXRlbSwgcGFyYW1ldGVycyk7XG4gICAgICAgIGxldCBzZWxmID0gJyc7XG4gICAgICAgIHNlbGYgKz0gYCR7cm9vdH1bcGF0aF09JHtlbmNvZGVVUklDb21wb25lbnQocHJvY2Vzc2VkLnBhdGgpfWA7XG4gICAgICAgIGlmIChDb25kaXRpb25zLnVuYXJ5T3BlcmF0b3JzLmhhcyhwcm9jZXNzZWQub3BlcmF0b3IpKSB7XG4gICAgICAgICAgc2VsZiArPSBgJiR7cm9vdH1bdmFsdWVdPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHByb2Nlc3NlZC52YWx1ZSl9YDtcbiAgICAgICAgfSBlbHNlIGlmICghQ29uZGl0aW9ucy5udWxsT3BlcmF0b3JzLmhhcyhwcm9jZXNzZWQub3BlcmF0b3IpKSB7XG4gICAgICAgICAgcHJvY2Vzc2VkLnZhbHVlLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICAgICAgICBzZWxmICs9IGAmJHtyb290fVt2YWx1ZV1bXT0ke2VuY29kZVVSSUNvbXBvbmVudChpdGVtKX1gO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYgKz0gYCYke3Jvb3R9W29wZXJhdG9yXT0ke2VuY29kZVVSSUNvbXBvbmVudChwcm9jZXNzZWQub3BlcmF0b3IpfWA7XG4gICAgICAgIHJldHVybiBwYXJlbnRJRFxuICAgICAgICAgID8gYCR7cHJlZml4fSR7c2VsZn0mJHtyb290fVttZW1iZXJPZl09JHtwYXJlbnRJRH1gXG4gICAgICAgICAgOiBgJHtwcmVmaXh9JHtzZWxmfWA7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBjb21waWxlcignJywgdGhpcy5jb25kaXRpb25zKTtcbiAgfVxufVxuXG5jb25zdCBHcm91cHMgPSB7XG4gIGFuZDogKC4uLm1lbWJlcnMpID0+IHtcbiAgICByZXR1cm4gR3JvdXBzLmdyb3VwKG1lbWJlcnMsICdBTkQnKTtcbiAgfSxcblxuICBvcjogKC4uLm1lbWJlcnMpID0+IHtcbiAgICByZXR1cm4gR3JvdXBzLmdyb3VwKG1lbWJlcnMsICdPUicpO1xuICB9LFxuXG4gIGdyb3VwOiAobWVtYmVycywgY29uanVuY3Rpb24pID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uanVuY3Rpb24sXG4gICAgICBtZW1iZXJzLFxuICAgIH07XG4gIH0sXG59O1xuXG5jb25zdCBDb25kaXRpb25zID0gZnVuY3Rpb24ocGF0aCwgdmFsdWUpIHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuZXEocGF0aCwgdmFsdWUpO1xufTtcblxuQ29uZGl0aW9ucy5hbmQgPSBHcm91cHMuYW5kO1xuXG5Db25kaXRpb25zLm9yID0gR3JvdXBzLm9yO1xuXG5Db25kaXRpb25zLmVxID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJz0nKTtcbn07XG5cbkNvbmRpdGlvbnMubm90RXEgPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnPD4nKTtcbn07XG5cbkNvbmRpdGlvbnMuZ3QgPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnPicpO1xufTtcblxuQ29uZGl0aW9ucy5ndEVxID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJz49Jyk7XG59O1xuXG5Db25kaXRpb25zLmx0ID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJzwnKTtcbn07XG5cbkNvbmRpdGlvbnMubHRFcSA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICc8PScpO1xufTtcblxuQ29uZGl0aW9ucy5zdGFydHNXaXRoID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJ1NUQVJUU19XSVRIJyk7XG59O1xuXG5Db25kaXRpb25zLmNvbnRhaW5zID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJ0NPTlRBSU5TJyk7XG59O1xuXG5Db25kaXRpb25zLmVuZHNXaXRoID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJ0VORFNfV0lUSCcpO1xufTtcblxuQ29uZGl0aW9ucy5pbiA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICdJTicpO1xufTtcblxuQ29uZGl0aW9ucy5ub3RJbiA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICdOT1QgSU4nKTtcbn07XG5cbkNvbmRpdGlvbnMuYmV0d2VlbiA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICdCRVRXRUVOJyk7XG59O1xuXG5Db25kaXRpb25zLm5vdEJldHdlZW4gPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnTk9UIEJFVFdFRU4nKTtcbn07XG5cbkNvbmRpdGlvbnMubnVsbCA9IHBhdGggPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdW5kZWZpbmVkLCAnSVMgTlVMTCcpO1xufTtcblxuQ29uZGl0aW9ucy5ub3ROdWxsID0gcGF0aCA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB1bmRlZmluZWQsICdJUyBOT1QgTlVMTCcpO1xufTtcblxuQ29uZGl0aW9ucy5jb25kaXRpb24gPSAocGF0aCwgdmFsdWUsIG9wZXJhdG9yKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLnZhbGlkYXRlKHsgcGF0aCwgdmFsdWUsIG9wZXJhdG9yIH0pO1xufTtcblxuQ29uZGl0aW9ucy51bmFyeU9wZXJhdG9ycyA9IG5ldyBTZXQoW1xuICAnPScsXG4gICc8PicsXG4gICc+JyxcbiAgJz49JyxcbiAgJzwnLFxuICAnPD0nLFxuICAnU1RBUlRTX1dJVEgnLFxuICAnQ09OVEFJTlMnLFxuICAnRU5EU19XSVRIJyxcbl0pO1xuQ29uZGl0aW9ucy51bmFyeVZhbHVlVHlwZXMgPSBuZXcgU2V0KFsnc3RyaW5nJywgJ2Jvb2xlYW4nLCAnbnVtYmVyJ10pO1xuQ29uZGl0aW9ucy5iaW5hcnlPcGVyYXRvcnMgPSBuZXcgU2V0KFsnQkVUV0VFTicsICdOT1QgQkVUV0VFTiddKTtcbkNvbmRpdGlvbnMuc3RyaW5nT3BlcmF0b3JzID0gbmV3IFNldChbJ1NUQVJUU19XSVRIJywgJ0NPTlRBSU5TJywgJ0VORFNfV0lUSCddKTtcbkNvbmRpdGlvbnMubnVsbE9wZXJhdG9ycyA9IG5ldyBTZXQoWydJUyBOVUxMJywgJ0lTIE5PVCBOVUxMJ10pO1xuXG5Db25kaXRpb25zLnZhbGlkYXRlID0gY29uZGl0aW9uID0+IHtcbiAgaWYgKFxuICAgIGNvbmRpdGlvbi5vcGVyYXRvciBpbnN0YW5jZW9mIEZ1bmN0aW9uIHx8XG4gICAgY29uZGl0aW9uLnZhbHVlIGluc3RhbmNlb2YgRnVuY3Rpb25cbiAgKSB7XG4gICAgcmV0dXJuIGNvbmRpdGlvbjtcbiAgfVxuICBpZiAoQ29uZGl0aW9ucy5udWxsT3BlcmF0b3JzLmhhcyhjb25kaXRpb24ub3BlcmF0b3IpKSB7XG4gICAgaWYgKHR5cGVvZiBjb25kaXRpb24udmFsdWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBDb25kaXRpb25zIHdpdGggYW4gJyR7XG4gICAgICAgICAgY29uZGl0aW9uLm9wZXJhdG9yXG4gICAgICAgIH0nIG9wZXJhdG9yIG11c3Qgbm90IHNwZWNpZnkgYSB2YWx1ZS5gLFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoQ29uZGl0aW9ucy51bmFyeU9wZXJhdG9ycy5oYXMoY29uZGl0aW9uLm9wZXJhdG9yKSkge1xuICAgIGlmICghQ29uZGl0aW9ucy51bmFyeVZhbHVlVHlwZXMuaGFzKHR5cGVvZiBjb25kaXRpb24udmFsdWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBUaGUgJyR7Y29uZGl0aW9uLm9wZXJhdG9yfScgb3BlcmF0b3IgcmVxdWlyZXMgYSBzaW5nbGUgdmFsdWUuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIENvbmRpdGlvbnMuc3RyaW5nT3BlcmF0b3JzLmhhcyhjb25kaXRpb24ub3BlcmF0b3IpICYmXG4gICAgICB0eXBlb2YgY29uZGl0aW9uLnZhbHVlICE9ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBUaGUgJyR7XG4gICAgICAgICAgY29uZGl0aW9uLm9wZXJhdG9yXG4gICAgICAgIH0nIG9wZXJhdG9yIHJlcXVpcmVzIHRoYXQgdGhlIGNvbmRpdGlvbiB2YWx1ZSBiZSBhIHN0cmluZy5gLFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGNvbmRpdGlvbi52YWx1ZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYFRoZSAnJHtjb25kaXRpb24ub3BlcmF0b3J9JyBvcGVyYXRvciByZXF1aXJlcyBhbiBhcnJheSBvZiB2YWx1ZXMuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIENvbmRpdGlvbnMuYmluYXJ5T3BlcmF0b3JzLmhhcyhjb25kaXRpb24ub3BlcmF0b3IpICYmXG4gICAgICBjb25kaXRpb24udmFsdWUubGVuZ3RoICE9PSAyXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBUaGUgJyR7XG4gICAgICAgICAgY29uZGl0aW9uLm9wZXJhdG9yXG4gICAgICAgIH0nIG9wZXJhdG9yIHJlcXVpcmVzIGFuIGFycmF5IG9mIGV4YWN0bHkgMiB2YWx1ZXMuYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjb25kaXRpb247XG59O1xuXG5Db25kaXRpb25zLnByb2Nlc3MgPSAoY29uZGl0aW9uLCBwYXJhbWV0ZXJzKSA9PiB7XG4gIGxldCByZXZhbGlkYXRlID0gZmFsc2U7XG4gIGNvbnN0IHJlcGxhY2UgPSBpdGVtID0+IHtcbiAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXZhbGlkYXRlID0gdHJ1ZTtcbiAgICAgIHJldHVybiBpdGVtKHBhcmFtZXRlcnMpO1xuICAgIH1cbiAgICByZXR1cm4gaXRlbTtcbiAgfTtcbiAgY29uc3QgcHJvY2Vzc2VkID0ge1xuICAgIHBhdGg6IHJlcGxhY2UoY29uZGl0aW9uLnBhdGgpLFxuICAgIG9wZXJhdG9yOiByZXBsYWNlKGNvbmRpdGlvbi5vcGVyYXRvciksXG4gIH07XG4gIGlmICghQ29uZGl0aW9ucy5udWxsT3BlcmF0b3JzLmhhcyhwcm9jZXNzZWQub3BlcmF0b3IpKSB7XG4gICAgcHJvY2Vzc2VkLnZhbHVlID0gcmVwbGFjZShjb25kaXRpb24udmFsdWUpO1xuICB9XG4gIGlmIChyZXZhbGlkYXRlKSB7XG4gICAgQ29uZGl0aW9ucy52YWxpZGF0ZShwcm9jZXNzZWQpO1xuICB9XG4gIHJldHVybiBwcm9jZXNzZWQ7XG59O1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sInNvdXJjZVJvb3QiOiIifQ==