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

const client = new __WEBPACK_IMPORTED_MODULE_0__lib__["a" /* default */]('http://jsonapi.test:8080');

const logRecipe = label => async (recipe, relationships) => {
  let tags = [];
  await relationships.tags.consume(tag => tags.push(tag.attributes.name));
  console.group(`${label}:`, recipe.attributes.title);
  console.log('Dish:', recipe.attributes.title);
  console.log('Tags:', tags.join(', '));
  console.groupEnd(`${label}:`, recipe.attributes.title);
};

async function getRecipes(options) {
  const feed = await client.all('node--recipe', options).catch(console.log);
  let next = await feed.consume(logRecipe('Initial')).catch(console.log);

  while (next) {
    next(options.limit);
    next = await feed.consume(logRecipe('Subsequent')).catch(console.log);
  }
}

const filter = client.filter((c, param) => {
  return c.and(c('status', 1), c.or(c.contains('title', param('paramOne')), c.startsWith('title', 'Thai')));
});
const options = {
  limit: 3,
  sort: 'title',
  relationships: {
    tags: 'field_tags'
  }
};
getRecipes(options).then(() => {
  console.log('Unfiltered query is done!\n\n');
  options.filter = filter.compile({
    paramOne: 'easy'
  });
  getRecipes(options).then(() => console.log('Filtered query is done!'));
}); //client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(logResourceAs('Individual'))
//  .catch(error => console.log('Error:', error));

/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__filters_js__ = __webpack_require__(2);

