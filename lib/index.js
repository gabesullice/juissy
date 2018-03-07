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

const client = new __WEBPACK_IMPORTED_MODULE_0__lib__["a" /* default */]('https://jsonapi.test', {
  authorization: `Basic ${btoa('root:root')}`
});

(async () => {
  const options = {
    sort: '-title',
    relationships: {
      tags: {
        field: 'field_tags',
        relationships: {
          vocabulary: 'vid'
        }
      }
    }
  }; //options.filter = filter.compile({paramOne: 'easy'});

  (await client.all('node--recipe', options)).consume(logRecipe('Initial'));
})();

const filter = client.filter((c, param) => {
  return c.and(c('status', 1), c.or(c.contains('title', param('paramOne')), c.startsWith('title', 'Thai')));
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
  console.log('Tags:', tags.length ? tags.join(', ') : 'n/a');
  console.log('Vocabularies:', vocabs.length ? vocabs.join(', ') : 'n/a');
  console.groupEnd(`${label}: ${recipe.attributes.title}`);
}; //client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(logResourceAs('Individual'))
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
  }

  async get(type, id) {
    const link = `${await this.getLink(type)}/${id}`;
    return this.documentData((await this.fetchDocument(link)));
  }

  async all(type, {
    limit = -1,
    sort = '',
    filter = '',
    relationships = null
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
      //&& relationships.tags && relationships.tags.field === 'field_tags') {
      const paths = [];
      Object.getOwnPropertyNames(relationships).forEach(name => {
        paths.push(`.data.[].relationships.${relationships[name].field}.links.related`);
      });

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
        'accept': 'application/vnd.api+json'
      }, headers)) //})),

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
    if (!this.links) {
      this.links = new Promise((resolve, reject) => {
        this.fetchDocument(`${this.baseUrl}/jsonapi`, headers, options).then(doc => resolve(doc.links || {})).catch(err => {
          this.logger.log('Unable to resolve resource links.');
          reject(err);
        });
      });
    }

    return this.links.then(links => {
      if (!links.hasOwnProperty(type)) {
        Promise.reject(`'${type}' is not a valid type for ${this.baseUrl}.`);
      }

      return links[type];
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
    const headers = {
      'x-push-please': `.links.${type}${query}`
    };
    return `${await this.getLink(type, headers, {
      credentials: 'include'
    })}${query}`;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgZDRmNGRjMTdkMTVkMTYzMTdmM2EiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbImNsaWVudCIsImF1dGhvcml6YXRpb24iLCJidG9hIiwib3B0aW9ucyIsInNvcnQiLCJyZWxhdGlvbnNoaXBzIiwidGFncyIsImZpZWxkIiwidm9jYWJ1bGFyeSIsImFsbCIsImNvbnN1bWUiLCJsb2dSZWNpcGUiLCJmaWx0ZXIiLCJjIiwicGFyYW0iLCJhbmQiLCJvciIsImNvbnRhaW5zIiwic3RhcnRzV2l0aCIsImxhYmVsIiwicmVjaXBlIiwidm9jYWJzIiwidGFnIiwicHVzaCIsImF0dHJpYnV0ZXMiLCJuYW1lIiwidm9jYWIiLCJjb25zb2xlIiwiZ3JvdXBDb2xsYXBzZWQiLCJ0aXRsZSIsImxvZyIsImxlbmd0aCIsImpvaW4iLCJncm91cEVuZCIsIkRydXBhbENsaWVudCIsImNvbnN0cnVjdG9yIiwiYmFzZVVybCIsImxvZ2dlciIsImdldCIsInR5cGUiLCJpZCIsImxpbmsiLCJnZXRMaW5rIiwiZG9jdW1lbnREYXRhIiwiZmV0Y2hEb2N1bWVudCIsImxpbWl0IiwiY29sbGVjdGlvbkxpbmsiLCJwYWdlIiwiZXhwYW5kZWQiLCJleHBhbmRSZWxhdGlvbnNoaXBzIiwicGFnaW5hdGUiLCJleHBhbmRlciIsIm5vZGUiLCJvYmplY3RNYXBwZXIiLCJtYXBwZXIiLCJpbml0aWFsIiwiT2JqZWN0IiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsInJlZHVjZSIsIm1hcHBlZCIsInByb3AiLCJidWZmZXIiLCJ0b3RhbCIsImluRmxpZ2h0IiwiU2V0IiwiaGVhZGVycyIsInBhdGhzIiwiZm9yRWFjaCIsImRvUmVxdWVzdCIsIm5leHRMaW5rIiwiYWRkIiwidGhlbiIsImRvYyIsImRlbGV0ZSIsImxpbmtzIiwibmV4dCIsImRhdGEiLCJyZXNvdXJjZXMiLCJBcnJheSIsImlzQXJyYXkiLCJQcm9taXNlIiwicmVzb2x2ZSIsImNvbGxlY3Rpb25SZXF1ZXN0cyIsImFkdmFuY2UiLCJoYXMiLCJzaGlmdCIsImNvdW50IiwiY3Vyc29yIiwic2l6ZSIsInJlc291cmNlIiwiY2FuQ29udGludWUiLCJhZGRNb3JlIiwibWFueSIsInRvQ29uc3VtZXIiLCJzZWxmIiwiY29uc3VtZXIiLCJwcmVzZXJ2ZU9yZGVyIiwicXVldWUiLCJxdWV1ZWRDb25zdW1lciIsImRlY29yYXRlZENvbnN1bWVyIiwiZGVjb3JhdGVXaXRoUmVsYXRpb25zaGlwcyIsInJlamVjdCIsImYiLCJ2YWx1ZSIsImNhdGNoIiwiZm4iLCJyZXQiLCJkZWJ1Z2dlciIsImVycm9yIiwiZXJyb3JzIiwibG9nRXJyb3IiLCJpbmZvIiwiZGV0YWlsIiwiZGVjb3JhdGVkIiwibWlycm9yIiwicmVsYXRpb25zaGlwIiwidGFyZ2V0IiwicGF0aCIsImV4dHJhY3RWYWx1ZSIsInVybCIsIm92ZXJyaWRlcyIsImFzc2lnbiIsIkhlYWRlcnMiLCJzZXQiLCJmZXRjaCIsInJlcyIsIm9rIiwianNvbiIsIl8iLCJzdGF0dXNUZXh0IiwiaGFzT3duUHJvcGVydHkiLCJFcnJvciIsImVyciIsInF1ZXJ5IiwiY3JlZGVudGlhbHMiLCJvYmoiLCJzcGxpdCIsImV4aXN0cyIsInBhcnQiLCJGaWx0ZXIiLCJjb25kaXRpb25zIiwiQ29uZGl0aW9ucyIsImtleSIsInBhcmFtZXRlcnMiLCJjb21waWxlIiwiY291bnRlciIsImNvbXBpbGVyIiwiYWNjIiwiaXRlbSIsInBhcmVudElEIiwiY3VycmVudElEIiwicHJlZml4IiwibWVtYmVycyIsInJvb3QiLCJjb25qdW5jdGlvbiIsInByb2Nlc3NlZCIsInByb2Nlc3MiLCJlbmNvZGVVUklDb21wb25lbnQiLCJ1bmFyeU9wZXJhdG9ycyIsIm9wZXJhdG9yIiwibnVsbE9wZXJhdG9ycyIsIkdyb3VwcyIsImdyb3VwIiwiZXEiLCJjb25kaXRpb24iLCJub3RFcSIsImd0IiwiZ3RFcSIsImx0IiwibHRFcSIsImVuZHNXaXRoIiwiaW4iLCJub3RJbiIsImJldHdlZW4iLCJub3RCZXR3ZWVuIiwibnVsbCIsInVuZGVmaW5lZCIsIm5vdE51bGwiLCJ2YWxpZGF0ZSIsInVuYXJ5VmFsdWVUeXBlcyIsImJpbmFyeU9wZXJhdG9ycyIsInN0cmluZ09wZXJhdG9ycyIsIkZ1bmN0aW9uIiwicmV2YWxpZGF0ZSIsInJlcGxhY2UiXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsbUNBQTJCLDBCQUEwQixFQUFFO0FBQ3ZELHlDQUFpQyxlQUFlO0FBQ2hEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDhEQUFzRCwrREFBK0Q7O0FBRXJIO0FBQ0E7O0FBRUE7QUFDQTs7Ozs7Ozs7OztBQzdEQTtBQUVBLE1BQU1BLFNBQVMsSUFBSSxxREFBSixDQUFZLHNCQUFaLEVBQW9DO0FBQ2pEQyxpQkFBZ0IsU0FBUUMsS0FBSyxXQUFMLENBQWtCO0FBRE8sQ0FBcEMsQ0FBZjs7QUFJQSxDQUFDLFlBQVk7QUFDWCxRQUFNQyxVQUFVO0FBQ2RDLFVBQU0sUUFEUTtBQUVkQyxtQkFBZTtBQUNiQyxZQUFNO0FBQ0pDLGVBQU8sWUFESDtBQUVKRix1QkFBZTtBQUNiRyxzQkFBWTtBQURDO0FBRlg7QUFETztBQUZELEdBQWhCLENBRFcsQ0FZWDs7QUFDQSxHQUFDLE1BQU1SLE9BQU9TLEdBQVAsQ0FBVyxjQUFYLEVBQTJCTixPQUEzQixDQUFQLEVBQTRDTyxPQUE1QyxDQUFvREMsVUFBVSxTQUFWLENBQXBE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XHQvLyBUaGUgbW9kdWxlIGNhY2hlXG4gXHR2YXIgaW5zdGFsbGVkTW9kdWxlcyA9IHt9O1xuXG4gXHQvLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuIFx0ZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXG4gXHRcdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuIFx0XHRpZihpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSkge1xuIFx0XHRcdHJldHVybiBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXS5leHBvcnRzO1xuIFx0XHR9XG4gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4gXHRcdHZhciBtb2R1bGUgPSBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSA9IHtcbiBcdFx0XHRpOiBtb2R1bGVJZCxcbiBcdFx0XHRsOiBmYWxzZSxcbiBcdFx0XHRleHBvcnRzOiB7fVxuIFx0XHR9O1xuXG4gXHRcdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuIFx0XHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG4gXHRcdG1vZHVsZS5sID0gdHJ1ZTtcblxuIFx0XHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuIFx0XHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gXHR9XG5cblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGVzIG9iamVjdCAoX193ZWJwYWNrX21vZHVsZXNfXylcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubSA9IG1vZHVsZXM7XG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlIGNhY2hlXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmMgPSBpbnN0YWxsZWRNb2R1bGVzO1xuXG4gXHQvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9uIGZvciBoYXJtb255IGV4cG9ydHNcbiBcdF9fd2VicGFja19yZXF1aXJlX18uZCA9IGZ1bmN0aW9uKGV4cG9ydHMsIG5hbWUsIGdldHRlcikge1xuIFx0XHRpZighX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIG5hbWUpKSB7XG4gXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIG5hbWUsIHtcbiBcdFx0XHRcdGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gXHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuIFx0XHRcdFx0Z2V0OiBnZXR0ZXJcbiBcdFx0XHR9KTtcbiBcdFx0fVxuIFx0fTtcblxuIFx0Ly8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubiA9IGZ1bmN0aW9uKG1vZHVsZSkge1xuIFx0XHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cbiBcdFx0XHRmdW5jdGlvbiBnZXREZWZhdWx0KCkgeyByZXR1cm4gbW9kdWxlWydkZWZhdWx0J107IH0gOlxuIFx0XHRcdGZ1bmN0aW9uIGdldE1vZHVsZUV4cG9ydHMoKSB7IHJldHVybiBtb2R1bGU7IH07XG4gXHRcdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsICdhJywgZ2V0dGVyKTtcbiBcdFx0cmV0dXJuIGdldHRlcjtcbiBcdH07XG5cbiBcdC8vIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbFxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5vID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpOyB9O1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcblxuIFx0Ly8gTG9hZCBlbnRyeSBtb2R1bGUgYW5kIHJldHVybiBleHBvcnRzXG4gXHRyZXR1cm4gX193ZWJwYWNrX3JlcXVpcmVfXyhfX3dlYnBhY2tfcmVxdWlyZV9fLnMgPSAwKTtcblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyB3ZWJwYWNrL2Jvb3RzdHJhcCBkNGY0ZGMxN2QxNWQxNjMxN2YzYSIsImltcG9ydCBEQ2xpZW50IGZyb20gJy4vbGliJztcblxuY29uc3QgY2xpZW50ID0gbmV3IERDbGllbnQoJ2h0dHBzOi8vanNvbmFwaS50ZXN0Jywge1xuICBhdXRob3JpemF0aW9uOiBgQmFzaWMgJHtidG9hKCdyb290OnJvb3QnKX1gLFxufSk7XG5cbihhc3luYyAoKSA9PiB7XG4gIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgc29ydDogJy10aXRsZScsXG4gICAgcmVsYXRpb25zaGlwczoge1xuICAgICAgdGFnczoge1xuICAgICAgICBmaWVsZDogJ2ZpZWxkX3RhZ3MnLFxuICAgICAgICByZWxhdGlvbnNoaXBzOiB7XG4gICAgICAgICAgdm9jYWJ1bGFyeTogJ3ZpZCdcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfVxuICB9O1xuICAvL29wdGlvbnMuZmlsdGVyID0gZmlsdGVyLmNvbXBpbGUoe3BhcmFtT25lOiAnZWFzeSd9KTtcbiAgKGF3YWl0IGNsaWVudC5hbGwoJ25vZGUtLXJlY2lwZScsIG9wdGlvbnMpKS5jb25zdW1lKGxvZ1JlY2lwZSgnSW5pdGlhbCcpKTtcbn0pKClcblxuY29uc3QgZmlsdGVyID0gY2xpZW50LmZpbHRlcigoYywgcGFyYW0pID0+IHtcbiAgcmV0dXJuIGMuYW5kKFxuICAgIGMoJ3N0YXR1cycsIDEpLFxuICAgIGMub3IoXG4gICAgICBjLmNvbnRhaW5zKCd0aXRsZScsIHBhcmFtKCdwYXJhbU9uZScpKSxcbiAgICAgIGMuc3RhcnRzV2l0aCgndGl0bGUnLCAnVGhhaScpXG4gICAgKSxcbiAgKTtcbn0pO1xuXG5jb25zdCBsb2dSZWNpcGUgPSBsYWJlbCA9PiBhc3luYyAocmVjaXBlLCByZWxhdGlvbnNoaXBzKSA9PiB7XG4gIGxldCB0YWdzID0gW107XG4gIGxldCB2b2NhYnMgPSBbXTtcbiAgYXdhaXQgcmVsYXRpb25zaGlwcy50YWdzLmNvbnN1bWUoYXN5bmMgKHRhZywgcmVsYXRpb25zaGlwcykgPT4ge1xuICAgIHRhZ3MucHVzaCh0YWcuYXR0cmlidXRlcy5uYW1lKTtcblxuICAgIGF3YWl0IHJlbGF0aW9uc2hpcHMudm9jYWJ1bGFyeS5jb25zdW1lKHZvY2FiID0+IHtcbiAgICAgIHZvY2Ficy5wdXNoKHZvY2FiLmF0dHJpYnV0ZXMubmFtZSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoYCR7bGFiZWx9OiAke3JlY2lwZS5hdHRyaWJ1dGVzLnRpdGxlfWApO1xuICBjb25zb2xlLmxvZygnRGlzaDonLCByZWNpcGUuYXR0cmlidXRlcy50aXRsZSk7XG4gIGNvbnNvbGUubG9nKCdUYWdzOicsIHRhZ3MubGVuZ3RoID8gdGFncy5qb2luKCcsICcpOiAnbi9hJyk7XG4gIGNvbnNvbGUubG9nKCdWb2NhYnVsYXJpZXM6Jywgdm9jYWJzLmxlbmd0aCA/IHZvY2Ficy5qb2luKCcsICcpOiAnbi9hJyk7XG4gIGNvbnNvbGUuZ3JvdXBFbmQoYCR7bGFiZWx9OiAke3JlY2lwZS5hdHRyaWJ1dGVzLnRpdGxlfWApO1xufVxuXG4vL2NsaWVudC5nZXQoJ25vZGUtLXJlY2lwZScsICcyNWMwNDhiNi02OWU5LTQ2ZjQtOTg2ZC00YjgwYjAxZGUyZTYnKVxuLy8gIC50aGVuKGxvZ1Jlc291cmNlQXMoJ0luZGl2aWR1YWwnKSlcbi8vICAuY2F0Y2goZXJyb3IgPT4gY29uc29sZS5sb2coJ0Vycm9yOicsIGVycm9yKSk7XG5cblxuXG4vLyBXRUJQQUNLIEZPT1RFUiAvL1xuLy8gLi9zcmMvaW5kZXguanMiLCJpbXBvcnQgRmlsdGVyIGZyb20gJy4vZmlsdGVycy5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERydXBhbENsaWVudCB7XG5cbiAgY29uc3RydWN0b3IoYmFzZVVybCwge2xvZ2dlciA9IGNvbnNvbGUsIGF1dGhvcml6YXRpb24gPSBudWxsfSA9IHt9KSB7XG4gICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcbiAgICB0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcbiAgICB0aGlzLmF1dGhvcml6YXRpb24gPSBhdXRob3JpemF0aW9uO1xuICB9XG5cbiAgYXN5bmMgZ2V0KHR5cGUsIGlkKSB7XG4gICAgY29uc3QgbGluayA9IGAke2F3YWl0IHRoaXMuZ2V0TGluayh0eXBlKX0vJHtpZH1gO1xuICAgIHJldHVybiB0aGlzLmRvY3VtZW50RGF0YShhd2FpdCB0aGlzLmZldGNoRG9jdW1lbnQobGluaykpO1xuICB9XG5cbiAgYXN5bmMgYWxsKHR5cGUsIHsgbGltaXQgPSAtMSwgc29ydCA9ICcnLCBmaWx0ZXIgPSAnJywgcmVsYXRpb25zaGlwcyA9IG51bGx9ID0ge30pIHtcbiAgICBsZXQgbGluayA9IGF3YWl0IHRoaXMuY29sbGVjdGlvbkxpbmsodHlwZSwge3NvcnQsIGZpbHRlciwgcGFnZTogJ3BhZ2VbbGltaXRdPTUwJ30pO1xuICAgIGxldCBleHBhbmRlZCA9IHRoaXMuZXhwYW5kUmVsYXRpb25zaGlwcyhyZWxhdGlvbnNoaXBzKTtcbiAgICByZXR1cm4gdGhpcy5wYWdpbmF0ZShsaW5rLCBsaW1pdCwgZXhwYW5kZWQpO1xuICB9XG5cbiAgZXhwYW5kUmVsYXRpb25zaGlwcyhyZWxhdGlvbnNoaXBzKSB7XG4gICAgY29uc3QgZXhwYW5kZXIgPSAobm9kZSkgPT4ge1xuICAgICAgcmV0dXJuIHR5cGVvZiBub2RlID09PSAnc3RyaW5nJ1xuICAgICAgICA/IHtmaWVsZDogbm9kZX1cbiAgICAgICAgOiBub2RlO1xuICAgIH07XG4gICAgY29uc3Qgb2JqZWN0TWFwcGVyID0gKG5vZGUsIG1hcHBlciwgaW5pdGlhbCkgPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG5vZGUpLnJlZHVjZSgobWFwcGVkLCBwcm9wKSA9PiB7XG4gICAgICAgIG1hcHBlZFtwcm9wXSA9IG1hcHBlcihub2RlW3Byb3BdKTtcbiAgICAgICAgaWYgKG5vZGVbcHJvcF0ucmVsYXRpb25zaGlwcykge1xuICAgICAgICAgIG1hcHBlZFtwcm9wXS5yZWxhdGlvbnNoaXBzID0gb2JqZWN0TWFwcGVyKG5vZGVbcHJvcF0ucmVsYXRpb25zaGlwcywgbWFwcGVyLCB7fSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWFwcGVkO1xuICAgICAgfSwge30pO1xuICAgIH07XG4gICAgcmV0dXJuIG9iamVjdE1hcHBlcihyZWxhdGlvbnNoaXBzLCBleHBhbmRlciwge30pO1xuICB9XG5cbiAgcGFnaW5hdGUobGluaywgbGltaXQsIHJlbGF0aW9uc2hpcHMpIHtcbiAgICB2YXIgYnVmZmVyID0gW107XG4gICAgdmFyIHRvdGFsID0gMDtcbiAgICBjb25zdCBpbkZsaWdodCA9IG5ldyBTZXQoW10pO1xuXG4gICAgY29uc3QgaGVhZGVycyA9IHt9O1xuICAgIGlmIChyZWxhdGlvbnNoaXBzKSB7XG4gICAgICAvLyYmIHJlbGF0aW9uc2hpcHMudGFncyAmJiByZWxhdGlvbnNoaXBzLnRhZ3MuZmllbGQgPT09ICdmaWVsZF90YWdzJykge1xuICAgICAgY29uc3QgcGF0aHMgPSBbXTtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHJlbGF0aW9uc2hpcHMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICAgIHBhdGhzLnB1c2goYC5kYXRhLltdLnJlbGF0aW9uc2hpcHMuJHtyZWxhdGlvbnNoaXBzW25hbWVdLmZpZWxkfS5saW5rcy5yZWxhdGVkYCk7XG4gICAgICB9KTtcbiAgICAgIGlmIChwYXRocy5sZW5ndGgpIHtcbiAgICAgICAgaGVhZGVyc1sneC1wdXNoLXBsZWFzZSddID0gcGF0aHMuam9pbignOyAnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBkb1JlcXVlc3QgPSBuZXh0TGluayA9PiB7XG4gICAgICBpbkZsaWdodC5hZGQobmV4dExpbmspO1xuICAgICAgcmV0dXJuIHRoaXMuZmV0Y2hEb2N1bWVudChuZXh0TGluaywgaGVhZGVycykudGhlbihkb2MgPT4ge1xuICAgICAgICBpbkZsaWdodC5kZWxldGUobmV4dExpbmspO1xuICAgICAgICBsaW5rID0gZG9jLmxpbmtzLm5leHQgfHwgZmFsc2U7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRvY3VtZW50RGF0YShkb2MpO1xuICAgICAgICBjb25zdCByZXNvdXJjZXMgPSBBcnJheS5pc0FycmF5KGRhdGEpID8gZGF0YSA6IFtkYXRhXTtcbiAgICAgICAgdG90YWwgKz0gKHJlc291cmNlcykgPyByZXNvdXJjZXMubGVuZ3RoIDogMDtcbiAgICAgICAgYnVmZmVyLnB1c2goLi4uKHJlc291cmNlcyB8fCBbXSkpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGJ1ZmZlcik7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgdmFyIGNvbGxlY3Rpb25SZXF1ZXN0cyA9IFtdO1xuICAgIGNvbnN0IGFkdmFuY2UgPSAoKSA9PiB7XG4gICAgICBpZiAobGluayAmJiAhaW5GbGlnaHQuaGFzKGxpbmspICYmIChsaW1pdCA9PT0gLTEgfHwgdG90YWwgPCBsaW1pdCkpIHtcbiAgICAgICAgY29sbGVjdGlvblJlcXVlc3RzLnB1c2goZG9SZXF1ZXN0KGxpbmspKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAhYnVmZmVyLmxlbmd0aCAmJiBjb2xsZWN0aW9uUmVxdWVzdHMubGVuZ3RoXG4gICAgICAgID8gY29sbGVjdGlvblJlcXVlc3RzLnNoaWZ0KCkudGhlbigoKSA9PiBidWZmZXIpXG4gICAgICAgIDogUHJvbWlzZS5yZXNvbHZlKGJ1ZmZlcik7XG4gICAgfTtcblxuICAgIGxldCBjb3VudCA9IDA7XG4gICAgY29uc3QgY3Vyc29yID0gKGZ1bmN0aW9uKigpIHtcbiAgICAgIHdoaWxlIChidWZmZXIubGVuZ3RoIHx8IGluRmxpZ2h0LnNpemUgfHwgbGluaykge1xuICAgICAgICB5aWVsZCBsaW1pdCA9PT0gLTEgfHwgY291bnQgPCBsaW1pdCA/IGFkdmFuY2UoKS50aGVuKGJ1ZmZlciA9PiB7XG4gICAgICAgICAgY291bnQrKztcbiAgICAgICAgICBjb25zdCByZXNvdXJjZSA9IGJ1ZmZlci5zaGlmdCgpO1xuICAgICAgICAgIHJldHVybiByZXNvdXJjZSB8fCBudWxsO1xuICAgICAgICB9KSA6IGZhbHNlO1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgY3Vyc29yLmNhbkNvbnRpbnVlID0gKCkgPT4gYnVmZmVyLmxlbmd0aCB8fCBpbkZsaWdodC5zaXplIHx8IGxpbms7XG4gICAgY3Vyc29yLmFkZE1vcmUgPSAobWFueSA9IC0xKSA9PiBtYW55ID09PSAtMSA/IChsaW1pdCA9IC0xKSA6IChsaW1pdCArPSBtYW55KTtcblxuICAgIGlmIChsaW5rICYmICFpbkZsaWdodC5oYXMobGluaykgJiYgKGxpbWl0ID09PSAtMSB8fCB0b3RhbCA8IGxpbWl0KSkge1xuICAgICAgY29sbGVjdGlvblJlcXVlc3RzLnB1c2goZG9SZXF1ZXN0KGxpbmspKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy50b0NvbnN1bWVyKGN1cnNvciwgcmVsYXRpb25zaGlwcyk7XG4gIH1cblxuICB0b0NvbnN1bWVyKGN1cnNvciwgcmVsYXRpb25zaGlwcyA9IG51bGwpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgY29uc3VtZTogZnVuY3Rpb24oY29uc3VtZXIsIHByZXNlcnZlT3JkZXIgPSBmYWxzZSkge1xuICAgICAgICBjb25zdCBxdWV1ZSA9IFtdO1xuICAgICAgICBjb25zdCBxdWV1ZWRDb25zdW1lciA9IChyZXNvdXJjZSwgcmVsYXRpb25zaGlwcykgPT4ge1xuICAgICAgICAgIHF1ZXVlLnB1c2gocHJlc2VydmVPcmRlclxuICAgICAgICAgICAgPyAoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiByZWxhdGlvbnNoaXBzID8gY29uc3VtZXIocmVzb3VyY2UsIHJlbGF0aW9uc2hpcHMpIDogY29uc3VtZXIocmVzb3VyY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgOiByZWxhdGlvbnNoaXBzID8gY29uc3VtZXIocmVzb3VyY2UsIHJlbGF0aW9uc2hpcHMpIDogY29uc3VtZXIocmVzb3VyY2UpKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkZWNvcmF0ZWRDb25zdW1lciA9IHNlbGYuZGVjb3JhdGVXaXRoUmVsYXRpb25zaGlwcyhxdWV1ZWRDb25zdW1lciwgcmVsYXRpb25zaGlwcyk7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY29uc3QgZiA9IG5leHQgPT4ge1xuICAgICAgICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgICAgICAgLy8gQG5vdGU6IHVzaW5nIGFzeW5jL2F3YWl0IGZvciB0aGlzICd0aGVuJyBjYXVzZWQgYnJvd3NlciBjcmFzaGVzLlxuICAgICAgICAgICAgICBuZXh0LnRoZW4ocmVzb3VyY2UgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZSApIGRlY29yYXRlZENvbnN1bWVyKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICBmKGN1cnNvci5uZXh0KCkudmFsdWUpO1xuICAgICAgICAgICAgICB9KS5jYXRjaChyZWplY3QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgUHJvbWlzZS5hbGwocXVldWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoY3Vyc29yLmNhbkNvbnRpbnVlKCkgPyBjdXJzb3IuYWRkTW9yZSA6IGZhbHNlKTtcbiAgICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIGYoY3Vyc29yLm5leHQoKS52YWx1ZSk7XG4gICAgICAgIH0pLnRoZW4obmV4dCA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGlmIChwcmVzZXJ2ZU9yZGVyKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBsZXQgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgIGxldCByZXQgPSBmbigpO1xuICAgICAgICAgICAgICAgIGlmIChyZXQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgICAgICAgICAgICBhd2FpdCByZXQuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc29sdmUobmV4dCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgZGVidWdnZXIoKSB7XG4gICAgcmV0dXJuIChlcnJvcikgPT4ge1xuICAgICAgLy8gQHRvZG86IHRoaXMgc2hvdWxkIGFjdHVhbGx5IGNoZWNrIGZvciBlcnJvcnMuanNvbmFwaVxuICAgICAgaWYgKGVycm9yLmVycm9ycykge1xuICAgICAgICBjb25zdCBsb2dFcnJvciA9IGVycm9yID0+IHtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKGAke2Vycm9yLnRpdGxlfTogJHtlcnJvci5kZXRhaWx9LiAlc2AsIGVycm9yLmxpbmtzLmluZm8pO1xuICAgICAgICB9XG4gICAgICAgIGVycm9yLmVycm9ycy5mb3JFYWNoKGxvZ0Vycm9yKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICAvL3RoaXMubG9nZ2VyLmxvZyhlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZGVjb3JhdGVXaXRoUmVsYXRpb25zaGlwcyhjb25zdW1lciwgcmVsYXRpb25zaGlwcyA9IG51bGwpIHtcbiAgICBjb25zdCBkZWNvcmF0ZWQgPSAhcmVsYXRpb25zaGlwc1xuICAgICAgPyBjb25zdW1lclxuICAgICAgOiByZXNvdXJjZSA9PiB7XG4gICAgICAgIGNvbnN0IG1pcnJvciA9IHt9O1xuICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhyZWxhdGlvbnNoaXBzKS5mb3JFYWNoKHJlbGF0aW9uc2hpcCA9PiB7XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gcmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBdO1xuICAgICAgICAgIGxldCBwYXRoID0gW10sIGxpbms7XG4gICAgICAgICAgbWlycm9yW3JlbGF0aW9uc2hpcF0gPSAobGluayA9IGV4dHJhY3RWYWx1ZShgcmVsYXRpb25zaGlwcy4ke3RhcmdldC5maWVsZH0ubGlua3MucmVsYXRlZGAsIHJlc291cmNlKSlcbiAgICAgICAgICAgID8gdGhpcy5wYWdpbmF0ZShsaW5rLCB0YXJnZXQubGltaXQgfHwgLTEsIHRhcmdldC5yZWxhdGlvbnNoaXBzIHx8IG51bGwpXG4gICAgICAgICAgICA6IFByb21pc2UucmVqZWN0KCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY29uc3VtZXIocmVzb3VyY2UsIG1pcnJvcik7XG4gICAgICB9O1xuICAgIHJldHVybiBkZWNvcmF0ZWQ7XG4gIH1cblxuICBmZXRjaERvY3VtZW50KHVybCwgaGVhZGVycyA9IHt9LCBvdmVycmlkZXMgPSB7fSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKE9iamVjdC5hc3NpZ24oe1xuICAgICAgICAnYWNjZXB0JzogJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbicsXG4gICAgICB9LCBoZWFkZXJzKSksXG4gICAgICAvL30pKSxcbiAgICB9LCBvdmVycmlkZXMpO1xuICAgIGlmICh0aGlzLmF1dGhvcml6YXRpb24pIHtcbiAgICAgIG9wdGlvbnMuaGVhZGVycy5zZXQoJ2F1dGhvcml6YXRpb24nLCB0aGlzLmF1dGhvcml6YXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gZmV0Y2godXJsLCBvcHRpb25zKS50aGVuKHJlcyA9PiB7XG4gICAgICBpZiAocmVzLm9rKSB7XG4gICAgICAgIHJldHVybiByZXMuanNvbigpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAoXywgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgcmVqZWN0KGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4geyByZWplY3QocmVzLnN0YXR1c1RleHQpOyB9KSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZG9jdW1lbnREYXRhKGRvYykge1xuICAgIGlmIChkb2MuaGFzT3duUHJvcGVydHkoJ2RhdGEnKSkge1xuICAgICAgcmV0dXJuIGRvYy5kYXRhO1xuICAgIH1cbiAgICBpZiAoZG9jLmhhc093blByb3BlcnR5KCdlcnJvcnMnKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGRvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIHNlcnZlciByZXR1cm5lZCBhbiB1bnByb2Nlc3NhYmxlIGRvY3VtZW50IHdpdGggbm8gZGF0YSBvciBlcnJvcnMuJyk7XG4gICAgfVxuICB9XG5cbiAgZ2V0TGluayh0eXBlLCBoZWFkZXJzID0ge30sIG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICghdGhpcy5saW5rcykge1xuICAgICAgdGhpcy5saW5rcyA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy5mZXRjaERvY3VtZW50KGAke3RoaXMuYmFzZVVybH0vanNvbmFwaWAsIGhlYWRlcnMsIG9wdGlvbnMpXG4gICAgICAgICAgLnRoZW4oZG9jID0+IHJlc29sdmUoZG9jLmxpbmtzIHx8IHt9KSlcbiAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgIHRoaXMubG9nZ2VyLmxvZygnVW5hYmxlIHRvIHJlc29sdmUgcmVzb3VyY2UgbGlua3MuJyk7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5saW5rcy50aGVuKGxpbmtzID0+IHtcbiAgICAgIGlmICghbGlua3MuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgUHJvbWlzZS5yZWplY3QoYCcke3R5cGV9JyBpcyBub3QgYSB2YWxpZCB0eXBlIGZvciAke3RoaXMuYmFzZVVybH0uYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbGlua3NbdHlwZV07XG4gICAgfSk7XG4gIH1cblxuICBmaWx0ZXIoZikge1xuICAgIHJldHVybiBuZXcgRmlsdGVyKGYpO1xuICB9XG5cbiAgYXN5bmMgY29sbGVjdGlvbkxpbmsodHlwZSwge3NvcnQsIGZpbHRlciwgcGFnZX0gPSB7fSkge1xuICAgIGxldCBxdWVyeSA9ICcnO1xuICAgIHF1ZXJ5ICs9IGZpbHRlci5sZW5ndGggPyBgPyR7ZmlsdGVyfWAgOiAnJztcbiAgICBxdWVyeSArPSBzb3J0Lmxlbmd0aCA/IGAke3F1ZXJ5Lmxlbmd0aCA/ICcmJyA6ICc/J31zb3J0PSR7c29ydH1gIDogJyc7XG4gICAgcXVlcnkgKz0gcGFnZS5sZW5ndGggPyBgJHtxdWVyeS5sZW5ndGggPyAnJicgOiAnPyd9JHtwYWdlfWAgOiAnJztcbiAgICBjb25zdCBoZWFkZXJzID0ge1xuICAgICAgJ3gtcHVzaC1wbGVhc2UnOiBgLmxpbmtzLiR7dHlwZX0ke3F1ZXJ5fWAsXG4gICAgfVxuICAgIHJldHVybiBgJHthd2FpdCB0aGlzLmdldExpbmsodHlwZSwgaGVhZGVycywge2NyZWRlbnRpYWxzOiAnaW5jbHVkZSd9KX0ke3F1ZXJ5fWA7XG4gIH1cblxufVxuXG5mdW5jdGlvbiBleHRyYWN0VmFsdWUocGF0aCwgb2JqKSB7XG4gIHJldHVybiBwYXRoLnNwbGl0KCcuJykucmVkdWNlKChleGlzdHMsIHBhcnQpID0+IGV4aXN0cyAmJiBleGlzdHMuaGFzT3duUHJvcGVydHkocGFydCkgPyBleGlzdHNbcGFydF0gOiBmYWxzZSwgb2JqKTtcbn1cblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9saWIvaW5kZXguanMiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBGaWx0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGYpIHtcbiAgICB0aGlzLmNvbmRpdGlvbnMgPSBmKENvbmRpdGlvbnMsIChrZXkpID0+IChwYXJhbWV0ZXJzKSA9PiBwYXJhbWV0ZXJzW2tleV0pO1xuICB9XG5cbiAgY29tcGlsZShwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgaWQgPSBmdW5jdGlvbiogKCkge1xuICAgICAgbGV0IGNvdW50ZXIgPSAxO1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgeWllbGQgY291bnRlcisrO1xuICAgICAgfVxuICAgIH0oKTtcblxuICAgIGNvbnN0IGNvbXBpbGVyID0gKGFjYywgaXRlbSwgXywgcGFyZW50SUQgPSBudWxsKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50SUQgPSBpZC5uZXh0KCkudmFsdWU7XG4gICAgICBjb25zdCBwcmVmaXggPSBhY2MubGVuZ3RoID8gYCR7YWNjfSZgIDogJyc7XG4gICAgICBpZiAoaXRlbS5tZW1iZXJzKSB7XG4gICAgICAgIGNvbnN0IHJvb3QgPSBgZmlsdGVyWyR7Y3VycmVudElEfV1bZ3JvdXBdYDtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHBhcmVudElEXG4gICAgICAgICAgPyBgJHtyb290fVtjb25qdW5jdGlvbl09JHtpdGVtLmNvbmp1bmN0aW9ufSYke3Jvb3R9W21lbWJlck9mXT0ke3BhcmVudElEfWBcbiAgICAgICAgICA6IGAke3Jvb3R9W2Nvbmp1bmN0aW9uXT0ke2l0ZW0uY29uanVuY3Rpb259YDtcbiAgICAgICAgcmV0dXJuIGAke3ByZWZpeH0ke2l0ZW0ubWVtYmVycy5yZWR1Y2UoKGFjYywgaXRlbSwgXykgPT4gY29tcGlsZXIoYWNjLCBpdGVtLCBfLCBjdXJyZW50SUQpLCBzZWxmKX1gO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IHJvb3QgPSBgZmlsdGVyWyR7Y3VycmVudElEfV1bY29uZGl0aW9uXWA7XG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZCA9IENvbmRpdGlvbnMucHJvY2VzcyhpdGVtLCBwYXJhbWV0ZXJzKTtcbiAgICAgICAgbGV0IHNlbGYgPSAnJztcbiAgICAgICAgc2VsZiArPSBgJHtyb290fVtwYXRoXT0ke2VuY29kZVVSSUNvbXBvbmVudChwcm9jZXNzZWQucGF0aCl9YDtcbiAgICAgICAgaWYgKENvbmRpdGlvbnMudW5hcnlPcGVyYXRvcnMuaGFzKHByb2Nlc3NlZC5vcGVyYXRvcikpIHtcbiAgICAgICAgICBzZWxmICs9IGAmJHtyb290fVt2YWx1ZV09JHtlbmNvZGVVUklDb21wb25lbnQocHJvY2Vzc2VkLnZhbHVlKX1gO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFDb25kaXRpb25zLm51bGxPcGVyYXRvcnMuaGFzKHByb2Nlc3NlZC5vcGVyYXRvcikpIHtcbiAgICAgICAgICBwcm9jZXNzZWQudmFsdWUuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgICAgICAgIHNlbGYgKz0gYCYke3Jvb3R9W3ZhbHVlXVtdPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGl0ZW0pfWA7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZiArPSBgJiR7cm9vdH1bb3BlcmF0b3JdPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHByb2Nlc3NlZC5vcGVyYXRvcil9YDtcbiAgICAgICAgcmV0dXJuIHBhcmVudElEXG4gICAgICAgICAgPyBgJHtwcmVmaXh9JHtzZWxmfSYke3Jvb3R9W21lbWJlck9mXT0ke3BhcmVudElEfWBcbiAgICAgICAgICA6IGAke3ByZWZpeH0ke3NlbGZ9YDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBpbGVyKCcnLCB0aGlzLmNvbmRpdGlvbnMpO1xuICB9XG5cbn1cblxuY29uc3QgR3JvdXBzID0ge1xuXG4gIGFuZDogKC4uLm1lbWJlcnMpID0+IHtcbiAgICByZXR1cm4gR3JvdXBzLmdyb3VwKG1lbWJlcnMsICdBTkQnKTtcbiAgfSxcblxuICBvcjogKC4uLm1lbWJlcnMpID0+IHtcbiAgICByZXR1cm4gR3JvdXBzLmdyb3VwKG1lbWJlcnMsICdPUicpO1xuICB9LFxuXG4gIGdyb3VwOiAobWVtYmVycywgY29uanVuY3Rpb24pID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uanVuY3Rpb24sXG4gICAgICBtZW1iZXJzLFxuICAgIH1cbiAgfSxcblxufVxuXG5jb25zdCBDb25kaXRpb25zID0gZnVuY3Rpb24gKHBhdGgsIHZhbHVlKSB7XG4gIHJldHVybiBDb25kaXRpb25zLmVxKHBhdGgsIHZhbHVlKTtcbn1cblxuQ29uZGl0aW9ucy5hbmQgPSBHcm91cHMuYW5kO1xuXG5Db25kaXRpb25zLm9yID0gR3JvdXBzLm9yO1xuXG5Db25kaXRpb25zLmVxID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJz0nKTtcbn1cblxuQ29uZGl0aW9ucy5ub3RFcSA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICc8PicpO1xufVxuXG5Db25kaXRpb25zLmd0ID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJz4nKTtcbn1cblxuQ29uZGl0aW9ucy5ndEVxID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJz49Jyk7XG59XG5cbkNvbmRpdGlvbnMubHQgPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnPCcpO1xufVxuXG5Db25kaXRpb25zLmx0RXEgPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnPD0nKTtcbn1cblxuQ29uZGl0aW9ucy5zdGFydHNXaXRoID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJ1NUQVJUU19XSVRIJyk7XG59XG5cbkNvbmRpdGlvbnMuY29udGFpbnMgPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnQ09OVEFJTlMnKTtcbn1cblxuQ29uZGl0aW9ucy5lbmRzV2l0aCA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICdFTkRTX1dJVEgnKTtcbn1cblxuQ29uZGl0aW9ucy5pbiA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICdJTicpO1xufVxuXG5Db25kaXRpb25zLm5vdEluID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJ05PVCBJTicpO1xufVxuXG5Db25kaXRpb25zLmJldHdlZW4gPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnQkVUV0VFTicpO1xufVxuXG5Db25kaXRpb25zLm5vdEJldHdlZW4gPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnTk9UIEJFVFdFRU4nKTtcbn1cblxuQ29uZGl0aW9ucy5udWxsID0gKHBhdGgpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHVuZGVmaW5lZCwgJ0lTIE5VTEwnKTtcbn1cblxuQ29uZGl0aW9ucy5ub3ROdWxsID0gKHBhdGgpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHVuZGVmaW5lZCwgJ0lTIE5PVCBOVUxMJyk7XG59XG5cbkNvbmRpdGlvbnMuY29uZGl0aW9uID0gKHBhdGgsIHZhbHVlLCBvcGVyYXRvcikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy52YWxpZGF0ZSh7cGF0aCwgdmFsdWUsIG9wZXJhdG9yfSk7XG59XG5cbkNvbmRpdGlvbnMudW5hcnlPcGVyYXRvcnMgPSBuZXcgU2V0KFsnPScsICc8PicsICc+JywgJz49JywgJzwnLCAnPD0nLCAnU1RBUlRTX1dJVEgnLCAnQ09OVEFJTlMnLCAnRU5EU19XSVRIJ10pO1xuQ29uZGl0aW9ucy51bmFyeVZhbHVlVHlwZXMgPSBuZXcgU2V0KFsnc3RyaW5nJywgJ2Jvb2xlYW4nLCAnbnVtYmVyJ10pO1xuQ29uZGl0aW9ucy5iaW5hcnlPcGVyYXRvcnMgPSBuZXcgU2V0KFsnQkVUV0VFTicsICdOT1QgQkVUV0VFTiddKTtcbkNvbmRpdGlvbnMuc3RyaW5nT3BlcmF0b3JzID0gbmV3IFNldChbJ1NUQVJUU19XSVRIJywgJ0NPTlRBSU5TJywgJ0VORFNfV0lUSCddKTtcbkNvbmRpdGlvbnMubnVsbE9wZXJhdG9ycyA9IG5ldyBTZXQoWydJUyBOVUxMJywgJ0lTIE5PVCBOVUxMJ10pO1xuXG5Db25kaXRpb25zLnZhbGlkYXRlID0gKGNvbmRpdGlvbikgPT4ge1xuICBpZiAoY29uZGl0aW9uLm9wZXJhdG9yIGluc3RhbmNlb2YgRnVuY3Rpb24gfHwgY29uZGl0aW9uLnZhbHVlIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICByZXR1cm4gY29uZGl0aW9uO1xuICB9XG4gIGlmIChDb25kaXRpb25zLm51bGxPcGVyYXRvcnMuaGFzKGNvbmRpdGlvbi5vcGVyYXRvcikpIHtcbiAgICBpZiAodHlwZW9mIGNvbmRpdGlvbi52YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ29uZGl0aW9ucyB3aXRoIGFuICcke2NvbmRpdGlvbi5vcGVyYXRvcn0nIG9wZXJhdG9yIG11c3Qgbm90IHNwZWNpZnkgYSB2YWx1ZS5gKTtcbiAgICB9XG4gIH1cbiAgZWxzZSBpZiAoQ29uZGl0aW9ucy51bmFyeU9wZXJhdG9ycy5oYXMoY29uZGl0aW9uLm9wZXJhdG9yKSkge1xuICAgIGlmICghQ29uZGl0aW9ucy51bmFyeVZhbHVlVHlwZXMuaGFzKHR5cGVvZiBjb25kaXRpb24udmFsdWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSAnJHtjb25kaXRpb24ub3BlcmF0b3J9JyBvcGVyYXRvciByZXF1aXJlcyBhIHNpbmdsZSB2YWx1ZS5gKTtcbiAgICB9XG4gICAgaWYgKENvbmRpdGlvbnMuc3RyaW5nT3BlcmF0b3JzLmhhcyhjb25kaXRpb24ub3BlcmF0b3IpICYmIHR5cGVvZiBjb25kaXRpb24udmFsdWUgIT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICcke2NvbmRpdGlvbi5vcGVyYXRvcn0nIG9wZXJhdG9yIHJlcXVpcmVzIHRoYXQgdGhlIGNvbmRpdGlvbiB2YWx1ZSBiZSBhIHN0cmluZy5gKTtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGNvbmRpdGlvbi52YWx1ZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICcke2NvbmRpdGlvbi5vcGVyYXRvcn0nIG9wZXJhdG9yIHJlcXVpcmVzIGFuIGFycmF5IG9mIHZhbHVlcy5gKTtcbiAgICB9XG4gICAgaWYgKENvbmRpdGlvbnMuYmluYXJ5T3BlcmF0b3JzLmhhcyhjb25kaXRpb24ub3BlcmF0b3IpICYmIGNvbmRpdGlvbi52YWx1ZS5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICcke2NvbmRpdGlvbi5vcGVyYXRvcn0nIG9wZXJhdG9yIHJlcXVpcmVzIGFuIGFycmF5IG9mIGV4YWN0bHkgMiB2YWx1ZXMuYCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBjb25kaXRpb247XG59XG5cbkNvbmRpdGlvbnMucHJvY2VzcyA9IChjb25kaXRpb24sIHBhcmFtZXRlcnMpID0+IHtcbiAgbGV0IHJldmFsaWRhdGUgPSBmYWxzZTtcbiAgY29uc3QgcmVwbGFjZSA9IChpdGVtKSA9PiB7XG4gICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgcmV2YWxpZGF0ZSA9IHRydWU7XG4gICAgICByZXR1cm4gaXRlbShwYXJhbWV0ZXJzKTtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cbiAgY29uc3QgcHJvY2Vzc2VkID0ge1xuICAgIHBhdGg6IHJlcGxhY2UoY29uZGl0aW9uLnBhdGgpLFxuICAgIG9wZXJhdG9yOiByZXBsYWNlKGNvbmRpdGlvbi5vcGVyYXRvciksXG4gIH1cbiAgaWYgKCFDb25kaXRpb25zLm51bGxPcGVyYXRvcnMuaGFzKHByb2Nlc3NlZC5vcGVyYXRvcikpIHtcbiAgICBwcm9jZXNzZWQudmFsdWUgPSByZXBsYWNlKGNvbmRpdGlvbi52YWx1ZSk7XG4gIH1cbiAgaWYgKHJldmFsaWRhdGUpIHtcbiAgICBDb25kaXRpb25zLnZhbGlkYXRlKHByb2Nlc3NlZCk7XG4gIH1cbiAgcmV0dXJuIHByb2Nlc3NlZDtcbn1cblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9saWIvZmlsdGVycy5qcyJdLCJzb3VyY2VSb290IjoiIn0=