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

const client = new __WEBPACK_IMPORTED_MODULE_0__lib__["a" /* default */]('http://jsonapi.test:8080', console);

const logger = label => {
  return resource => console.log(`${label}:`, resource.attributes.title);
};

const filter = client.filter((c, and, or, param) => {
  return and(c('status', 1), or(c.contains('title', param('paramOne')), c.startsWith('title', 'Thai')));
});
const options = {
  max: 3,
  sort: 'title' //filter: filter.compile({paramOne: 'easy'}),

};
client.all('node--recipe', options).then(cursor => {
  return cursor.forEach(logger('Initial')).then(more => {
    console.log(`There are ${more ? 'more' : 'no more'} resources!`);

    if (more) {
      more(2);
      cursor.forEach(logger('Additional')).then(evenMore => {
        console.log(`There are ${evenMore ? 'more' : 'no more'} resources!`);
      });
    }
  });
}).catch(error => console.log('Error:', error)); //client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(resource => console.log('Individual:', resource))
//  .catch(error => console.log('Error:', error));

/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__filters_js__ = __webpack_require__(2);

class DrupalClient {
  constructor(baseUrl, logger) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.links = new Promise((resolve, reject) => {
      this.fetchDocument(`${baseUrl}/jsonapi`).then(doc => resolve(doc.links || {})).catch(err => {
        this.logger.log('Unable to resolve resource links.');
        reject(err);
      });
    });
  }

  get(type, id) {
    return this.withLink(type).then(link => this.fetchDocument(`${link}/${id}`)).then(doc => this.documentData(doc)).catch(err => {
      this.logger.log(err);
      return null;
    });
  }

  all(type, {
    max = -1,
    sort = '',
    filter = ''
  } = {}) {
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
      var resourceCount = 0;
      const inFlight = new Set([]);

      const doRequest = nextLink => {
        inFlight.add(nextLink);
        return this.fetchDocument(nextLink).then(doc => {
          inFlight.delete(nextLink);
          link = doc.links.next || false;
          var resources = this.documentData(doc);
          resourceCount += resources ? resources.length : 0;
          collection.push(...(resources || []));
          return Promise.resolve(collection);
        });
      };

      const advance = () => {
        if (link && !inFlight.has(link) && (max === -1 || resourceCount < max)) {
          collectionRequests.push(doRequest(link));
        }

        if (!collection.length && collectionRequests.length) {
          return collectionRequests.shift();
        } else {
          return Promise.resolve(collection);
        }
      };

      var count = 0;

      const cursor = function* () {
        while (collection.length || inFlight.size || link) {
          yield advance().then(view => {
            const resource = view.shift();
            return resource || null;
          });
        }
      }();

      return {
        forEach: function forEach(g) {
          return new Promise((resolve, reject) => {
            const f = next => {
              if (next) {
                next.then(resource => {
                  count++;
                  if (resource) g(resource);
                  f(max === -1 || count < max ? cursor.next().value : false);
                }).catch(reject);
              } else {
                const addMore = (many = -1) => {
                  return many === -1 ? max = -1 : max += many;
                };

                resolve(collection.length || inFlight.size || link ? addMore : false);
              }
            };

            f(max === -1 || count < max ? cursor.next().value : false);
          });
        }
      };
    });
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

  withLink(type) {
    return new Promise((resolve, reject) => {
      this.links.then(links => {
        if (!links.hasOwnProperty(type)) {
          reject(`'${type}' is not a valid type for ${this.baseUrl}.`);
        }

        resolve(links[type]);
      }).catch(reject);
    });
  }

  filter(f) {
    return new __WEBPACK_IMPORTED_MODULE_0__filters_js__["a" /* default */](f);
  }

}
/* harmony export (immutable) */ __webpack_exports__["a"] = DrupalClient;