class DrupalClient {
  constructor(baseUrl, logger = console) {
    this.baseUrl = baseUrl;
    this.logger = logger;
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
      page: 'page[limit]=2'
    });
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
        resourceCount += resources ? resources.length : 0;
        buffer.push(...(resources || []));
        return Promise.resolve(buffer);
      });
    };

    var collectionRequests = [];

    const advance = () => {
      if (link && !inFlight.has(link) && (limit === -1 || resourceCount < limit)) {
        collectionRequests.push(doRequest(link));
      }

      return !buffer.length && collectionRequests.length ? collectionRequests.shift().then(() => buffer) : Promise.resolve(buffer);
    };

    const cursor = function* () {
      while (buffer.length || inFlight.size || link) {
        yield limit === -1 || resourceCount < limit ? advance().then(buffer => {
          const resource = buffer.shift();
          return resource || null;
        }) : false;
      }
    }();

    cursor.canContinue = () => buffer.length || inFlight.size || link;

    cursor.addMore = (many = -1) => many === -1 ? limit = -1 : limit += many;

    return cursor;
  }

  toConsumer(cursor, relationships = null) {
    const self = this;
    return {
      consume: function consume(consumer) {
        const decoratedConsumer = self.decorateWithRelationships(consumer, relationships);
        return new Promise((resolve, reject) => {
          const f = next => {
            if (next) {
              next.then(resource => {
                decoratedConsumer(resource);
                f(cursor.next().value);
              }).catch(reject);
            } else {
              resolve(cursor.canContinue() ? cursor.addMore : false);
            }
          };

          f(cursor.next().value);
        });
      }
    };
  }

  decorateWithRelationships(consumer, relationships = null) {
    const decorated = !relationships ? consumer : resource => {
      const mirror = {};
      Object.getOwnPropertyNames(relationships).forEach(relationship => {
        const target = typeof relationships[relationship] === 'string' ? {
          field: relationships[relationship]
        } : relationship;
        let path = [],
            link;
        mirror[relationship] = (link = extractValue(`relationships.${target.field}.links.related`, resource)) ? this.toConsumer(this.paginate(link, target.limit || -1)) : Promise.reject();
      });
      consumer(resource, mirror);
    };
    return resource => {
      // Only call the consumer with non-null values.
      if (resource) decorated(resource);
    };
  }

  fetchDocument(url) {
    return fetch(url).then(res => res.ok ? res.json() : Promise.reject(res.statusText));
  }

  documentData(doc) {
    if (doc.hasOwnProperty('data')) {
      return doc.data;
    }

    if (doc.hasOwnProperty('errors')) {
      doc.errors.forEach(this.logger.log);
      return null;
    } else {
      this.logger.log('The server returned an unprocessable document with no data or errors.');
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
      var counter = 1;

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
        var self = '';
        self += `${root}[path]=${item.path}`; // @todo expand for multivalue operators an null/not null

        self += `&${root}[value]=${typeof item.value === "function" ? item.value(parameters) : item.value}`;
        self += `&${root}[operator]=${item.operator}`;
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

const Conditions = function Conditions(f, v) {
  return Conditions.eq(f, v);
};

Conditions.and = Groups.and;
Conditions.or = Groups.or;

Conditions.eq = (f, v) => {
  return Conditions.condition(f, v, '=');
};

Conditions.notEq = (f, v) => {
  return Conditions.condition(f, v, '<>');
};

Conditions.gt = (f, v) => {
  return Conditions.condition(f, v, '>');
};

Conditions.gtEq = (f, v) => {
  return Conditions.condition(f, v, '>=');
};

Conditions.lt = (f, v) => {
  return Conditions.condition(f, v, '<');
};

Conditions.ltEq = (f, v) => {
  return Conditions.condition(f, v, '<=');
};

Conditions.startsWith = (f, v) => {
  return Conditions.condition(f, v, 'STARTS_WITH');
};

Conditions.contains = (f, v) => {
  return Conditions.condition(f, v, 'CONTAINS');
};

Conditions.endsWith = (f, v) => {
  return Conditions.condition(f, v, 'ENDS_WITH');
}; // @todo add support for: 'IN', 'NOT IN'
// @todo add support for: 'BETWEEN', 'NOT BETWEEN'
// @todo add support for: 'IS NULL', 'IS NOT NULL'


Conditions.condition = (f, v, op) => {
  return {
    path: f,
    value: v,
    operator: encodeURIComponent(op)
  };
};

/***/ })
/******/ ]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgMWJiMjRmM2MzNDg5OTAwMGU2YzAiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbImNsaWVudCIsImxvZ1JlY2lwZSIsImxhYmVsIiwicmVjaXBlIiwicmVsYXRpb25zaGlwcyIsInRhZ3MiLCJjb25zdW1lIiwidGFnIiwicHVzaCIsImF0dHJpYnV0ZXMiLCJuYW1lIiwiY29uc29sZSIsImdyb3VwIiwidGl0bGUiLCJsb2ciLCJqb2luIiwiZ3JvdXBFbmQiLCJnZXRSZWNpcGVzIiwib3B0aW9ucyIsImZlZWQiLCJhbGwiLCJjYXRjaCIsIm5leHQiLCJsaW1pdCIsImZpbHRlciIsImMiLCJwYXJhbSIsImFuZCIsIm9yIiwiY29udGFpbnMiLCJzdGFydHNXaXRoIiwic29ydCIsInRoZW4iLCJjb21waWxlIiwicGFyYW1PbmUiLCJEcnVwYWxDbGllbnQiLCJjb25zdHJ1Y3RvciIsImJhc2VVcmwiLCJsb2dnZXIiLCJsaW5rcyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZmV0Y2hEb2N1bWVudCIsImRvYyIsImVyciIsImdldCIsInR5cGUiLCJpZCIsImxpbmsiLCJnZXRMaW5rIiwiZG9jdW1lbnREYXRhIiwiY29sbGVjdGlvbkxpbmsiLCJwYWdlIiwidG9Db25zdW1lciIsInBhZ2luYXRlIiwiYnVmZmVyIiwicmVzb3VyY2VDb3VudCIsImluRmxpZ2h0IiwiU2V0IiwiZG9SZXF1ZXN0IiwibmV4dExpbmsiLCJhZGQiLCJkZWxldGUiLCJyZXNvdXJjZXMiLCJsZW5ndGgiLCJjb2xsZWN0aW9uUmVxdWVzdHMiLCJhZHZhbmNlIiwiaGFzIiwic2hpZnQiLCJjdXJzb3IiLCJzaXplIiwicmVzb3VyY2UiLCJjYW5Db250aW51ZSIsImFkZE1vcmUiLCJtYW55Iiwic2VsZiIsImNvbnN1bWVyIiwiZGVjb3JhdGVkQ29uc3VtZXIiLCJkZWNvcmF0ZVdpdGhSZWxhdGlvbnNoaXBzIiwiZiIsInZhbHVlIiwiZGVjb3JhdGVkIiwibWlycm9yIiwiT2JqZWN0IiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsImZvckVhY2giLCJyZWxhdGlvbnNoaXAiLCJ0YXJnZXQiLCJmaWVsZCIsInBhdGgiLCJleHRyYWN0VmFsdWUiLCJ1cmwiLCJmZXRjaCIsInJlcyIsIm9rIiwianNvbiIsInN0YXR1c1RleHQiLCJoYXNPd25Qcm9wZXJ0eSIsImRhdGEiLCJlcnJvcnMiLCJxdWVyeSIsIm9iaiIsInNwbGl0IiwicmVkdWNlIiwiZXhpc3RzIiwicGFydCIsIkZpbHRlciIsImNvbmRpdGlvbnMiLCJDb25kaXRpb25zIiwia2V5IiwicGFyYW1ldGVycyIsImNvdW50ZXIiLCJjb21waWxlciIsImFjYyIsIml0ZW0iLCJfIiwicGFyZW50SUQiLCJjdXJyZW50SUQiLCJwcmVmaXgiLCJtZW1iZXJzIiwicm9vdCIsImNvbmp1bmN0aW9uIiwib3BlcmF0b3IiLCJHcm91cHMiLCJ2IiwiZXEiLCJjb25kaXRpb24iLCJub3RFcSIsImd0IiwiZ3RFcSIsImx0IiwibHRFcSIsImVuZHNXaXRoIiwib3AiLCJlbmNvZGVVUklDb21wb25lbnQiXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsbUNBQTJCLDBCQUEwQixFQUFFO0FBQ3ZELHlDQUFpQyxlQUFlO0FBQ2hEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDhEQUFzRCwrREFBK0Q7O0FBRXJIO0FBQ0E7O0FB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QixXQUFXa0IsU0FBWCxDQUFxQi9DLENBQXJCLEVBQXdCNkMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFoQixXQUFXL0UsVUFBWCxHQUF3QixDQUFDa0QsQ0FBRCxFQUFJNkMsQ0FBSixLQUFVO0FBQ2hDLFNBQU9oQixXQUFXa0IsU0FBWCxDQUFxQi9DLENBQXJCLEVBQXdCNkMsQ0FBeEIsRUFBMkIsYUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFoQixXQUFXaEYsUUFBWCxHQUFzQixDQUFDbUQsQ0FBRCxFQUFJNkMsQ0FBSixLQUFVO0FBQzlCLFNBQU9oQixXQUFXa0IsU0FBWCxDQUFxQi9DLENBQXJCLEVBQXdCNkMsQ0FBeEIsRUFBMkIsVUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFoQixXQUFXd0IsUUFBWCxHQUFzQixDQUFDckQsQ0FBRCxFQUFJNkMsQ0FBSixLQUFVO0FBQzlCLFNBQU9oQixXQUFXa0IsU0FBWCxDQUFxQi9DLENBQXJCLEVBQXdCNkMsQ0FBeEIsRUFBMkIsV0FBM0IsQ0FBUDtBQUNELENBRkQsQyxDQUlBO0FBQ0E7QUFDQTs7O0FBRUFoQixXQUFXa0IsU0FBWCxHQUF1QixDQUFDL0MsQ0FBRCxFQUFJNkMsQ0FBSixFQUFPUyxFQUFQLEtBQWM7QUFDbkMsU0FBTztBQUNMNUMsVUFBTVYsQ0FERDtBQUVMQyxXQUFPNEMsQ0FGRjtBQUdMRixjQUFVWSxtQkFBbUJELEVBQW5CO0FBSEwsR0FBUDtBQUtELENBTkQsQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKSB7XG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG4gXHRcdH1cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGk6IG1vZHVsZUlkLFxuIFx0XHRcdGw6IGZhbHNlLFxuIFx0XHRcdGV4cG9ydHM6IHt9XG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmwgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb24gZm9yIGhhcm1vbnkgZXhwb3J0c1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kID0gZnVuY3Rpb24oZXhwb3J0cywgbmFtZSwgZ2V0dGVyKSB7XG4gXHRcdGlmKCFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywgbmFtZSkpIHtcbiBcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgbmFtZSwge1xuIFx0XHRcdFx0Y29uZmlndXJhYmxlOiBmYWxzZSxcbiBcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG4gXHRcdFx0XHRnZXQ6IGdldHRlclxuIFx0XHRcdH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5uID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gXHRcdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuIFx0XHRcdGZ1bmN0aW9uIGdldERlZmF1bHQoKSB7IHJldHVybiBtb2R1bGVbJ2RlZmF1bHQnXTsgfSA6XG4gXHRcdFx0ZnVuY3Rpb24gZ2V0TW9kdWxlRXhwb3J0cygpIHsgcmV0dXJuIG1vZHVsZTsgfTtcbiBcdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgJ2EnLCBnZXR0ZXIpO1xuIFx0XHRyZXR1cm4gZ2V0dGVyO1xuIFx0fTtcblxuIFx0Ly8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7IHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSk7IH07XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IDApO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIHdlYnBhY2svYm9vdHN0cmFwIDFiYjI0ZjNjMzQ4OTkwMDBlNmMwIiwiaW1wb3J0IERDbGllbnQgZnJvbSAnLi9saWInO1xuXG5jb25zdCBjbGllbnQgPSBuZXcgRENsaWVudCgnaHR0cDovL2pzb25hcGkudGVzdDo4MDgwJyk7XG5cbmNvbnN0IGxvZ1JlY2lwZSA9IGxhYmVsID0+IGFzeW5jIChyZWNpcGUsIHJlbGF0aW9uc2hpcHMpID0+IHtcbiAgbGV0IHRhZ3MgPSBbXTtcbiAgYXdhaXQgcmVsYXRpb25zaGlwcy50YWdzLmNvbnN1bWUodGFnID0+IHRhZ3MucHVzaCh0YWcuYXR0cmlidXRlcy5uYW1lKSk7XG4gIGNvbnNvbGUuZ3JvdXAoYCR7bGFiZWx9OmAsIHJlY2lwZS5hdHRyaWJ1dGVzLnRpdGxlKTtcbiAgY29uc29sZS5sb2coJ0Rpc2g6JywgcmVjaXBlLmF0dHJpYnV0ZXMudGl0bGUpO1xuICBjb25zb2xlLmxvZygnVGFnczonLCB0YWdzLmpvaW4oJywgJykpO1xuICBjb25zb2xlLmdyb3VwRW5kKGAke2xhYmVsfTpgLCByZWNpcGUuYXR0cmlidXRlcy50aXRsZSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFJlY2lwZXMob3B0aW9ucykge1xuICBjb25zdCBmZWVkID0gYXdhaXQgY2xpZW50LmFsbCgnbm9kZS0tcmVjaXBlJywgb3B0aW9ucykuY2F0Y2goY29uc29sZS5sb2cpO1xuICBsZXQgbmV4dCA9IGF3YWl0IGZlZWQuY29uc3VtZShsb2dSZWNpcGUoJ0luaXRpYWwnKSkuY2F0Y2goY29uc29sZS5sb2cpO1xuICB3aGlsZSAobmV4dCkge1xuICAgIG5leHQob3B0aW9ucy5saW1pdCk7XG4gICAgbmV4dCA9IGF3YWl0IGZlZWQuY29uc3VtZShsb2dSZWNpcGUoJ1N1YnNlcXVlbnQnKSkuY2F0Y2goY29uc29sZS5sb2cpO1xuICB9XG59XG5cbmNvbnN0IGZpbHRlciA9IGNsaWVudC5maWx0ZXIoKGMsIHBhcmFtKSA9PiB7XG4gIHJldHVybiBjLmFuZChcbiAgICBjKCdzdGF0dXMnLCAxKSxcbiAgICBjLm9yKGMuY29udGFpbnMoJ3RpdGxlJywgcGFyYW0oJ3BhcmFtT25lJykpLCBjLnN0YXJ0c1dpdGgoJ3RpdGxlJywgJ1RoYWknKSksXG4gICk7XG59KTtcblxuY29uc3Qgb3B0aW9ucyA9IHtsaW1pdDogMywgc29ydDogJ3RpdGxlJywgcmVsYXRpb25zaGlwczoge3RhZ3M6ICdmaWVsZF90YWdzJ319O1xuZ2V0UmVjaXBlcyhvcHRpb25zKS50aGVuKCgpID0+IHtcbiAgY29uc29sZS5sb2coJ1VuZmlsdGVyZWQgcXVlcnkgaXMgZG9uZSFcXG5cXG4nKTtcbiAgb3B0aW9ucy5maWx0ZXIgPSBmaWx0ZXIuY29tcGlsZSh7cGFyYW1PbmU6ICdlYXN5J30pO1xuICBnZXRSZWNpcGVzKG9wdGlvbnMpLnRoZW4oKCkgPT4gY29uc29sZS5sb2coJ0ZpbHRlcmVkIHF1ZXJ5IGlzIGRvbmUhJykpO1xufSk7XG5cblxuLy9jbGllbnQuZ2V0KCdub2RlLS1yZWNpcGUnLCAnMjVjMDQ4YjYtNjllOS00NmY0LTk4NmQtNGI4MGIwMWRlMmU2Jylcbi8vICAudGhlbihsb2dSZXNvdXJjZUFzKCdJbmRpdmlkdWFsJykpXG4vLyAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUubG9nKCdFcnJvcjonLCBlcnJvcikpO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2luZGV4LmpzIiwiaW1wb3J0IEZpbHRlciBmcm9tICcuL2ZpbHRlcnMuanMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcnVwYWxDbGllbnQge1xuXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmwsIGxvZ2dlciA9IGNvbnNvbGUpIHtcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xuICAgIHRoaXMubG9nZ2VyID0gbG9nZ2VyO1xuICAgIHRoaXMubGlua3MgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLmZldGNoRG9jdW1lbnQoYCR7YmFzZVVybH0vanNvbmFwaWApXG4gICAgICAgIC50aGVuKGRvYyA9PiByZXNvbHZlKGRvYy5saW5rcyB8fCB7fSkpXG4gICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgIHRoaXMubG9nZ2VyLmxvZygnVW5hYmxlIHRvIHJlc29sdmUgcmVzb3VyY2UgbGlua3MuJyk7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgZ2V0KHR5cGUsIGlkKSB7XG4gICAgY29uc3QgbGluayA9IGAke2F3YWl0IHRoaXMuZ2V0TGluayh0eXBlKX0vJHtpZH1gO1xuICAgIHJldHVybiB0aGlzLmRvY3VtZW50RGF0YShhd2FpdCB0aGlzLmZldGNoRG9jdW1lbnQobGluaykpO1xuICB9XG5cbiAgYXN5bmMgYWxsKHR5cGUsIHsgbGltaXQgPSAtMSwgc29ydCA9ICcnLCBmaWx0ZXIgPSAnJywgcmVsYXRpb25zaGlwcyA9IG51bGx9ID0ge30pIHtcbiAgICBsZXQgbGluayA9IGF3YWl0IHRoaXMuY29sbGVjdGlvbkxpbmsodHlwZSwge3NvcnQsIGZpbHRlciwgcGFnZTogJ3BhZ2VbbGltaXRdPTInfSk7XG4gICAgcmV0dXJuIHRoaXMudG9Db25zdW1lcih0aGlzLnBhZ2luYXRlKGxpbmssIGxpbWl0KSwgcmVsYXRpb25zaGlwcyk7XG4gIH1cblxuICBwYWdpbmF0ZShsaW5rLCBsaW1pdCkge1xuICAgIHZhciBidWZmZXIgPSBbXTtcbiAgICB2YXIgcmVzb3VyY2VDb3VudCA9IDA7XG4gICAgY29uc3QgaW5GbGlnaHQgPSBuZXcgU2V0KFtdKTtcblxuICAgIGNvbnN0IGRvUmVxdWVzdCA9IG5leHRMaW5rID0+IHtcbiAgICAgIGluRmxpZ2h0LmFkZChuZXh0TGluayk7XG4gICAgICByZXR1cm4gdGhpcy5mZXRjaERvY3VtZW50KG5leHRMaW5rKS50aGVuKGRvYyA9PiB7XG4gICAgICAgIGluRmxpZ2h0LmRlbGV0ZShuZXh0TGluayk7XG4gICAgICAgIGxpbmsgPSBkb2MubGlua3MubmV4dCB8fCBmYWxzZTtcbiAgICAgICAgdmFyIHJlc291cmNlcyA9IHRoaXMuZG9jdW1lbnREYXRhKGRvYyk7XG4gICAgICAgIHJlc291cmNlQ291bnQgKz0gKHJlc291cmNlcykgPyByZXNvdXJjZXMubGVuZ3RoIDogMDtcbiAgICAgICAgYnVmZmVyLnB1c2goLi4uKHJlc291cmNlcyB8fCBbXSkpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGJ1ZmZlcik7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgdmFyIGNvbGxlY3Rpb25SZXF1ZXN0cyA9IFtdO1xuICAgIGNvbnN0IGFkdmFuY2UgPSAoKSA9PiB7XG4gICAgICBpZiAobGluayAmJiAhaW5GbGlnaHQuaGFzKGxpbmspICYmIChsaW1pdCA9PT0gLTEgfHwgcmVzb3VyY2VDb3VudCA8IGxpbWl0KSkge1xuICAgICAgICBjb2xsZWN0aW9uUmVxdWVzdHMucHVzaChkb1JlcXVlc3QobGluaykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuICFidWZmZXIubGVuZ3RoICYmIGNvbGxlY3Rpb25SZXF1ZXN0cy5sZW5ndGhcbiAgICAgICAgPyBjb2xsZWN0aW9uUmVxdWVzdHMuc2hpZnQoKS50aGVuKCgpID0+IGJ1ZmZlcilcbiAgICAgICAgOiBQcm9taXNlLnJlc29sdmUoYnVmZmVyKTtcbiAgICB9O1xuXG4gICAgY29uc3QgY3Vyc29yID0gKGZ1bmN0aW9uKigpIHtcbiAgICAgIHdoaWxlIChidWZmZXIubGVuZ3RoIHx8IGluRmxpZ2h0LnNpemUgfHwgbGluaykge1xuICAgICAgICB5aWVsZCBsaW1pdCA9PT0gLTEgfHwgcmVzb3VyY2VDb3VudCA8IGxpbWl0ID8gYWR2YW5jZSgpLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICBjb25zdCByZXNvdXJjZSA9IGJ1ZmZlci5zaGlmdCgpO1xuICAgICAgICAgIHJldHVybiByZXNvdXJjZSB8fCBudWxsO1xuICAgICAgICB9KSA6IGZhbHNlO1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgY3Vyc29yLmNhbkNvbnRpbnVlID0gKCkgPT4gYnVmZmVyLmxlbmd0aCB8fCBpbkZsaWdodC5zaXplIHx8IGxpbms7XG4gICAgY3Vyc29yLmFkZE1vcmUgPSAobWFueSA9IC0xKSA9PiBtYW55ID09PSAtMSA/IChsaW1pdCA9IC0xKSA6IChsaW1pdCArPSBtYW55KTtcblxuICAgIHJldHVybiBjdXJzb3I7XG4gIH1cblxuICB0b0NvbnN1bWVyKGN1cnNvciwgcmVsYXRpb25zaGlwcyA9IG51bGwpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgY29uc3VtZTogZnVuY3Rpb24oY29uc3VtZXIpIHtcbiAgICAgICAgY29uc3QgZGVjb3JhdGVkQ29uc3VtZXIgPSBzZWxmLmRlY29yYXRlV2l0aFJlbGF0aW9uc2hpcHMoY29uc3VtZXIsIHJlbGF0aW9uc2hpcHMpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGYgPSBuZXh0ID0+IHtcbiAgICAgICAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgICAgICAgIG5leHRcbiAgICAgICAgICAgICAgICAudGhlbihyZXNvdXJjZSA9PiB7XG4gICAgICAgICAgICAgICAgICBkZWNvcmF0ZWRDb25zdW1lcihyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgICBmKGN1cnNvci5uZXh0KCkudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKHJlamVjdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXNvbHZlKFxuICAgICAgICAgICAgICAgIGN1cnNvci5jYW5Db250aW51ZSgpID8gY3Vyc29yLmFkZE1vcmUgOiBmYWxzZSxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIGYoY3Vyc29yLm5leHQoKS52YWx1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgZGVjb3JhdGVXaXRoUmVsYXRpb25zaGlwcyhjb25zdW1lciwgcmVsYXRpb25zaGlwcyA9IG51bGwpIHtcbiAgICBjb25zdCBkZWNvcmF0ZWQgPSAhcmVsYXRpb25zaGlwc1xuICAgICAgPyBjb25zdW1lclxuICAgICAgOiByZXNvdXJjZSA9PiB7XG4gICAgICAgIGNvbnN0IG1pcnJvciA9IHt9O1xuICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhyZWxhdGlvbnNoaXBzKS5mb3JFYWNoKHJlbGF0aW9uc2hpcCA9PiB7XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdHlwZW9mIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25zaGlwXSA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgID8ge2ZpZWxkOiByZWxhdGlvbnNoaXBzW3JlbGF0aW9uc2hpcF19XG4gICAgICAgICAgICA6IHJlbGF0aW9uc2hpcDtcbiAgICAgICAgICBsZXQgcGF0aCA9IFtdLCBsaW5rO1xuICAgICAgICAgIG1pcnJvcltyZWxhdGlvbnNoaXBdID0gKGxpbmsgPSBleHRyYWN0VmFsdWUoYHJlbGF0aW9uc2hpcHMuJHt0YXJnZXQuZmllbGR9LmxpbmtzLnJlbGF0ZWRgLCByZXNvdXJjZSkpXG4gICAgICAgICAgICA/IHRoaXMudG9Db25zdW1lcih0aGlzLnBhZ2luYXRlKGxpbmssIHRhcmdldC5saW1pdCB8fCAtMSkpXG4gICAgICAgICAgICA6IFByb21pc2UucmVqZWN0KCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdW1lcihyZXNvdXJjZSwgbWlycm9yKTtcbiAgICAgIH07XG4gICAgcmV0dXJuIHJlc291cmNlID0+IHtcbiAgICAgIC8vIE9ubHkgY2FsbCB0aGUgY29uc3VtZXIgd2l0aCBub24tbnVsbCB2YWx1ZXMuXG4gICAgICBpZiAocmVzb3VyY2UpIGRlY29yYXRlZChyZXNvdXJjZSk7XG4gICAgfTtcbiAgfVxuXG4gIGZldGNoRG9jdW1lbnQodXJsKSB7XG4gICAgcmV0dXJuIGZldGNoKHVybCkudGhlbihcbiAgICAgIHJlcyA9PiAocmVzLm9rID8gcmVzLmpzb24oKSA6IFByb21pc2UucmVqZWN0KHJlcy5zdGF0dXNUZXh0KSksXG4gICAgKTtcbiAgfVxuXG4gIGRvY3VtZW50RGF0YShkb2MpIHtcbiAgICBpZiAoZG9jLmhhc093blByb3BlcnR5KCdkYXRhJykpIHtcbiAgICAgIHJldHVybiBkb2MuZGF0YTtcbiAgICB9XG4gICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eSgnZXJyb3JzJykpIHtcbiAgICAgIGRvYy5lcnJvcnMuZm9yRWFjaCh0aGlzLmxvZ2dlci5sb2cpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9nZ2VyLmxvZyhcbiAgICAgICAgJ1RoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5wcm9jZXNzYWJsZSBkb2N1bWVudCB3aXRoIG5vIGRhdGEgb3IgZXJyb3JzLicsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGdldExpbmsodHlwZSkge1xuICAgIHJldHVybiB0aGlzLmxpbmtzLnRoZW4obGlua3MgPT4ge1xuICAgICAgaWYgKCFsaW5rcy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkge1xuICAgICAgICBQcm9taXNlLnJlamVjdChgJyR7dHlwZX0nIGlzIG5vdCBhIHZhbGlkIHR5cGUgZm9yICR7dGhpcy5iYXNlVXJsfS5gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsaW5rc1t0eXBlXTtcbiAgICB9KTtcbiAgfVxuXG4gIGZpbHRlcihmKSB7XG4gICAgcmV0dXJuIG5ldyBGaWx0ZXIoZik7XG4gIH1cblxuICBhc3luYyBjb2xsZWN0aW9uTGluayh0eXBlLCB7c29ydCwgZmlsdGVyLCBwYWdlfSA9IHt9KSB7XG4gICAgbGV0IHF1ZXJ5ID0gJyc7XG4gICAgcXVlcnkgKz0gZmlsdGVyLmxlbmd0aCA/IGA/JHtmaWx0ZXJ9YCA6ICcnO1xuICAgIHF1ZXJ5ICs9IHNvcnQubGVuZ3RoID8gYCR7cXVlcnkubGVuZ3RoID8gJyYnIDogJz8nfXNvcnQ9JHtzb3J0fWAgOiAnJztcbiAgICBxdWVyeSArPSBwYWdlLmxlbmd0aCA/IGAke3F1ZXJ5Lmxlbmd0aCA/ICcmJyA6ICc/J30ke3BhZ2V9YCA6ICcnO1xuICAgIHJldHVybiBgJHthd2FpdCB0aGlzLmdldExpbmsodHlwZSl9JHtxdWVyeX1gO1xuICB9XG5cbn1cblxuZnVuY3Rpb24gZXh0cmFjdFZhbHVlKHBhdGgsIG9iaikge1xuICByZXR1cm4gcGF0aC5zcGxpdCgnLicpLnJlZHVjZSgoZXhpc3RzLCBwYXJ0KSA9PiBleGlzdHMgJiYgZXhpc3RzLmhhc093blByb3BlcnR5KHBhcnQpID8gZXhpc3RzW3BhcnRdIDogZmFsc2UsIG9iaik7XG59XG5cblxuXG4vLyBXRUJQQUNLIEZPT1RFUiAvL1xuLy8gLi9zcmMvbGliL2luZGV4LmpzIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRmlsdGVyIHtcblxuICBjb25zdHJ1Y3RvcihmKSB7XG4gICAgdGhpcy5jb25kaXRpb25zID0gZihDb25kaXRpb25zLCAoa2V5KSA9PiAocGFyYW1ldGVycykgPT4gcGFyYW1ldGVyc1trZXldKTtcbiAgfVxuXG4gIGNvbXBpbGUocGFyYW1ldGVycykge1xuICAgIGNvbnN0IGlkID0gZnVuY3Rpb24qICgpIHtcbiAgICAgIHZhciBjb3VudGVyID0gMTtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHlpZWxkIGNvdW50ZXIrKztcbiAgICAgIH1cbiAgICB9KCk7XG5cbiAgICBjb25zdCBjb21waWxlciA9IChhY2MsIGl0ZW0sIF8sIHBhcmVudElEID0gbnVsbCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudElEID0gaWQubmV4dCgpLnZhbHVlO1xuICAgICAgY29uc3QgcHJlZml4ID0gYWNjLmxlbmd0aCA/IGAke2FjY30mYCA6ICcnO1xuICAgICAgaWYgKGl0ZW0ubWVtYmVycykge1xuICAgICAgICBjb25zdCByb290ID0gYGZpbHRlclske2N1cnJlbnRJRH1dW2dyb3VwXWA7XG4gICAgICAgIGNvbnN0IHNlbGYgPSBwYXJlbnRJRFxuICAgICAgICAgID8gYCR7cm9vdH1bY29uanVuY3Rpb25dPSR7aXRlbS5jb25qdW5jdGlvbn0mJHtyb290fVttZW1iZXJPZl09JHtwYXJlbnRJRH1gXG4gICAgICAgICAgOiBgJHtyb290fVtjb25qdW5jdGlvbl09JHtpdGVtLmNvbmp1bmN0aW9ufWA7XG4gICAgICAgIHJldHVybiBgJHtwcmVmaXh9JHtpdGVtLm1lbWJlcnMucmVkdWNlKChhY2MsIGl0ZW0sIF8pID0+IGNvbXBpbGVyKGFjYywgaXRlbSwgXywgY3VycmVudElEKSwgc2VsZil9YDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zdCByb290ID0gYGZpbHRlclske2N1cnJlbnRJRH1dW2NvbmRpdGlvbl1gO1xuICAgICAgICB2YXIgc2VsZiA9ICcnO1xuICAgICAgICBzZWxmICs9IGAke3Jvb3R9W3BhdGhdPSR7aXRlbS5wYXRofWA7XG4gICAgICAgIC8vIEB0b2RvIGV4cGFuZCBmb3IgbXVsdGl2YWx1ZSBvcGVyYXRvcnMgYW4gbnVsbC9ub3QgbnVsbFxuICAgICAgICBzZWxmICs9IGAmJHtyb290fVt2YWx1ZV09JHt0eXBlb2YgaXRlbS52YWx1ZSA9PT0gXCJmdW5jdGlvblwiID8gaXRlbS52YWx1ZShwYXJhbWV0ZXJzKSA6IGl0ZW0udmFsdWV9YDtcbiAgICAgICAgc2VsZiArPSBgJiR7cm9vdH1bb3BlcmF0b3JdPSR7aXRlbS5vcGVyYXRvcn1gO1xuICAgICAgICByZXR1cm4gcGFyZW50SURcbiAgICAgICAgICA/IGAke3ByZWZpeH0ke3NlbGZ9JiR7cm9vdH1bbWVtYmVyT2ZdPSR7cGFyZW50SUR9YFxuICAgICAgICAgIDogYCR7cHJlZml4fSR7c2VsZn1gO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gY29tcGlsZXIoJycsIHRoaXMuY29uZGl0aW9ucyk7XG4gIH1cblxufVxuXG5jb25zdCBHcm91cHMgPSB7XG5cbiAgYW5kOiAoLi4ubWVtYmVycykgPT4ge1xuICAgIHJldHVybiBHcm91cHMuZ3JvdXAobWVtYmVycywgJ0FORCcpO1xuICB9LFxuXG4gIG9yOiAoLi4ubWVtYmVycykgPT4ge1xuICAgIHJldHVybiBHcm91cHMuZ3JvdXAobWVtYmVycywgJ09SJyk7XG4gIH0sXG5cbiAgZ3JvdXA6IChtZW1iZXJzLCBjb25qdW5jdGlvbikgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBjb25qdW5jdGlvbixcbiAgICAgIG1lbWJlcnMsXG4gICAgfVxuICB9LFxuXG59XG5cbmNvbnN0IENvbmRpdGlvbnMgPSBmdW5jdGlvbiAoZiwgdikge1xuICByZXR1cm4gQ29uZGl0aW9ucy5lcShmLCB2KTtcbn1cblxuQ29uZGl0aW9ucy5hbmQgPSBHcm91cHMuYW5kO1xuXG5Db25kaXRpb25zLm9yID0gR3JvdXBzLm9yO1xuXG5Db25kaXRpb25zLmVxID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc9Jyk7XG59XG5cbkNvbmRpdGlvbnMubm90RXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJzw+Jyk7XG59XG5cbkNvbmRpdGlvbnMuZ3QgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJz4nKTtcbn1cblxuQ29uZGl0aW9ucy5ndEVxID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc+PScpO1xufVxuXG5Db25kaXRpb25zLmx0ID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc8Jyk7XG59XG5cbkNvbmRpdGlvbnMubHRFcSA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPD0nKTtcbn1cblxuQ29uZGl0aW9ucy5zdGFydHNXaXRoID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICdTVEFSVFNfV0lUSCcpO1xufVxuXG5Db25kaXRpb25zLmNvbnRhaW5zID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICdDT05UQUlOUycpO1xufVxuXG5Db25kaXRpb25zLmVuZHNXaXRoID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICdFTkRTX1dJVEgnKTtcbn1cblxuLy8gQHRvZG8gYWRkIHN1cHBvcnQgZm9yOiAnSU4nLCAnTk9UIElOJ1xuLy8gQHRvZG8gYWRkIHN1cHBvcnQgZm9yOiAnQkVUV0VFTicsICdOT1QgQkVUV0VFTidcbi8vIEB0b2RvIGFkZCBzdXBwb3J0IGZvcjogJ0lTIE5VTEwnLCAnSVMgTk9UIE5VTEwnXG5cbkNvbmRpdGlvbnMuY29uZGl0aW9uID0gKGYsIHYsIG9wKSA9PiB7XG4gIHJldHVybiB7XG4gICAgcGF0aDogZixcbiAgICB2YWx1ZTogdixcbiAgICBvcGVyYXRvcjogZW5jb2RlVVJJQ29tcG9uZW50KG9wKSxcbiAgfTtcbn1cblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9saWIvZmlsdGVycy5qcyJdLCJzb3VyY2VSb290IjoiIn0=