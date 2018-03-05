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

const client = new __WEBPACK_IMPORTED_MODULE_0__lib__["a" /* default */]('http://jsonapi.test:8080', {
  authorization: `Basic ${btoa('root:root')}`
});

(async () => {
  const options = {
    limit: 3,
    sort: 'title',
    relationships: {
      tags: {
        field: 'field_tags',
        relationships: {
          vocabulary: 'vid'
        }
      }
    }
  }; //options.filter = filter.compile({paramOne: 'easy'});

  const feed = await client.all('node--recipe', options);
  let next = await feed.consume(logRecipe('Initial'));

  while (next) {
    next(options.limit);
    next = await feed.consume(logRecipe('Subsequent'));
  }
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
    this.links = new Promise((resolve, reject) => {
      this.fetchDocument(`${baseUrl}/jsonapi`).then(doc => resolve(doc.links || {})).catch(err => {
        this.logger.log('Unable to resolve resource links.');
        reject(err);
      });
    });
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

    const doRequest = nextLink => {
      inFlight.add(nextLink);
      return this.fetchDocument(nextLink).then(doc => {
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

        const filteringConsumer = resource => {
          return resource ? decoratedConsumer(resource) : null;
        };

        return new Promise((resolve, reject) => {
          const f = next => {
            if (next) {
              // @note: using async/await for this 'then' caused browser crashes.
              next.then(resource => {
                filteringConsumer(resource);
                f(cursor.next().value);
              }).catch(reject);
            } else {
              if (preserveOrder) {
                Promise.all(queue).then(() => {
                  resolve(cursor.canContinue() ? cursor.addMore : false);
                });
              } else {
                resolve(cursor.canContinue() ? cursor.addMore : false);
              }
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

  fetchDocument(url) {
    const options = this.authorization ? {
      headers: new Headers({
        authorization: this.authorization
      })
    } : {};
    return fetch(url, options).then(res => {
      if (res.ok) {
        return res.json();
      } else {
        reject(res.statusText); //return new Promise(async (resolve, reject) => {
        //  //let doc = await res.json().catch(() => reject(res.statusText));
        //  reject(doc);
        //});
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

  getLink(type) {
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
    return `${await this.getLink(type)}${query}`;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgMTQ5ZmQwNTQ0ZTY2Y2Q0YmQxNzciLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbImNsaWVudCIsImF1dGhvcml6YXRpb24iLCJidG9hIiwib3B0aW9ucyIsImxpbWl0Iiwic29ydCIsInJlbGF0aW9uc2hpcHMiLCJ0YWdzIiwiZmllbGQiLCJ2b2NhYnVsYXJ5IiwiZmVlZCIsImFsbCIsIm5leHQiLCJjb25zdW1lIiwibG9nUmVjaXBlIiwiZmlsdGVyIiwiYyIsInBhcmFtIiwiYW5kIiwib3IiLCJjb250YWlucyIsInN0YXJ0c1dpdGgiLCJsYWJlbCIsInJlY2lwZSIsInZvY2FicyIsInRhZyIsInB1c2giLCJhdHRyaWJ1dGVzIiwibmFtZSIsInZvY2FiIiwiY29uc29sZSIsImdyb3VwQ29sbGFwc2VkIiwidGl0bGUiLCJsb2ciLCJsZW5ndGgiLCJqb2luIiwiZ3JvdXBFbmQiLCJEcnVwYWxDbGllbnQiLCJjb25zdHJ1Y3RvciIsImJhc2VVcmwiLCJsb2dnZXIiLCJsaW5rcyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZmV0Y2hEb2N1bWVudCIsInRoZW4iLCJkb2MiLCJjYXRjaCIsImVyciIsImdldCIsInR5cGUiLCJpZCIsImxpbmsiLCJnZXRMaW5rIiwiZG9jdW1lbnREYXRhIiwiY29sbGVjdGlvbkxpbmsiLCJwYWdlIiwiZXhwYW5kZWQiLCJleHBhbmRSZWxhdGlvbnNoaXBzIiwicGFnaW5hdGUiLCJleHBhbmRlciIsIm5vZGUiLCJvYmplY3RNYXBwZXIiLCJtYXBwZXIiLCJpbml0aWFsIiwiT2JqZWN0IiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsInJlZHVjZSIsIm1hcHBlZCIsInByb3AiLCJidWZmZXIiLCJ0b3RhbCIsImluRmxpZ2h0IiwiU2V0IiwiZG9SZXF1ZXN0IiwibmV4dExpbmsiLCJhZGQiLCJkZWxldGUiLCJkYXRhIiwicmVzb3VyY2VzIiwiQXJyYXkiLCJpc0FycmF5IiwiY29sbGVjdGlvblJlcXVlc3RzIiwiYWR2YW5jZSIsImhhcyIsInNoaWZ0IiwiY291bnQiLCJjdXJzb3IiLCJzaXplIiwicmVzb3VyY2UiLCJjYW5Db250aW51ZSIsImFkZE1vcmUiLCJtYW55IiwidG9Db25zdW1lciIsInNlbGYiLCJjb25zdW1lciIsInByZXNlcnZlT3JkZXIiLCJxdWV1ZSIsInF1ZXVlZENvbnN1bWVyIiwiZGVjb3JhdGVkQ29uc3VtZXIiLCJkZWNvcmF0ZVdpdGhSZWxhdGlvbnNoaXBzIiwiZmlsdGVyaW5nQ29uc3VtZXIiLCJmIiwidmFsdWUiLCJmbiIsInJldCIsImRlYnVnZ2VyIiwiZXJyb3IiLCJlcnJvcnMiLCJsb2dFcnJvciIsImluZm8iLCJkZXRhaWwiLCJmb3JFYWNoIiwiZGVjb3JhdGVkIiwibWlycm9yIiwicmVsYXRpb25zaGlwIiwidGFyZ2V0IiwicGF0aCIsImV4dHJhY3RWYWx1ZSIsInVybCIsImhlYWRlcnMiLCJIZWFkZXJzIiwiZmV0Y2giLCJyZXMiLCJvayIsImpzb24iLCJzdGF0dXNUZXh0IiwiaGFzT3duUHJvcGVydHkiLCJFcnJvciIsInF1ZXJ5Iiwib2JqIiwic3BsaXQiLCJleGlzdHMiLCJwYXJ0IiwiRmlsdGVyIiwiY29uZGl0aW9ucyIsIkNvbmRpdGlvbnMiLCJrZXkiLCJwYXJhbWV0ZXJzIiwiY29tcGlsZSIsImNvdW50ZXIiLCJjb21waWxlciIsImFjYyIsIml0ZW0iLCJfIiwicGFyZW50SUQiLCJjdXJyZW50SUQiLCJwcmVmaXgiLCJtZW1iZXJzIiwicm9vdCIsImNvbmp1bmN0aW9uIiwicHJvY2Vzc2VkIiwicHJvY2VzcyIsImVuY29kZVVSSUNvbXBvbmVudCIsInVuYXJ5T3BlcmF0b3JzIiwib3BlcmF0b3IiLCJudWxsT3BlcmF0b3JzIiwiR3JvdXBzIiwiZ3JvdXAiLCJlcSIsImNvbmRpdGlvbiIsIm5vdEVxIiwiZ3QiLCJndEVxIiwibHQiLCJsdEVxIiwiZW5kc1dpdGgiLCJpbiIsIm5vdEluIiwiYmV0d2VlbiIsIm5vdEJldHdlZW4iLCJudWxsIiwidW5kZWZpbmVkIiwibm90TnVsbCIsInZhbGlkYXRlIiwidW5hcnlWYWx1ZVR5cGVzIiwiYmluYXJ5T3BlcmF0b3JzIiwic3RyaW5nT3BlcmF0b3JzIiwiRnVuY3Rpb24iLCJyZXZhbGlkYXRlIiwicmVwbGFjZSJdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOzs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxtQ0FBMkIsMEJBQTBCLEVBQUU7QUFDdkQseUNBQWlDLGVBQWU7QUFDaEQ7QUFDQTtBQUNBOztBQUVBO0FBQ0EsOERBQXNELCtEQUErRDs7QUFFckg7QUFDQTs7QUFFQTtBQUNBOzs7Ozs7Ozs7O0FDN0RBO0FBRUEsTUFBTUEsU0FBUyxJQUFJLHFEQUFKLENBQVksMEJBQVosRUFBd0M7QUFDckRDLGlCQUFnQixTQUFRQyxLQUFLLFdBQUwsQ0FBa0I7QUFEVyxDQUF4QyxDQUFmOztBQUlBLENBQUMsWUFBWTtBQUNYLFFBQU1DLFVBQVU7QUFDZEMsV0FBTyxDQURPO0FBRWRDLFVBQU0sT0FGUTtBQUdkQyxtQkFBZTtBQUNiQyxZQUFNO0FBQ0pDLGVBQU8sWUFESDtBQUVKRix1QkFBZTtBQUNiRyxzQkFBWTtBQURDO0FBRlg7QUFETztBQUhELEdBQWhCLENBRFcsQ0FhWDs7QUFDQSxRQUFNQyxPQUFPLE1BQU1WLE9BQU9XLEdBQVAsQ0FBVyxjQUFYLEVBQTJCUixPQUEzQixDQUFuQjtBQUNBLE1BQUlTLE9BQU8sTUFBTUYsS0FBS0csT0FBTCxD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QU0rRCxRQUFRcEIsVUFBVTNDLElBQWxCLENBRFU7QUFFaEJzQyxjQUFVeUIsUUFBUXBCLFVBQVVMLFFBQWxCO0FBRk0sR0FBbEI7O0FBSUEsTUFBSSxDQUFDbkIsV0FBV29CLGFBQVgsQ0FBeUJ4RSxHQUF6QixDQUE2Qm1FLFVBQVVJLFFBQXZDLENBQUwsRUFBdUQ7QUFDckRKLGNBQVVoRCxLQUFWLEdBQWtCNkUsUUFBUXBCLFVBQVV6RCxLQUFsQixDQUFsQjtBQUNEOztBQUNELE1BQUk0RSxVQUFKLEVBQWdCO0FBQ2QzQyxlQUFXc0MsUUFBWCxDQUFvQnZCLFNBQXBCO0FBQ0Q7O0FBQ0QsU0FBT0EsU0FBUDtBQUNELENBcEJELEMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyIgXHQvLyBUaGUgbW9kdWxlIGNhY2hlXG4gXHR2YXIgaW5zdGFsbGVkTW9kdWxlcyA9IHt9O1xuXG4gXHQvLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuIFx0ZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXG4gXHRcdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuIFx0XHRpZihpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSkge1xuIFx0XHRcdHJldHVybiBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXS5leHBvcnRzO1xuIFx0XHR9XG4gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4gXHRcdHZhciBtb2R1bGUgPSBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSA9IHtcbiBcdFx0XHRpOiBtb2R1bGVJZCxcbiBcdFx0XHRsOiBmYWxzZSxcbiBcdFx0XHRleHBvcnRzOiB7fVxuIFx0XHR9O1xuXG4gXHRcdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuIFx0XHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG4gXHRcdG1vZHVsZS5sID0gdHJ1ZTtcblxuIFx0XHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuIFx0XHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gXHR9XG5cblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGVzIG9iamVjdCAoX193ZWJwYWNrX21vZHVsZXNfXylcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubSA9IG1vZHVsZXM7XG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlIGNhY2hlXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmMgPSBpbnN0YWxsZWRNb2R1bGVzO1xuXG4gXHQvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9uIGZvciBoYXJtb255IGV4cG9ydHNcbiBcdF9fd2VicGFja19yZXF1aXJlX18uZCA9IGZ1bmN0aW9uKGV4cG9ydHMsIG5hbWUsIGdldHRlcikge1xuIFx0XHRpZighX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIG5hbWUpKSB7XG4gXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIG5hbWUsIHtcbiBcdFx0XHRcdGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gXHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuIFx0XHRcdFx0Z2V0OiBnZXR0ZXJcbiBcdFx0XHR9KTtcbiBcdFx0fVxuIFx0fTtcblxuIFx0Ly8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubiA9IGZ1bmN0aW9uKG1vZHVsZSkge1xuIFx0XHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cbiBcdFx0XHRmdW5jdGlvbiBnZXREZWZhdWx0KCkgeyByZXR1cm4gbW9kdWxlWydkZWZhdWx0J107IH0gOlxuIFx0XHRcdGZ1bmN0aW9uIGdldE1vZHVsZUV4cG9ydHMoKSB7IHJldHVybiBtb2R1bGU7IH07XG4gXHRcdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsICdhJywgZ2V0dGVyKTtcbiBcdFx0cmV0dXJuIGdldHRlcjtcbiBcdH07XG5cbiBcdC8vIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbFxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5vID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpOyB9O1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcblxuIFx0Ly8gTG9hZCBlbnRyeSBtb2R1bGUgYW5kIHJldHVybiBleHBvcnRzXG4gXHRyZXR1cm4gX193ZWJwYWNrX3JlcXVpcmVfXyhfX3dlYnBhY2tfcmVxdWlyZV9fLnMgPSAwKTtcblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyB3ZWJwYWNrL2Jvb3RzdHJhcCAxNDlmZDA1NDRlNjZjZDRiZDE3NyIsImltcG9ydCBEQ2xpZW50IGZyb20gJy4vbGliJztcblxuY29uc3QgY2xpZW50ID0gbmV3IERDbGllbnQoJ2h0dHA6Ly9qc29uYXBpLnRlc3Q6ODA4MCcsIHtcbiAgYXV0aG9yaXphdGlvbjogYEJhc2ljICR7YnRvYSgncm9vdDpyb290Jyl9YCxcbn0pO1xuXG4oYXN5bmMgKCkgPT4ge1xuICBjb25zdCBvcHRpb25zID0ge1xuICAgIGxpbWl0OiAzLFxuICAgIHNvcnQ6ICd0aXRsZScsXG4gICAgcmVsYXRpb25zaGlwczoge1xuICAgICAgdGFnczoge1xuICAgICAgICBmaWVsZDogJ2ZpZWxkX3RhZ3MnLFxuICAgICAgICByZWxhdGlvbnNoaXBzOiB7XG4gICAgICAgICAgdm9jYWJ1bGFyeTogJ3ZpZCdcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfVxuICB9O1xuICAvL29wdGlvbnMuZmlsdGVyID0gZmlsdGVyLmNvbXBpbGUoe3BhcmFtT25lOiAnZWFzeSd9KTtcbiAgY29uc3QgZmVlZCA9IGF3YWl0IGNsaWVudC5hbGwoJ25vZGUtLXJlY2lwZScsIG9wdGlvbnMpO1xuICBsZXQgbmV4dCA9IGF3YWl0IGZlZWQuY29uc3VtZShsb2dSZWNpcGUoJ0luaXRpYWwnKSk7XG4gIHdoaWxlIChuZXh0KSB7XG4gICAgbmV4dChvcHRpb25zLmxpbWl0KTtcbiAgICBuZXh0ID0gYXdhaXQgZmVlZC5jb25zdW1lKGxvZ1JlY2lwZSgnU3Vic2VxdWVudCcpKVxuICB9XG59KSgpXG5cbmNvbnN0IGZpbHRlciA9IGNsaWVudC5maWx0ZXIoKGMsIHBhcmFtKSA9PiB7XG4gIHJldHVybiBjLmFuZChcbiAgICBjKCdzdGF0dXMnLCAxKSxcbiAgICBjLm9yKFxuICAgICAgYy5jb250YWlucygndGl0bGUnLCBwYXJhbSgncGFyYW1PbmUnKSksXG4gICAgICBjLnN0YXJ0c1dpdGgoJ3RpdGxlJywgJ1RoYWknKVxuICAgICksXG4gICk7XG59KTtcblxuY29uc3QgbG9nUmVjaXBlID0gbGFiZWwgPT4gYXN5bmMgKHJlY2lwZSwgcmVsYXRpb25zaGlwcykgPT4ge1xuICBsZXQgdGFncyA9IFtdO1xuICBsZXQgdm9jYWJzID0gW107XG4gIGF3YWl0IHJlbGF0aW9uc2hpcHMudGFncy5jb25zdW1lKGFzeW5jICh0YWcsIHJlbGF0aW9uc2hpcHMpID0+IHtcbiAgICB0YWdzLnB1c2godGFnLmF0dHJpYnV0ZXMubmFtZSk7XG5cbiAgICBhd2FpdCByZWxhdGlvbnNoaXBzLnZvY2FidWxhcnkuY29uc3VtZSh2b2NhYiA9PiB7XG4gICAgICB2b2NhYnMucHVzaCh2b2NhYi5hdHRyaWJ1dGVzLm5hbWUpO1xuICAgIH0pO1xuICB9KTtcblxuICBjb25zb2xlLmdyb3VwQ29sbGFwc2VkKGAke2xhYmVsfTogJHtyZWNpcGUuYXR0cmlidXRlcy50aXRsZX1gKTtcbiAgY29uc29sZS5sb2coJ0Rpc2g6JywgcmVjaXBlLmF0dHJpYnV0ZXMudGl0bGUpO1xuICBjb25zb2xlLmxvZygnVGFnczonLCB0YWdzLmxlbmd0aCA/IHRhZ3Muam9pbignLCAnKTogJ24vYScpO1xuICBjb25zb2xlLmxvZygnVm9jYWJ1bGFyaWVzOicsIHZvY2Ficy5sZW5ndGggPyB2b2NhYnMuam9pbignLCAnKTogJ24vYScpO1xuICBjb25zb2xlLmdyb3VwRW5kKGAke2xhYmVsfTogJHtyZWNpcGUuYXR0cmlidXRlcy50aXRsZX1gKTtcbn1cblxuLy9jbGllbnQuZ2V0KCdub2RlLS1yZWNpcGUnLCAnMjVjMDQ4YjYtNjllOS00NmY0LTk4NmQtNGI4MGIwMWRlMmU2Jylcbi8vICAudGhlbihsb2dSZXNvdXJjZUFzKCdJbmRpdmlkdWFsJykpXG4vLyAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUubG9nKCdFcnJvcjonLCBlcnJvcikpO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2luZGV4LmpzIiwiaW1wb3J0IEZpbHRlciBmcm9tICcuL2ZpbHRlcnMuanMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcnVwYWxDbGllbnQge1xuXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmwsIHtsb2dnZXIgPSBjb25zb2xlLCBhdXRob3JpemF0aW9uID0gbnVsbH0gPSB7fSkge1xuICAgIHRoaXMuYmFzZVVybCA9IGJhc2VVcmw7XG4gICAgdGhpcy5sb2dnZXIgPSBsb2dnZXI7XG4gICAgdGhpcy5hdXRob3JpemF0aW9uID0gYXV0aG9yaXphdGlvbjtcbiAgICB0aGlzLmxpbmtzID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5mZXRjaERvY3VtZW50KGAke2Jhc2VVcmx9L2pzb25hcGlgKVxuICAgICAgICAudGhlbihkb2MgPT4gcmVzb2x2ZShkb2MubGlua3MgfHwge30pKVxuICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5sb2coJ1VuYWJsZSB0byByZXNvbHZlIHJlc291cmNlIGxpbmtzLicpO1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIGdldCh0eXBlLCBpZCkge1xuICAgIGNvbnN0IGxpbmsgPSBgJHthd2FpdCB0aGlzLmdldExpbmsodHlwZSl9LyR7aWR9YDtcbiAgICByZXR1cm4gdGhpcy5kb2N1bWVudERhdGEoYXdhaXQgdGhpcy5mZXRjaERvY3VtZW50KGxpbmspKTtcbiAgfVxuXG4gIGFzeW5jIGFsbCh0eXBlLCB7IGxpbWl0ID0gLTEsIHNvcnQgPSAnJywgZmlsdGVyID0gJycsIHJlbGF0aW9uc2hpcHMgPSBudWxsfSA9IHt9KSB7XG4gICAgbGV0IGxpbmsgPSBhd2FpdCB0aGlzLmNvbGxlY3Rpb25MaW5rKHR5cGUsIHtzb3J0LCBmaWx0ZXIsIHBhZ2U6ICdwYWdlW2xpbWl0XT01MCd9KTtcbiAgICBsZXQgZXhwYW5kZWQgPSB0aGlzLmV4cGFuZFJlbGF0aW9uc2hpcHMocmVsYXRpb25zaGlwcyk7XG4gICAgcmV0dXJuIHRoaXMucGFnaW5hdGUobGluaywgbGltaXQsIGV4cGFuZGVkKTtcbiAgfVxuXG4gIGV4cGFuZFJlbGF0aW9uc2hpcHMocmVsYXRpb25zaGlwcykge1xuICAgIGNvbnN0IGV4cGFuZGVyID0gKG5vZGUpID0+IHtcbiAgICAgIHJldHVybiB0eXBlb2Ygbm9kZSA9PT0gJ3N0cmluZydcbiAgICAgICAgPyB7ZmllbGQ6IG5vZGV9XG4gICAgICAgIDogbm9kZTtcbiAgICB9O1xuICAgIGNvbnN0IG9iamVjdE1hcHBlciA9IChub2RlLCBtYXBwZXIsIGluaXRpYWwpID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhub2RlKS5yZWR1Y2UoKG1hcHBlZCwgcHJvcCkgPT4ge1xuICAgICAgICBtYXBwZWRbcHJvcF0gPSBtYXBwZXIobm9kZVtwcm9wXSk7XG4gICAgICAgIGlmIChub2RlW3Byb3BdLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICBtYXBwZWRbcHJvcF0ucmVsYXRpb25zaGlwcyA9IG9iamVjdE1hcHBlcihub2RlW3Byb3BdLnJlbGF0aW9uc2hpcHMsIG1hcHBlciwge30pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hcHBlZDtcbiAgICAgIH0sIHt9KTtcbiAgICB9O1xuICAgIHJldHVybiBvYmplY3RNYXBwZXIocmVsYXRpb25zaGlwcywgZXhwYW5kZXIsIHt9KTtcbiAgfVxuXG4gIHBhZ2luYXRlKGxpbmssIGxpbWl0LCByZWxhdGlvbnNoaXBzKSB7XG4gICAgdmFyIGJ1ZmZlciA9IFtdO1xuICAgIHZhciB0b3RhbCA9IDA7XG4gICAgY29uc3QgaW5GbGlnaHQgPSBuZXcgU2V0KFtdKTtcblxuICAgIGNvbnN0IGRvUmVxdWVzdCA9IG5leHRMaW5rID0+IHtcbiAgICAgIGluRmxpZ2h0LmFkZChuZXh0TGluayk7XG4gICAgICByZXR1cm4gdGhpcy5mZXRjaERvY3VtZW50KG5leHRMaW5rKS50aGVuKGRvYyA9PiB7XG4gICAgICAgIGluRmxpZ2h0LmRlbGV0ZShuZXh0TGluayk7XG4gICAgICAgIGxpbmsgPSBkb2MubGlua3MubmV4dCB8fCBmYWxzZTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuZG9jdW1lbnREYXRhKGRvYyk7XG4gICAgICAgIGNvbnN0IHJlc291cmNlcyA9IEFycmF5LmlzQXJyYXkoZGF0YSkgPyBkYXRhIDogW2RhdGFdO1xuICAgICAgICB0b3RhbCArPSAocmVzb3VyY2VzKSA/IHJlc291cmNlcy5sZW5ndGggOiAwO1xuICAgICAgICBidWZmZXIucHVzaCguLi4ocmVzb3VyY2VzIHx8IFtdKSk7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoYnVmZmVyKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICB2YXIgY29sbGVjdGlvblJlcXVlc3RzID0gW107XG4gICAgY29uc3QgYWR2YW5jZSA9ICgpID0+IHtcbiAgICAgIGlmIChsaW5rICYmICFpbkZsaWdodC5oYXMobGluaykgJiYgKGxpbWl0ID09PSAtMSB8fCB0b3RhbCA8IGxpbWl0KSkge1xuICAgICAgICBjb2xsZWN0aW9uUmVxdWVzdHMucHVzaChkb1JlcXVlc3QobGluaykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuICFidWZmZXIubGVuZ3RoICYmIGNvbGxlY3Rpb25SZXF1ZXN0cy5sZW5ndGhcbiAgICAgICAgPyBjb2xsZWN0aW9uUmVxdWVzdHMuc2hpZnQoKS50aGVuKCgpID0+IGJ1ZmZlcilcbiAgICAgICAgOiBQcm9taXNlLnJlc29sdmUoYnVmZmVyKTtcbiAgICB9O1xuXG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBjb25zdCBjdXJzb3IgPSAoZnVuY3Rpb24qKCkge1xuICAgICAgd2hpbGUgKGJ1ZmZlci5sZW5ndGggfHwgaW5GbGlnaHQuc2l6ZSB8fCBsaW5rKSB7XG4gICAgICAgIHlpZWxkIGxpbWl0ID09PSAtMSB8fCBjb3VudCA8IGxpbWl0ID8gYWR2YW5jZSgpLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgIGNvbnN0IHJlc291cmNlID0gYnVmZmVyLnNoaWZ0KCk7XG4gICAgICAgICAgcmV0dXJuIHJlc291cmNlIHx8IG51bGw7XG4gICAgICAgIH0pIDogZmFsc2U7XG4gICAgICB9XG4gICAgfSkoKTtcbiAgICBjdXJzb3IuY2FuQ29udGludWUgPSAoKSA9PiBidWZmZXIubGVuZ3RoIHx8IGluRmxpZ2h0LnNpemUgfHwgbGluaztcbiAgICBjdXJzb3IuYWRkTW9yZSA9IChtYW55ID0gLTEpID0+IG1hbnkgPT09IC0xID8gKGxpbWl0ID0gLTEpIDogKGxpbWl0ICs9IG1hbnkpO1xuXG4gICAgaWYgKGxpbmsgJiYgIWluRmxpZ2h0LmhhcyhsaW5rKSAmJiAobGltaXQgPT09IC0xIHx8IHRvdGFsIDwgbGltaXQpKSB7XG4gICAgICBjb2xsZWN0aW9uUmVxdWVzdHMucHVzaChkb1JlcXVlc3QobGluaykpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnRvQ29uc3VtZXIoY3Vyc29yLCByZWxhdGlvbnNoaXBzKTtcbiAgfVxuXG4gIHRvQ29uc3VtZXIoY3Vyc29yLCByZWxhdGlvbnNoaXBzID0gbnVsbCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiB7XG4gICAgICBjb25zdW1lOiBmdW5jdGlvbihjb25zdW1lciwgcHJlc2VydmVPcmRlciA9IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IHF1ZXVlID0gW107XG4gICAgICAgIGNvbnN0IHF1ZXVlZENvbnN1bWVyID0gKHJlc291cmNlLCByZWxhdGlvbnNoaXBzKSA9PiB7XG4gICAgICAgICAgcXVldWUucHVzaChwcmVzZXJ2ZU9yZGVyXG4gICAgICAgICAgICA/ICgpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlbGF0aW9uc2hpcHMgPyBjb25zdW1lcihyZXNvdXJjZSwgcmVsYXRpb25zaGlwcykgOiBjb25zdW1lcihyZXNvdXJjZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICA6IHJlbGF0aW9uc2hpcHMgPyBjb25zdW1lcihyZXNvdXJjZSwgcmVsYXRpb25zaGlwcykgOiBjb25zdW1lcihyZXNvdXJjZSkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlY29yYXRlZENvbnN1bWVyID0gc2VsZi5kZWNvcmF0ZVdpdGhSZWxhdGlvbnNoaXBzKHF1ZXVlZENvbnN1bWVyLCByZWxhdGlvbnNoaXBzKTtcbiAgICAgICAgY29uc3QgZmlsdGVyaW5nQ29uc3VtZXIgPSByZXNvdXJjZSA9PiB7XG4gICAgICAgICAgcmV0dXJuIChyZXNvdXJjZSkgPyBkZWNvcmF0ZWRDb25zdW1lcihyZXNvdXJjZSkgOiBudWxsO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGYgPSBuZXh0ID0+IHtcbiAgICAgICAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgICAgICAgIC8vIEBub3RlOiB1c2luZyBhc3luYy9hd2FpdCBmb3IgdGhpcyAndGhlbicgY2F1c2VkIGJyb3dzZXIgY3Jhc2hlcy5cbiAgICAgICAgICAgICAgbmV4dC50aGVuKHJlc291cmNlID0+IHtcbiAgICAgICAgICAgICAgICBmaWx0ZXJpbmdDb25zdW1lcihyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgZihjdXJzb3IubmV4dCgpLnZhbHVlKTtcbiAgICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlmIChwcmVzZXJ2ZU9yZGVyKSB7XG4gICAgICAgICAgICAgICAgUHJvbWlzZS5hbGwocXVldWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgcmVzb2x2ZShjdXJzb3IuY2FuQ29udGludWUoKSA/IGN1cnNvci5hZGRNb3JlIDogZmFsc2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoY3Vyc29yLmNhbkNvbnRpbnVlKCkgPyBjdXJzb3IuYWRkTW9yZSA6IGZhbHNlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgZihjdXJzb3IubmV4dCgpLnZhbHVlKTtcbiAgICAgICAgfSkudGhlbihuZXh0ID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKHByZXNlcnZlT3JkZXIpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGxldCBmbiA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgbGV0IHJldCA9IGZuKCk7XG4gICAgICAgICAgICAgICAgaWYgKHJldCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgICAgICAgICAgICAgIGF3YWl0IHJldC5jYXRjaChyZWplY3QpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZShuZXh0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBkZWJ1Z2dlcigpIHtcbiAgICByZXR1cm4gKGVycm9yKSA9PiB7XG4gICAgICAvLyBAdG9kbzogdGhpcyBzaG91bGQgYWN0dWFsbHkgY2hlY2sgZm9yIGVycm9ycy5qc29uYXBpXG4gICAgICBpZiAoZXJyb3IuZXJyb3JzKSB7XG4gICAgICAgIGNvbnN0IGxvZ0Vycm9yID0gZXJyb3IgPT4ge1xuICAgICAgICAgIHRoaXMubG9nZ2VyLmluZm8oYCR7ZXJyb3IudGl0bGV9OiAke2Vycm9yLmRldGFpbH0uICVzYCwgZXJyb3IubGlua3MuaW5mbyk7XG4gICAgICAgIH1cbiAgICAgICAgZXJyb3IuZXJyb3JzLmZvckVhY2gobG9nRXJyb3IpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIC8vdGhpcy5sb2dnZXIubG9nKGVycm9yKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZWNvcmF0ZVdpdGhSZWxhdGlvbnNoaXBzKGNvbnN1bWVyLCByZWxhdGlvbnNoaXBzID0gbnVsbCkge1xuICAgIGNvbnN0IGRlY29yYXRlZCA9ICFyZWxhdGlvbnNoaXBzXG4gICAgICA/IGNvbnN1bWVyXG4gICAgICA6IHJlc291cmNlID0+IHtcbiAgICAgICAgY29uc3QgbWlycm9yID0ge307XG4gICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHJlbGF0aW9uc2hpcHMpLmZvckVhY2gocmVsYXRpb25zaGlwID0+IHtcbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSByZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcF07XG4gICAgICAgICAgbGV0IHBhdGggPSBbXSwgbGluaztcbiAgICAgICAgICBtaXJyb3JbcmVsYXRpb25zaGlwXSA9IChsaW5rID0gZXh0cmFjdFZhbHVlKGByZWxhdGlvbnNoaXBzLiR7dGFyZ2V0LmZpZWxkfS5saW5rcy5yZWxhdGVkYCwgcmVzb3VyY2UpKVxuICAgICAgICAgICAgPyB0aGlzLnBhZ2luYXRlKGxpbmssIHRhcmdldC5saW1pdCB8fCAtMSwgdGFyZ2V0LnJlbGF0aW9uc2hpcHMgfHwgbnVsbClcbiAgICAgICAgICAgIDogUHJvbWlzZS5yZWplY3QoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBjb25zdW1lcihyZXNvdXJjZSwgbWlycm9yKTtcbiAgICAgIH07XG4gICAgcmV0dXJuIGRlY29yYXRlZDtcbiAgfVxuXG4gIGZldGNoRG9jdW1lbnQodXJsKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuYXV0aG9yaXphdGlvbiA/IHtoZWFkZXJzOiBuZXcgSGVhZGVycyh7YXV0aG9yaXphdGlvbjogdGhpcy5hdXRob3JpemF0aW9ufSl9IDoge307XG4gICAgcmV0dXJuIGZldGNoKHVybCwgb3B0aW9ucykudGhlbihyZXMgPT4ge1xuICAgICAgaWYgKHJlcy5vaykge1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICByZWplY3QocmVzLnN0YXR1c1RleHQpO1xuICAgICAgICAvL3JldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vICAvL2xldCBkb2MgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+IHJlamVjdChyZXMuc3RhdHVzVGV4dCkpO1xuICAgICAgICAvLyAgcmVqZWN0KGRvYyk7XG4gICAgICAgIC8vfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBkb2N1bWVudERhdGEoZG9jKSB7XG4gICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eSgnZGF0YScpKSB7XG4gICAgICByZXR1cm4gZG9jLmRhdGE7XG4gICAgfVxuICAgIGlmIChkb2MuaGFzT3duUHJvcGVydHkoJ2Vycm9ycycpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZG9jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgc2VydmVyIHJldHVybmVkIGFuIHVucHJvY2Vzc2FibGUgZG9jdW1lbnQgd2l0aCBubyBkYXRhIG9yIGVycm9ycy4nKTtcbiAgICB9XG4gIH1cblxuICBnZXRMaW5rKHR5cGUpIHtcbiAgICByZXR1cm4gdGhpcy5saW5rcy50aGVuKGxpbmtzID0+IHtcbiAgICAgIGlmICghbGlua3MuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgUHJvbWlzZS5yZWplY3QoYCcke3R5cGV9JyBpcyBub3QgYSB2YWxpZCB0eXBlIGZvciAke3RoaXMuYmFzZVVybH0uYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbGlua3NbdHlwZV07XG4gICAgfSk7XG4gIH1cblxuICBmaWx0ZXIoZikge1xuICAgIHJldHVybiBuZXcgRmlsdGVyKGYpO1xuICB9XG5cbiAgYXN5bmMgY29sbGVjdGlvbkxpbmsodHlwZSwge3NvcnQsIGZpbHRlciwgcGFnZX0gPSB7fSkge1xuICAgIGxldCBxdWVyeSA9ICcnO1xuICAgIHF1ZXJ5ICs9IGZpbHRlci5sZW5ndGggPyBgPyR7ZmlsdGVyfWAgOiAnJztcbiAgICBxdWVyeSArPSBzb3J0Lmxlbmd0aCA/IGAke3F1ZXJ5Lmxlbmd0aCA/ICcmJyA6ICc/J31zb3J0PSR7c29ydH1gIDogJyc7XG4gICAgcXVlcnkgKz0gcGFnZS5sZW5ndGggPyBgJHtxdWVyeS5sZW5ndGggPyAnJicgOiAnPyd9JHtwYWdlfWAgOiAnJztcbiAgICByZXR1cm4gYCR7YXdhaXQgdGhpcy5nZXRMaW5rKHR5cGUpfSR7cXVlcnl9YDtcbiAgfVxuXG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RWYWx1ZShwYXRoLCBvYmopIHtcbiAgcmV0dXJuIHBhdGguc3BsaXQoJy4nKS5yZWR1Y2UoKGV4aXN0cywgcGFydCkgPT4gZXhpc3RzICYmIGV4aXN0cy5oYXNPd25Qcm9wZXJ0eShwYXJ0KSA/IGV4aXN0c1twYXJ0XSA6IGZhbHNlLCBvYmopO1xufVxuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2xpYi9pbmRleC5qcyIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEZpbHRlciB7XG5cbiAgY29uc3RydWN0b3IoZikge1xuICAgIHRoaXMuY29uZGl0aW9ucyA9IGYoQ29uZGl0aW9ucywgKGtleSkgPT4gKHBhcmFtZXRlcnMpID0+IHBhcmFtZXRlcnNba2V5XSk7XG4gIH1cblxuICBjb21waWxlKHBhcmFtZXRlcnMpIHtcbiAgICBjb25zdCBpZCA9IGZ1bmN0aW9uKiAoKSB7XG4gICAgICBsZXQgY291bnRlciA9IDE7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICB5aWVsZCBjb3VudGVyKys7XG4gICAgICB9XG4gICAgfSgpO1xuXG4gICAgY29uc3QgY29tcGlsZXIgPSAoYWNjLCBpdGVtLCBfLCBwYXJlbnRJRCA9IG51bGwpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRJRCA9IGlkLm5leHQoKS52YWx1ZTtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGFjYy5sZW5ndGggPyBgJHthY2N9JmAgOiAnJztcbiAgICAgIGlmIChpdGVtLm1lbWJlcnMpIHtcbiAgICAgICAgY29uc3Qgcm9vdCA9IGBmaWx0ZXJbJHtjdXJyZW50SUR9XVtncm91cF1gO1xuICAgICAgICBjb25zdCBzZWxmID0gcGFyZW50SURcbiAgICAgICAgICA/IGAke3Jvb3R9W2Nvbmp1bmN0aW9uXT0ke2l0ZW0uY29uanVuY3Rpb259JiR7cm9vdH1bbWVtYmVyT2ZdPSR7cGFyZW50SUR9YFxuICAgICAgICAgIDogYCR7cm9vdH1bY29uanVuY3Rpb25dPSR7aXRlbS5jb25qdW5jdGlvbn1gO1xuICAgICAgICByZXR1cm4gYCR7cHJlZml4fSR7aXRlbS5tZW1iZXJzLnJlZHVjZSgoYWNjLCBpdGVtLCBfKSA9PiBjb21waWxlcihhY2MsIGl0ZW0sIF8sIGN1cnJlbnRJRCksIHNlbGYpfWA7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgcm9vdCA9IGBmaWx0ZXJbJHtjdXJyZW50SUR9XVtjb25kaXRpb25dYDtcbiAgICAgICAgY29uc3QgcHJvY2Vzc2VkID0gQ29uZGl0aW9ucy5wcm9jZXNzKGl0ZW0sIHBhcmFtZXRlcnMpO1xuICAgICAgICBsZXQgc2VsZiA9ICcnO1xuICAgICAgICBzZWxmICs9IGAke3Jvb3R9W3BhdGhdPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHByb2Nlc3NlZC5wYXRoKX1gO1xuICAgICAgICBpZiAoQ29uZGl0aW9ucy51bmFyeU9wZXJhdG9ycy5oYXMocHJvY2Vzc2VkLm9wZXJhdG9yKSkge1xuICAgICAgICAgIHNlbGYgKz0gYCYke3Jvb3R9W3ZhbHVlXT0ke2VuY29kZVVSSUNvbXBvbmVudChwcm9jZXNzZWQudmFsdWUpfWA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIUNvbmRpdGlvbnMubnVsbE9wZXJhdG9ycy5oYXMocHJvY2Vzc2VkLm9wZXJhdG9yKSkge1xuICAgICAgICAgIHByb2Nlc3NlZC52YWx1ZS5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgICAgc2VsZiArPSBgJiR7cm9vdH1bdmFsdWVdW109JHtlbmNvZGVVUklDb21wb25lbnQoaXRlbSl9YDtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmICs9IGAmJHtyb290fVtvcGVyYXRvcl09JHtlbmNvZGVVUklDb21wb25lbnQocHJvY2Vzc2VkLm9wZXJhdG9yKX1gO1xuICAgICAgICByZXR1cm4gcGFyZW50SURcbiAgICAgICAgICA/IGAke3ByZWZpeH0ke3NlbGZ9JiR7cm9vdH1bbWVtYmVyT2ZdPSR7cGFyZW50SUR9YFxuICAgICAgICAgIDogYCR7cHJlZml4fSR7c2VsZn1gO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gY29tcGlsZXIoJycsIHRoaXMuY29uZGl0aW9ucyk7XG4gIH1cblxufVxuXG5jb25zdCBHcm91cHMgPSB7XG5cbiAgYW5kOiAoLi4ubWVtYmVycykgPT4ge1xuICAgIHJldHVybiBHcm91cHMuZ3JvdXAobWVtYmVycywgJ0FORCcpO1xuICB9LFxuXG4gIG9yOiAoLi4ubWVtYmVycykgPT4ge1xuICAgIHJldHVybiBHcm91cHMuZ3JvdXAobWVtYmVycywgJ09SJyk7XG4gIH0sXG5cbiAgZ3JvdXA6IChtZW1iZXJzLCBjb25qdW5jdGlvbikgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBjb25qdW5jdGlvbixcbiAgICAgIG1lbWJlcnMsXG4gICAgfVxuICB9LFxuXG59XG5cbmNvbnN0IENvbmRpdGlvbnMgPSBmdW5jdGlvbiAocGF0aCwgdmFsdWUpIHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuZXEocGF0aCwgdmFsdWUpO1xufVxuXG5Db25kaXRpb25zLmFuZCA9IEdyb3Vwcy5hbmQ7XG5cbkNvbmRpdGlvbnMub3IgPSBHcm91cHMub3I7XG5cbkNvbmRpdGlvbnMuZXEgPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnPScpO1xufVxuXG5Db25kaXRpb25zLm5vdEVxID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJzw+Jyk7XG59XG5cbkNvbmRpdGlvbnMuZ3QgPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnPicpO1xufVxuXG5Db25kaXRpb25zLmd0RXEgPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnPj0nKTtcbn1cblxuQ29uZGl0aW9ucy5sdCA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICc8Jyk7XG59XG5cbkNvbmRpdGlvbnMubHRFcSA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICc8PScpO1xufVxuXG5Db25kaXRpb25zLnN0YXJ0c1dpdGggPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnU1RBUlRTX1dJVEgnKTtcbn1cblxuQ29uZGl0aW9ucy5jb250YWlucyA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICdDT05UQUlOUycpO1xufVxuXG5Db25kaXRpb25zLmVuZHNXaXRoID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJ0VORFNfV0lUSCcpO1xufVxuXG5Db25kaXRpb25zLmluID0gKHBhdGgsIHZhbHVlKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihwYXRoLCB2YWx1ZSwgJ0lOJyk7XG59XG5cbkNvbmRpdGlvbnMubm90SW4gPSAocGF0aCwgdmFsdWUpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKHBhdGgsIHZhbHVlLCAnTk9UIElOJyk7XG59XG5cbkNvbmRpdGlvbnMuYmV0d2VlbiA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICdCRVRXRUVOJyk7XG59XG5cbkNvbmRpdGlvbnMubm90QmV0d2VlbiA9IChwYXRoLCB2YWx1ZSkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdmFsdWUsICdOT1QgQkVUV0VFTicpO1xufVxuXG5Db25kaXRpb25zLm51bGwgPSAocGF0aCkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdW5kZWZpbmVkLCAnSVMgTlVMTCcpO1xufVxuXG5Db25kaXRpb25zLm5vdE51bGwgPSAocGF0aCkgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24ocGF0aCwgdW5kZWZpbmVkLCAnSVMgTk9UIE5VTEwnKTtcbn1cblxuQ29uZGl0aW9ucy5jb25kaXRpb24gPSAocGF0aCwgdmFsdWUsIG9wZXJhdG9yKSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLnZhbGlkYXRlKHtwYXRoLCB2YWx1ZSwgb3BlcmF0b3J9KTtcbn1cblxuQ29uZGl0aW9ucy51bmFyeU9wZXJhdG9ycyA9IG5ldyBTZXQoWyc9JywgJzw+JywgJz4nLCAnPj0nLCAnPCcsICc8PScsICdTVEFSVFNfV0lUSCcsICdDT05UQUlOUycsICdFTkRTX1dJVEgnXSk7XG5Db25kaXRpb25zLnVuYXJ5VmFsdWVUeXBlcyA9IG5ldyBTZXQoWydzdHJpbmcnLCAnYm9vbGVhbicsICdudW1iZXInXSk7XG5Db25kaXRpb25zLmJpbmFyeU9wZXJhdG9ycyA9IG5ldyBTZXQoWydCRVRXRUVOJywgJ05PVCBCRVRXRUVOJ10pO1xuQ29uZGl0aW9ucy5zdHJpbmdPcGVyYXRvcnMgPSBuZXcgU2V0KFsnU1RBUlRTX1dJVEgnLCAnQ09OVEFJTlMnLCAnRU5EU19XSVRIJ10pO1xuQ29uZGl0aW9ucy5udWxsT3BlcmF0b3JzID0gbmV3IFNldChbJ0lTIE5VTEwnLCAnSVMgTk9UIE5VTEwnXSk7XG5cbkNvbmRpdGlvbnMudmFsaWRhdGUgPSAoY29uZGl0aW9uKSA9PiB7XG4gIGlmIChjb25kaXRpb24ub3BlcmF0b3IgaW5zdGFuY2VvZiBGdW5jdGlvbiB8fCBjb25kaXRpb24udmFsdWUgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgIHJldHVybiBjb25kaXRpb247XG4gIH1cbiAgaWYgKENvbmRpdGlvbnMubnVsbE9wZXJhdG9ycy5oYXMoY29uZGl0aW9uLm9wZXJhdG9yKSkge1xuICAgIGlmICh0eXBlb2YgY29uZGl0aW9uLnZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb25kaXRpb25zIHdpdGggYW4gJyR7Y29uZGl0aW9uLm9wZXJhdG9yfScgb3BlcmF0b3IgbXVzdCBub3Qgc3BlY2lmeSBhIHZhbHVlLmApO1xuICAgIH1cbiAgfVxuICBlbHNlIGlmIChDb25kaXRpb25zLnVuYXJ5T3BlcmF0b3JzLmhhcyhjb25kaXRpb24ub3BlcmF0b3IpKSB7XG4gICAgaWYgKCFDb25kaXRpb25zLnVuYXJ5VmFsdWVUeXBlcy5oYXModHlwZW9mIGNvbmRpdGlvbi52YWx1ZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlICcke2NvbmRpdGlvbi5vcGVyYXRvcn0nIG9wZXJhdG9yIHJlcXVpcmVzIGEgc2luZ2xlIHZhbHVlLmApO1xuICAgIH1cbiAgICBpZiAoQ29uZGl0aW9ucy5zdHJpbmdPcGVyYXRvcnMuaGFzKGNvbmRpdGlvbi5vcGVyYXRvcikgJiYgdHlwZW9mIGNvbmRpdGlvbi52YWx1ZSAhPSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJyR7Y29uZGl0aW9uLm9wZXJhdG9yfScgb3BlcmF0b3IgcmVxdWlyZXMgdGhhdCB0aGUgY29uZGl0aW9uIHZhbHVlIGJlIGEgc3RyaW5nLmApO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoY29uZGl0aW9uLnZhbHVlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJyR7Y29uZGl0aW9uLm9wZXJhdG9yfScgb3BlcmF0b3IgcmVxdWlyZXMgYW4gYXJyYXkgb2YgdmFsdWVzLmApO1xuICAgIH1cbiAgICBpZiAoQ29uZGl0aW9ucy5iaW5hcnlPcGVyYXRvcnMuaGFzKGNvbmRpdGlvbi5vcGVyYXRvcikgJiYgY29uZGl0aW9uLnZhbHVlLmxlbmd0aCAhPT0gMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgJyR7Y29uZGl0aW9uLm9wZXJhdG9yfScgb3BlcmF0b3IgcmVxdWlyZXMgYW4gYXJyYXkgb2YgZXhhY3RseSAyIHZhbHVlcy5gKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbmRpdGlvbjtcbn1cblxuQ29uZGl0aW9ucy5wcm9jZXNzID0gKGNvbmRpdGlvbiwgcGFyYW1ldGVycykgPT4ge1xuICBsZXQgcmV2YWxpZGF0ZSA9IGZhbHNlO1xuICBjb25zdCByZXBsYWNlID0gKGl0ZW0pID0+IHtcbiAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXZhbGlkYXRlID0gdHJ1ZTtcbiAgICAgIHJldHVybiBpdGVtKHBhcmFtZXRlcnMpO1xuICAgIH1cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICBjb25zdCBwcm9jZXNzZWQgPSB7XG4gICAgcGF0aDogcmVwbGFjZShjb25kaXRpb24ucGF0aCksXG4gICAgb3BlcmF0b3I6IHJlcGxhY2UoY29uZGl0aW9uLm9wZXJhdG9yKSxcbiAgfVxuICBpZiAoIUNvbmRpdGlvbnMubnVsbE9wZXJhdG9ycy5oYXMocHJvY2Vzc2VkLm9wZXJhdG9yKSkge1xuICAgIHByb2Nlc3NlZC52YWx1ZSA9IHJlcGxhY2UoY29uZGl0aW9uLnZhbHVlKTtcbiAgfVxuICBpZiAocmV2YWxpZGF0ZSkge1xuICAgIENvbmRpdGlvbnMudmFsaWRhdGUocHJvY2Vzc2VkKTtcbiAgfVxuICByZXR1cm4gcHJvY2Vzc2VkO1xufVxuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sInNvdXJjZVJvb3QiOiIifQ==