/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
class Filter {
  constructor(f) {
    this.conditions = f(Conditions, Groups.and, Groups.or, key => parameters => parameters[key]);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgYjYwNjIxOTMwN2VmNjI5NjY0MjQiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbImNsaWVudCIsImNvbnNvbGUiLCJsb2dnZXIiLCJsYWJlbCIsInJlc291cmNlIiwibG9nIiwiYXR0cmlidXRlcyIsInRpdGxlIiwiZmlsdGVyIiwiYyIsImFuZCIsIm9yIiwicGFyYW0iLCJjb250YWlucyIsInN0YXJ0c1dpdGgiLCJvcHRpb25zIiwibWF4Iiwic29ydCIsImFsbCIsInRoZW4iLCJjdXJzb3IiLCJmb3JFYWNoIiwibW9yZSIsImV2ZW5Nb3JlIiwiY2F0Y2giLCJlcnJvciIsIkRydXBhbENsaWVudCIsImNvbnN0cnVjdG9yIiwiYmFzZVVybCIsImxpbmtzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJmZXRjaERvY3VtZW50IiwiZG9jIiwiZXJyIiwiZ2V0IiwidHlwZSIsImlkIiwid2l0aExpbmsiLCJsaW5rIiwiZG9jdW1lbnREYXRhIiwiYmFzZUxpbmsiLCJsZW5ndGgiLCJjb2xsZWN0aW9uUmVxdWVzdHMiLCJjb2xsZWN0aW9uIiwicmVzb3VyY2VDb3VudCIsImluRmxpZ2h0IiwiU2V0IiwiZG9SZXF1ZXN0IiwibmV4dExpbmsiLCJhZGQiLCJkZWxldGUiLCJuZXh0IiwicmVzb3VyY2VzIiwicHVzaCIsImFkdmFuY2UiLCJoYXMiLCJzaGlmdCIsImNvdW50Iiwic2l6ZSIsInZpZXciLCJnIiwiZiIsInZhbHVlIiwiYWRkTW9yZSIsIm1hbnkiLCJ1cmwiLCJmZXRjaCIsInJlcyIsIm9rIiwianNvbiIsInN0YXR1c1RleHQiLCJoYXNPd25Qcm9wZXJ0eSIsImRhdGEiLCJlcnJvcnMiLCJGaWx0ZXIiLCJjb25kaXRpb25zIiwiQ29uZGl0aW9ucyIsIkdyb3VwcyIsImtleSIsInBhcmFtZXRlcnMiLCJjb21waWxlIiwiY291bnRlciIsImNvbXBpbGVyIiwiYWNjIiwiaXRlbSIsIl8iLCJwYXJlbnRJRCIsImN1cnJlbnRJRCIsInByZWZpeCIsIm1lbWJlcnMiLCJyb290Iiwic2VsZiIsImNvbmp1bmN0aW9uIiwicmVkdWNlIiwicGF0aCIsIm9wZXJhdG9yIiwiZ3JvdXAiLCJ2IiwiZXEiLCJjb25kaXRpb24iLCJub3RFcSIsImd0IiwiZ3RFcSIsImx0IiwibHRFcSIsImVuZHNXaXRoIiwib3AiLCJlbmNvZGVVUklDb21wb25lbnQiXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsbUNBQTJCLDBCQUEwQixFQUFFO0FBQ3ZELHlDQUFpQyxlQUFlO0FBQ2hEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDhEQUFzRCwrREFBK0Q7O0FBRXJIO0FBQ0E7O0FBRUE7QUFDQTs7Ozs7Ozs7OztBQzdEQTtBQUVBLE1BQU1BLFNBQVMsSUFBSSxxREFBSixDQUFZLDBCQUFaLEVBQXdDQyxPQUF4QyxDQUFmOztBQUVBLE1BQU1DLFNBQVNDLFNBQVM7QUFDdEIsU0FBT0MsWUFBWUgsUUFBUUksR0FBUixDQUFhLEdBQUVGLEtBQU0sR0FBckIsRUFBeUJDLFNBQVNFLFVBQVQsQ0FBb0JDLEtBQTdDLENBQW5CO0FBQ0QsQ0FGRDs7QUFJQSxNQUFNQyxTQUFTUixPQUFPUSxNQUFQLENBQWMsQ0FBQ0MsQ0FBRCxFQUFJQyxHQUFKLEVBQVNDLEVBQVQsRUFBYUMsS0FBYixLQUF1QjtBQUNsRCxTQUFPRixJQUNMRCxFQUFFLFFBQUYsRUFB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QUFXdUIsU0FBWCxDQUFxQnRDLENBQXJCLEVBQXdCb0MsQ0FBeEIsRUFBMkIsVUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXNkIsUUFBWCxHQUFzQixDQUFDNUMsQ0FBRCxFQUFJb0MsQ0FBSixLQUFVO0FBQzlCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnRDLENBQXJCLEVBQXdCb0MsQ0FBeEIsRUFBMkIsV0FBM0IsQ0FBUDtBQUNELENBRkQsQyxDQUlBO0FBQ0E7QUFDQTs7O0FBRUFyQixXQUFXdUIsU0FBWCxHQUF1QixDQUFDdEMsQ0FBRCxFQUFJb0MsQ0FBSixFQUFPUyxFQUFQLEtBQWM7QUFDbkMsU0FBTztBQUNMWixVQUFNakMsQ0FERDtBQUVMQyxXQUFPbUMsQ0FGRjtBQUdMRixjQUFVWSxtQkFBbUJELEVBQW5CO0FBSEwsR0FBUDtBQUtELENBTkQsQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKSB7XG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG4gXHRcdH1cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGk6IG1vZHVsZUlkLFxuIFx0XHRcdGw6IGZhbHNlLFxuIFx0XHRcdGV4cG9ydHM6IHt9XG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmwgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb24gZm9yIGhhcm1vbnkgZXhwb3J0c1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kID0gZnVuY3Rpb24oZXhwb3J0cywgbmFtZSwgZ2V0dGVyKSB7XG4gXHRcdGlmKCFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywgbmFtZSkpIHtcbiBcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgbmFtZSwge1xuIFx0XHRcdFx0Y29uZmlndXJhYmxlOiBmYWxzZSxcbiBcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG4gXHRcdFx0XHRnZXQ6IGdldHRlclxuIFx0XHRcdH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5uID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gXHRcdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuIFx0XHRcdGZ1bmN0aW9uIGdldERlZmF1bHQoKSB7IHJldHVybiBtb2R1bGVbJ2RlZmF1bHQnXTsgfSA6XG4gXHRcdFx0ZnVuY3Rpb24gZ2V0TW9kdWxlRXhwb3J0cygpIHsgcmV0dXJuIG1vZHVsZTsgfTtcbiBcdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgJ2EnLCBnZXR0ZXIpO1xuIFx0XHRyZXR1cm4gZ2V0dGVyO1xuIFx0fTtcblxuIFx0Ly8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7IHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSk7IH07XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IDApO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIHdlYnBhY2svYm9vdHN0cmFwIGI2MDYyMTkzMDdlZjYyOTY2NDI0IiwiaW1wb3J0IERDbGllbnQgZnJvbSAnLi9saWInO1xuXG5jb25zdCBjbGllbnQgPSBuZXcgRENsaWVudCgnaHR0cDovL2pzb25hcGkudGVzdDo4MDgwJywgY29uc29sZSk7XG5cbmNvbnN0IGxvZ2dlciA9IGxhYmVsID0+IHtcbiAgcmV0dXJuIHJlc291cmNlID0+IGNvbnNvbGUubG9nKGAke2xhYmVsfTpgLCByZXNvdXJjZS5hdHRyaWJ1dGVzLnRpdGxlKTtcbn07XG5cbmNvbnN0IGZpbHRlciA9IGNsaWVudC5maWx0ZXIoKGMsIGFuZCwgb3IsIHBhcmFtKSA9PiB7XG4gIHJldHVybiBhbmQoXG4gICAgYygnc3RhdHVzJywgMSksXG4gICAgb3IoYy5jb250YWlucygndGl0bGUnLCBwYXJhbSgncGFyYW1PbmUnKSksIGMuc3RhcnRzV2l0aCgndGl0bGUnLCAnVGhhaScpKSxcbiAgKTtcbn0pO1xuXG5jb25zdCBvcHRpb25zID0ge1xuICBtYXg6IDMsXG4gIHNvcnQ6ICd0aXRsZScsXG4gIC8vZmlsdGVyOiBmaWx0ZXIuY29tcGlsZSh7cGFyYW1PbmU6ICdlYXN5J30pLFxufTtcblxuY2xpZW50XG4gIC5hbGwoJ25vZGUtLXJlY2lwZScsIG9wdGlvbnMpXG4gIC50aGVuKGN1cnNvciA9PiB7XG4gICAgcmV0dXJuIGN1cnNvci5mb3JFYWNoKGxvZ2dlcignSW5pdGlhbCcpKS50aGVuKG1vcmUgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFRoZXJlIGFyZSAke21vcmUgPyAnbW9yZScgOiAnbm8gbW9yZSd9IHJlc291cmNlcyFgKTtcbiAgICAgIGlmIChtb3JlKSB7XG4gICAgICAgIG1vcmUoMik7XG4gICAgICAgIGN1cnNvci5mb3JFYWNoKGxvZ2dlcignQWRkaXRpb25hbCcpKS50aGVuKGV2ZW5Nb3JlID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgVGhlcmUgYXJlICR7ZXZlbk1vcmUgPyAnbW9yZScgOiAnbm8gbW9yZSd9IHJlc291cmNlcyFgKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pXG4gIC5jYXRjaChlcnJvciA9PiBjb25zb2xlLmxvZygnRXJyb3I6JywgZXJyb3IpKTtcblxuLy9jbGllbnQuZ2V0KCdub2RlLS1yZWNpcGUnLCAnMjVjMDQ4YjYtNjllOS00NmY0LTk4NmQtNGI4MGIwMWRlMmU2Jylcbi8vICAudGhlbihyZXNvdXJjZSA9PiBjb25zb2xlLmxvZygnSW5kaXZpZHVhbDonLCByZXNvdXJjZSkpXG4vLyAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUubG9nKCdFcnJvcjonLCBlcnJvcikpO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2luZGV4LmpzIiwiaW1wb3J0IEZpbHRlciBmcm9tICcuL2ZpbHRlcnMuanMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcnVwYWxDbGllbnQge1xuICBjb25zdHJ1Y3RvcihiYXNlVXJsLCBsb2dnZXIpIHtcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xuICAgIHRoaXMubG9nZ2VyID0gbG9nZ2VyO1xuICAgIHRoaXMubGlua3MgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLmZldGNoRG9jdW1lbnQoYCR7YmFzZVVybH0vanNvbmFwaWApXG4gICAgICAgIC50aGVuKGRvYyA9PiByZXNvbHZlKGRvYy5saW5rcyB8fCB7fSkpXG4gICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgIHRoaXMubG9nZ2VyLmxvZygnVW5hYmxlIHRvIHJlc29sdmUgcmVzb3VyY2UgbGlua3MuJyk7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0KHR5cGUsIGlkKSB7XG4gICAgcmV0dXJuIHRoaXMud2l0aExpbmsodHlwZSlcbiAgICAgIC50aGVuKGxpbmsgPT4gdGhpcy5mZXRjaERvY3VtZW50KGAke2xpbmt9LyR7aWR9YCkpXG4gICAgICAudGhlbihkb2MgPT4gdGhpcy5kb2N1bWVudERhdGEoZG9jKSlcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICB0aGlzLmxvZ2dlci5sb2coZXJyKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9KTtcbiAgfVxuXG4gIGFsbCh0eXBlLCB7IG1heCA9IC0xLCBzb3J0ID0gJycsIGZpbHRlciA9ICcnIH0gPSB7fSkge1xuICAgIHJldHVybiB0aGlzLndpdGhMaW5rKHR5cGUpLnRoZW4oYmFzZUxpbmsgPT4ge1xuICAgICAgdmFyIGxpbmsgPSBgJHtiYXNlTGlua31gO1xuICAgICAgaWYgKGZpbHRlci5sZW5ndGgpIHtcbiAgICAgICAgbGluayArPSBgPyR7ZmlsdGVyfWA7XG4gICAgICB9XG4gICAgICBpZiAoc29ydC5sZW5ndGgpIHtcbiAgICAgICAgbGluayArPSBgJHtmaWx0ZXIubGVuZ3RoID8gJyYnIDogJz8nfXNvcnQ9JHtzb3J0fWA7XG4gICAgICB9XG4gICAgICB2YXIgY29sbGVjdGlvblJlcXVlc3RzID0gW107XG4gICAgICB2YXIgY29sbGVjdGlvbiA9IFtdO1xuICAgICAgdmFyIHJlc291cmNlQ291bnQgPSAwO1xuICAgICAgY29uc3QgaW5GbGlnaHQgPSBuZXcgU2V0KFtdKTtcbiAgICAgIGNvbnN0IGRvUmVxdWVzdCA9IG5leHRMaW5rID0+IHtcbiAgICAgICAgaW5GbGlnaHQuYWRkKG5leHRMaW5rKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmV0Y2hEb2N1bWVudChuZXh0TGluaykudGhlbihkb2MgPT4ge1xuICAgICAgICAgIGluRmxpZ2h0LmRlbGV0ZShuZXh0TGluayk7XG4gICAgICAgICAgbGluayA9IGRvYy5saW5rcy5uZXh0IHx8IGZhbHNlO1xuICAgICAgICAgIHZhciByZXNvdXJjZXMgPSB0aGlzLmRvY3VtZW50RGF0YShkb2MpO1xuICAgICAgICAgIHJlc291cmNlQ291bnQgKz0gKHJlc291cmNlcykgPyByZXNvdXJjZXMubGVuZ3RoIDogMDtcbiAgICAgICAgICBjb2xsZWN0aW9uLnB1c2goLi4uKHJlc291cmNlcyB8fCBbXSkpO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoY29sbGVjdGlvbik7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIGNvbnN0IGFkdmFuY2UgPSAoKSA9PiB7XG4gICAgICAgIGlmIChsaW5rICYmICFpbkZsaWdodC5oYXMobGluaykgJiYgKG1heCA9PT0gLTEgfHwgcmVzb3VyY2VDb3VudCA8IG1heCkpIHtcbiAgICAgICAgICBjb2xsZWN0aW9uUmVxdWVzdHMucHVzaChkb1JlcXVlc3QobGluaykpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghY29sbGVjdGlvbi5sZW5ndGggJiYgY29sbGVjdGlvblJlcXVlc3RzLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uUmVxdWVzdHMuc2hpZnQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGNvbGxlY3Rpb24pO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgY29uc3QgY3Vyc29yID0gKGZ1bmN0aW9uKigpIHtcbiAgICAgICAgd2hpbGUgKGNvbGxlY3Rpb24ubGVuZ3RoIHx8IGluRmxpZ2h0LnNpemUgfHwgbGluaykge1xuICAgICAgICAgIHlpZWxkIGFkdmFuY2UoKS50aGVuKHZpZXcgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2UgPSB2aWV3LnNoaWZ0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2UgfHwgbnVsbDtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZm9yRWFjaDogZnVuY3Rpb24oZykge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmID0gbmV4dCA9PiB7XG4gICAgICAgICAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgICAgICAgICAgbmV4dFxuICAgICAgICAgICAgICAgICAgLnRoZW4ocmVzb3VyY2UgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2UpIGcocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgICBmKG1heCA9PT0gLTEgfHwgY291bnQgPCBtYXggPyBjdXJzb3IubmV4dCgpLnZhbHVlIDogZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFkZE1vcmUgPSAobWFueSA9IC0xKSA9PiB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gbWFueSA9PT0gLTEgPyAobWF4ID0gLTEpIDogKG1heCArPSBtYW55KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uLmxlbmd0aCB8fCBpbkZsaWdodC5zaXplIHx8IGxpbmsgPyBhZGRNb3JlIDogZmFsc2UsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGYobWF4ID09PSAtMSB8fCBjb3VudCA8IG1heCA/IGN1cnNvci5uZXh0KCkudmFsdWUgOiBmYWxzZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZmV0Y2hEb2N1bWVudCh1cmwpIHtcbiAgICByZXR1cm4gZmV0Y2godXJsKS50aGVuKFxuICAgICAgcmVzID0+IChyZXMub2sgPyByZXMuanNvbigpIDogUHJvbWlzZS5yZWplY3QocmVzLnN0YXR1c1RleHQpKSxcbiAgICApO1xuICB9XG5cbiAgZG9jdW1lbnREYXRhKGRvYykge1xuICAgIGlmIChkb2MuaGFzT3duUHJvcGVydHkoJ2RhdGEnKSkge1xuICAgICAgcmV0dXJuIGRvYy5kYXRhO1xuICAgIH1cbiAgICBpZiAoZG9jLmhhc093blByb3BlcnR5KCdlcnJvcnMnKSkge1xuICAgICAgZG9jLmVycm9ycy5mb3JFYWNoKHRoaXMubG9nZ2VyLmxvZyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sb2dnZXIubG9nKFxuICAgICAgICAnVGhlIHNlcnZlciByZXR1cm5lZCBhbiB1bnByb2Nlc3NhYmxlIGRvY3VtZW50IHdpdGggbm8gZGF0YSBvciBlcnJvcnMuJyxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgd2l0aExpbmsodHlwZSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLmxpbmtzXG4gICAgICAgIC50aGVuKGxpbmtzID0+IHtcbiAgICAgICAgICBpZiAoIWxpbmtzLmhhc093blByb3BlcnR5KHR5cGUpKSB7XG4gICAgICAgICAgICByZWplY3QoYCcke3R5cGV9JyBpcyBub3QgYSB2YWxpZCB0eXBlIGZvciAke3RoaXMuYmFzZVVybH0uYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlc29sdmUobGlua3NbdHlwZV0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZpbHRlcihmKSB7XG4gICAgcmV0dXJuIG5ldyBGaWx0ZXIoZik7XG4gIH1cblxufVxuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2xpYi9pbmRleC5qcyIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEZpbHRlciB7XG5cbiAgY29uc3RydWN0b3IoZikge1xuICAgIHRoaXMuY29uZGl0aW9ucyA9IGYoQ29uZGl0aW9ucywgR3JvdXBzLmFuZCwgR3JvdXBzLm9yLCAoa2V5KSA9PiAocGFyYW1ldGVycykgPT4gcGFyYW1ldGVyc1trZXldKTtcbiAgfVxuXG4gIGNvbXBpbGUocGFyYW1ldGVycykge1xuICAgIGNvbnN0IGlkID0gZnVuY3Rpb24qICgpIHtcbiAgICAgIHZhciBjb3VudGVyID0gMTtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHlpZWxkIGNvdW50ZXIrKztcbiAgICAgIH1cbiAgICB9KCk7XG5cbiAgICBjb25zdCBjb21waWxlciA9IChhY2MsIGl0ZW0sIF8sIHBhcmVudElEID0gbnVsbCkgPT4ge1xuICAgICAgY29uc3QgY3VycmVudElEID0gaWQubmV4dCgpLnZhbHVlO1xuICAgICAgY29uc3QgcHJlZml4ID0gYWNjLmxlbmd0aCA/IGAke2FjY30mYCA6ICcnO1xuICAgICAgaWYgKGl0ZW0ubWVtYmVycykge1xuICAgICAgICBjb25zdCByb290ID0gYGZpbHRlclske2N1cnJlbnRJRH1dW2dyb3VwXWA7XG4gICAgICAgIGNvbnN0IHNlbGYgPSBwYXJlbnRJRFxuICAgICAgICAgID8gYCR7cm9vdH1bY29uanVuY3Rpb25dPSR7aXRlbS5jb25qdW5jdGlvbn0mJHtyb290fVttZW1iZXJPZl09JHtwYXJlbnRJRH1gXG4gICAgICAgICAgOiBgJHtyb290fVtjb25qdW5jdGlvbl09JHtpdGVtLmNvbmp1bmN0aW9ufWA7XG4gICAgICAgIHJldHVybiBgJHtwcmVmaXh9JHtpdGVtLm1lbWJlcnMucmVkdWNlKChhY2MsIGl0ZW0sIF8pID0+IGNvbXBpbGVyKGFjYywgaXRlbSwgXywgY3VycmVudElEKSwgc2VsZil9YDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zdCByb290ID0gYGZpbHRlclske2N1cnJlbnRJRH1dW2NvbmRpdGlvbl1gO1xuICAgICAgICB2YXIgc2VsZiA9ICcnO1xuICAgICAgICBzZWxmICs9IGAke3Jvb3R9W3BhdGhdPSR7aXRlbS5wYXRofWA7XG4gICAgICAgIC8vIEB0b2RvIGV4cGFuZCBmb3IgbXVsdGl2YWx1ZSBvcGVyYXRvcnMgYW4gbnVsbC9ub3QgbnVsbFxuICAgICAgICBzZWxmICs9IGAmJHtyb290fVt2YWx1ZV09JHt0eXBlb2YgaXRlbS52YWx1ZSA9PT0gXCJmdW5jdGlvblwiID8gaXRlbS52YWx1ZShwYXJhbWV0ZXJzKSA6IGl0ZW0udmFsdWV9YDtcbiAgICAgICAgc2VsZiArPSBgJiR7cm9vdH1bb3BlcmF0b3JdPSR7aXRlbS5vcGVyYXRvcn1gO1xuICAgICAgICByZXR1cm4gcGFyZW50SURcbiAgICAgICAgICA/IGAke3ByZWZpeH0ke3NlbGZ9JiR7cm9vdH1bbWVtYmVyT2ZdPSR7cGFyZW50SUR9YFxuICAgICAgICAgIDogYCR7cHJlZml4fSR7c2VsZn1gO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gY29tcGlsZXIoJycsIHRoaXMuY29uZGl0aW9ucyk7XG4gIH1cblxufVxuXG5jb25zdCBHcm91cHMgPSB7XG5cbiAgYW5kOiAoLi4ubWVtYmVycykgPT4ge1xuICAgIHJldHVybiBHcm91cHMuZ3JvdXAobWVtYmVycywgJ0FORCcpO1xuICB9LFxuXG4gIG9yOiAoLi4ubWVtYmVycykgPT4ge1xuICAgIHJldHVybiBHcm91cHMuZ3JvdXAobWVtYmVycywgJ09SJyk7XG4gIH0sXG5cbiAgZ3JvdXA6IChtZW1iZXJzLCBjb25qdW5jdGlvbikgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBjb25qdW5jdGlvbixcbiAgICAgIG1lbWJlcnMsXG4gICAgfVxuICB9LFxuXG59XG5cbmNvbnN0IENvbmRpdGlvbnMgPSBmdW5jdGlvbiAoZiwgdikge1xuICByZXR1cm4gQ29uZGl0aW9ucy5lcShmLCB2KTtcbn1cblxuQ29uZGl0aW9ucy5lcSA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPScpO1xufVxuXG5Db25kaXRpb25zLm5vdEVxID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc8PicpO1xufVxuXG5Db25kaXRpb25zLmd0ID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc+Jyk7XG59XG5cbkNvbmRpdGlvbnMuZ3RFcSA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPj0nKTtcbn1cblxuQ29uZGl0aW9ucy5sdCA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPCcpO1xufVxuXG5Db25kaXRpb25zLmx0RXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJzw9Jyk7XG59XG5cbkNvbmRpdGlvbnMuc3RhcnRzV2l0aCA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnU1RBUlRTX1dJVEgnKTtcbn1cblxuQ29uZGl0aW9ucy5jb250YWlucyA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnQ09OVEFJTlMnKTtcbn1cblxuQ29uZGl0aW9ucy5lbmRzV2l0aCA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnRU5EU19XSVRIJyk7XG59XG5cbi8vIEB0b2RvIGFkZCBzdXBwb3J0IGZvcjogJ0lOJywgJ05PVCBJTidcbi8vIEB0b2RvIGFkZCBzdXBwb3J0IGZvcjogJ0JFVFdFRU4nLCAnTk9UIEJFVFdFRU4nXG4vLyBAdG9kbyBhZGQgc3VwcG9ydCBmb3I6ICdJUyBOVUxMJywgJ0lTIE5PVCBOVUxMJ1xuXG5Db25kaXRpb25zLmNvbmRpdGlvbiA9IChmLCB2LCBvcCkgPT4ge1xuICByZXR1cm4ge1xuICAgIHBhdGg6IGYsXG4gICAgdmFsdWU6IHYsXG4gICAgb3BlcmF0b3I6IGVuY29kZVVSSUNvbXBvbmVudChvcCksXG4gIH07XG59XG5cblxuXG4vLyBXRUJQQUNLIEZPT1RFUiAvL1xuLy8gLi9zcmMvbGliL2ZpbHRlcnMuanMiXSwic291cmNlUm9vdCI6IiJ9