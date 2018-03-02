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
const filter = client.filter((c, param) => {
  return c.and(c('status', 1), c.or(c.contains('title', param('paramOne')), c.startsWith('title', 'Thai')));
});
const options = {
  limit: 3,
  sort: 'title',
  //filter: filter.compile({paramOne: 'easy'}),
  relationships: {
    author: 'uid',
    tags: {
      field: 'field_tags',
      relationships: {
        vocabulary: 'vid'
      }
    }
  }
};
client.all('node--recipe', options).then(async feed => {
  while (more = await feed.consume(resource => console.log('Initial:', resource))) {
    console.log(`There are ${more ? 'more' : 'no more'} resources!`);
    more(2);
  }
}).catch(error => console.log('Error:', error)); //.then(more => {
//});
//console.log(`There are ${more ? 'more' : 'no more'} resources!`);
//if (more) {
//  more(20);
//  feed.consume(resource => console.log('Initial:', resource)).then(evenMore => {
//    console.log(`There are ${evenMore ? 'more' : 'no more'} resources!`);
//  });
//}
//client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
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
    limit = -1,
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

      var count = 0;

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

      return this.toConsumer(cursor);
    });
  }

  toConsumer(cursor) {
    return {
      consume: function consume(g) {
        return new Promise((resolve, reject) => {
          const f = next => {
            if (next) {
              next.then(resource => {
                if (resource) g(resource);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgZTA3YTg5MTkwZGZlZjExOWRhNDAiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbImNsaWVudCIsImNvbnNvbGUiLCJmaWx0ZXIiLCJjIiwicGFyYW0iLCJhbmQiLCJvciIsImNvbnRhaW5zIiwic3RhcnRzV2l0aCIsIm9wdGlvbnMiLCJsaW1pdCIsInNvcnQiLCJyZWxhdGlvbnNoaXBzIiwiYXV0aG9yIiwidGFncyIsImZpZWxkIiwidm9jYWJ1bGFyeSIsImFsbCIsInRoZW4iLCJmZWVkIiwibW9yZSIsImNvbnN1bWUiLCJyZXNvdXJjZSIsImxvZyIsImNhdGNoIiwiZXJyb3IiLCJEcnVwYWxDbGllbnQiLCJjb25zdHJ1Y3RvciIsImJhc2VVcmwiLCJsb2dnZXIiLCJsaW5rcyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZmV0Y2hEb2N1bWVudCIsImRvYyIsImVyciIsImdldCIsInR5cGUiLCJpZCIsIndpdGhMaW5rIiwibGluayIsImRvY3VtZW50RGF0YSIsImJhc2VMaW5rIiwibGVuZ3RoIiwiYnVmZmVyIiwicmVzb3VyY2VDb3VudCIsImluRmxpZ2h0IiwiU2V0IiwiZG9SZXF1ZXN0IiwibmV4dExpbmsiLCJhZGQiLCJkZWxldGUiLCJuZXh0IiwicmVzb3VyY2VzIiwicHVzaCIsImNvbGxlY3Rpb25SZXF1ZXN0cyIsImFkdmFuY2UiLCJoYXMiLCJzaGlmdCIsImNvdW50IiwiY3Vyc29yIiwic2l6ZSIsImNhbkNvbnRpbnVlIiwiYWRkTW9yZSIsIm1hbnkiLCJ0b0NvbnN1bWVyIiwiZyIsImYiLCJ2YWx1ZSIsInVybCIsImZldGNoIiwicmVzIiwib2siLCJqc29uIiwic3RhdHVzVGV4dCIsImhhc093blByb3BlcnR5IiwiZGF0YSIsImVycm9ycyIsImZvckVhY2giLCJGaWx0ZXIiLCJjb25kaXRpb25zIiwiQ29uZGl0aW9ucyIsImtleSIsInBhcmFtZXRlcnMiLCJjb21waWxlIiwiY291bnRlciIsImNvbXBpbGVyIiwiYWNjIiwiaXRlbSIsIl8iLCJwYXJlbnRJRCIsImN1cnJlbnRJRCIsInByZWZpeCIsIm1lbWJlcnMiLCJyb290Iiwic2VsZiIsImNvbmp1bmN0aW9uIiwicmVkdWNlIiwicGF0aCIsIm9wZXJhdG9yIiwiR3JvdXBzIiwiZ3JvdXAiLCJ2IiwiZXEiLCJjb25kaXRpb24iLCJub3RFcSIsImd0IiwiZ3RFcSIsImx0IiwibHRFcSIsImVuZHNXaXRoIiwib3AiLCJlbmNvZGVVUklDb21wb25lbnQiXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7O0FBR0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBSztBQUNMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsbUNBQTJCLDBCQUEwQixFQUFFO0FBQ3ZELHlDQUFpQyxlQUFlO0FBQ2hEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLDhEQUFzRCwrREFBK0Q7O0FBRXJIO0FBQ0E7O0FBRUE7QUFDQTs7Ozs7Ozs7OztBQzdEQTtBQUVBLE1BQU1BLFNBQVMsSUFBSSxxREFBSixDQUFZLDBCQUFaLEVBQXdDQyxPQUF4QyxDQUFmO0FBRUEsTUFBTUMsU0FBU0YsT0FBT0UsTUFBUCxDQUFjLENBQUNDLENBQUQsRUFBSUMsS0FBSixLQUFjO0FBQ3pDLFNBQU9ELEVBQUVFLEdBQUYsQ0FDTEYsRUFBRSxRQUFGLEVBQVksQ0FBWixDQURLLEVBRUxBLEVBQUVHLEVBQUYsQ0FBS0gsRUFBRUksUUFBRixDQUFXLE9BQVgsRUFBb0JILE1BQU0sVUFBTixDQUFwQixDQUFMLEVB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Q0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXd0IsS0FBWCxHQUFtQixDQUFDdEMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzNCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXeUIsRUFBWCxHQUFnQixDQUFDdkMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ3hCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXMEIsSUFBWCxHQUFrQixDQUFDeEMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzFCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXMkIsRUFBWCxHQUFnQixDQUFDekMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ3hCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXNEIsSUFBWCxHQUFrQixDQUFDMUMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzFCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXMUUsVUFBWCxHQUF3QixDQUFDNEQsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ2hDLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsYUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXM0UsUUFBWCxHQUFzQixDQUFDNkQsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzlCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsVUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXNkIsUUFBWCxHQUFzQixDQUFDM0MsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzlCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsV0FBM0IsQ0FBUDtBQUNELENBRkQsQyxDQUlBO0FBQ0E7QUFDQTs7O0FBRUFyQixXQUFXdUIsU0FBWCxHQUF1QixDQUFDckMsQ0FBRCxFQUFJbUMsQ0FBSixFQUFPUyxFQUFQLEtBQWM7QUFDbkMsU0FBTztBQUNMYixVQUFNL0IsQ0FERDtBQUVMQyxXQUFPa0MsQ0FGRjtBQUdMSCxjQUFVYSxtQkFBbUJELEVBQW5CO0FBSEwsR0FBUDtBQUtELENBTkQsQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKSB7XG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG4gXHRcdH1cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGk6IG1vZHVsZUlkLFxuIFx0XHRcdGw6IGZhbHNlLFxuIFx0XHRcdGV4cG9ydHM6IHt9XG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmwgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb24gZm9yIGhhcm1vbnkgZXhwb3J0c1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kID0gZnVuY3Rpb24oZXhwb3J0cywgbmFtZSwgZ2V0dGVyKSB7XG4gXHRcdGlmKCFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywgbmFtZSkpIHtcbiBcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgbmFtZSwge1xuIFx0XHRcdFx0Y29uZmlndXJhYmxlOiBmYWxzZSxcbiBcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG4gXHRcdFx0XHRnZXQ6IGdldHRlclxuIFx0XHRcdH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5uID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gXHRcdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuIFx0XHRcdGZ1bmN0aW9uIGdldERlZmF1bHQoKSB7IHJldHVybiBtb2R1bGVbJ2RlZmF1bHQnXTsgfSA6XG4gXHRcdFx0ZnVuY3Rpb24gZ2V0TW9kdWxlRXhwb3J0cygpIHsgcmV0dXJuIG1vZHVsZTsgfTtcbiBcdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgJ2EnLCBnZXR0ZXIpO1xuIFx0XHRyZXR1cm4gZ2V0dGVyO1xuIFx0fTtcblxuIFx0Ly8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7IHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSk7IH07XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IDApO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIHdlYnBhY2svYm9vdHN0cmFwIGUwN2E4OTE5MGRmZWYxMTlkYTQwIiwiaW1wb3J0IERDbGllbnQgZnJvbSAnLi9saWInO1xuXG5jb25zdCBjbGllbnQgPSBuZXcgRENsaWVudCgnaHR0cDovL2pzb25hcGkudGVzdDo4MDgwJywgY29uc29sZSk7XG5cbmNvbnN0IGZpbHRlciA9IGNsaWVudC5maWx0ZXIoKGMsIHBhcmFtKSA9PiB7XG4gIHJldHVybiBjLmFuZChcbiAgICBjKCdzdGF0dXMnLCAxKSxcbiAgICBjLm9yKGMuY29udGFpbnMoJ3RpdGxlJywgcGFyYW0oJ3BhcmFtT25lJykpLCBjLnN0YXJ0c1dpdGgoJ3RpdGxlJywgJ1RoYWknKSksXG4gICk7XG59KTtcblxuY29uc3Qgb3B0aW9ucyA9IHtcbiAgbGltaXQ6IDMsXG4gIHNvcnQ6ICd0aXRsZScsXG4gIC8vZmlsdGVyOiBmaWx0ZXIuY29tcGlsZSh7cGFyYW1PbmU6ICdlYXN5J30pLFxuICByZWxhdGlvbnNoaXBzOiB7XG4gICAgYXV0aG9yOiAndWlkJyxcbiAgICB0YWdzOiB7XG4gICAgICBmaWVsZDogJ2ZpZWxkX3RhZ3MnLFxuICAgICAgcmVsYXRpb25zaGlwczoge1xuICAgICAgICB2b2NhYnVsYXJ5OiAndmlkJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfVxufTtcblxuY2xpZW50XG4gIC5hbGwoJ25vZGUtLXJlY2lwZScsIG9wdGlvbnMpXG4gIC50aGVuKGFzeW5jIGZlZWQgPT4ge1xuICAgIHdoaWxlIChtb3JlID0gYXdhaXQgZmVlZC5jb25zdW1lKHJlc291cmNlID0+IGNvbnNvbGUubG9nKCdJbml0aWFsOicsIHJlc291cmNlKSkpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBUaGVyZSBhcmUgJHttb3JlID8gJ21vcmUnIDogJ25vIG1vcmUnfSByZXNvdXJjZXMhYCk7XG4gICAgICBtb3JlKDIpO1xuICAgIH1cbiAgfSlcbiAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUubG9nKCdFcnJvcjonLCBlcnJvcikpO1xuICAgICAgLy8udGhlbihtb3JlID0+IHtcbiAgICAgIC8vfSk7XG4gICAgICAvL2NvbnNvbGUubG9nKGBUaGVyZSBhcmUgJHttb3JlID8gJ21vcmUnIDogJ25vIG1vcmUnfSByZXNvdXJjZXMhYCk7XG4gICAgICAvL2lmIChtb3JlKSB7XG4gICAgICAvLyAgbW9yZSgyMCk7XG4gICAgICAvLyAgZmVlZC5jb25zdW1lKHJlc291cmNlID0+IGNvbnNvbGUubG9nKCdJbml0aWFsOicsIHJlc291cmNlKSkudGhlbihldmVuTW9yZSA9PiB7XG4gICAgICAvLyAgICBjb25zb2xlLmxvZyhgVGhlcmUgYXJlICR7ZXZlbk1vcmUgPyAnbW9yZScgOiAnbm8gbW9yZSd9IHJlc291cmNlcyFgKTtcbiAgICAgIC8vICB9KTtcbiAgICAgIC8vfVxuXG4vL2NsaWVudC5nZXQoJ25vZGUtLXJlY2lwZScsICcyNWMwNDhiNi02OWU5LTQ2ZjQtOTg2ZC00YjgwYjAxZGUyZTYnKVxuLy8gIC50aGVuKHJlc291cmNlID0+IGNvbnNvbGUubG9nKCdJbmRpdmlkdWFsOicsIHJlc291cmNlKSlcbi8vICAuY2F0Y2goZXJyb3IgPT4gY29uc29sZS5sb2coJ0Vycm9yOicsIGVycm9yKSk7XG5cblxuXG4vLyBXRUJQQUNLIEZPT1RFUiAvL1xuLy8gLi9zcmMvaW5kZXguanMiLCJpbXBvcnQgRmlsdGVyIGZyb20gJy4vZmlsdGVycy5qcyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERydXBhbENsaWVudCB7XG4gIGNvbnN0cnVjdG9yKGJhc2VVcmwsIGxvZ2dlcikge1xuICAgIHRoaXMuYmFzZVVybCA9IGJhc2VVcmw7XG4gICAgdGhpcy5sb2dnZXIgPSBsb2dnZXI7XG4gICAgdGhpcy5saW5rcyA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuZmV0Y2hEb2N1bWVudChgJHtiYXNlVXJsfS9qc29uYXBpYClcbiAgICAgICAgLnRoZW4oZG9jID0+IHJlc29sdmUoZG9jLmxpbmtzIHx8IHt9KSlcbiAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgdGhpcy5sb2dnZXIubG9nKCdVbmFibGUgdG8gcmVzb2x2ZSByZXNvdXJjZSBsaW5rcy4nKTtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBnZXQodHlwZSwgaWQpIHtcbiAgICByZXR1cm4gdGhpcy53aXRoTGluayh0eXBlKVxuICAgICAgLnRoZW4obGluayA9PiB0aGlzLmZldGNoRG9jdW1lbnQoYCR7bGlua30vJHtpZH1gKSlcbiAgICAgIC50aGVuKGRvYyA9PiB0aGlzLmRvY3VtZW50RGF0YShkb2MpKVxuICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmxvZyhlcnIpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0pO1xuICB9XG5cbiAgYWxsKHR5cGUsIHsgbGltaXQgPSAtMSwgc29ydCA9ICcnLCBmaWx0ZXIgPSAnJyB9ID0ge30pIHtcbiAgICByZXR1cm4gdGhpcy53aXRoTGluayh0eXBlKS50aGVuKGJhc2VMaW5rID0+IHtcbiAgICAgIHZhciBsaW5rID0gYCR7YmFzZUxpbmt9YDtcbiAgICAgIGlmIChmaWx0ZXIubGVuZ3RoKSB7XG4gICAgICAgIGxpbmsgKz0gYD8ke2ZpbHRlcn1gO1xuICAgICAgfVxuICAgICAgaWYgKHNvcnQubGVuZ3RoKSB7XG4gICAgICAgIGxpbmsgKz0gYCR7ZmlsdGVyLmxlbmd0aCA/ICcmJyA6ICc/J31zb3J0PSR7c29ydH1gO1xuICAgICAgICBsaW5rICs9IGAmcGFnZVtsaW1pdF09MmA7XG4gICAgICB9XG5cbiAgICAgIHZhciBidWZmZXIgPSBbXTtcbiAgICAgIHZhciByZXNvdXJjZUNvdW50ID0gMDtcbiAgICAgIGNvbnN0IGluRmxpZ2h0ID0gbmV3IFNldChbXSk7XG5cbiAgICAgIGNvbnN0IGRvUmVxdWVzdCA9IG5leHRMaW5rID0+IHtcbiAgICAgICAgaW5GbGlnaHQuYWRkKG5leHRMaW5rKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmV0Y2hEb2N1bWVudChuZXh0TGluaykudGhlbihkb2MgPT4ge1xuICAgICAgICAgIGluRmxpZ2h0LmRlbGV0ZShuZXh0TGluayk7XG4gICAgICAgICAgbGluayA9IGRvYy5saW5rcy5uZXh0IHx8IGZhbHNlO1xuICAgICAgICAgIHZhciByZXNvdXJjZXMgPSB0aGlzLmRvY3VtZW50RGF0YShkb2MpO1xuICAgICAgICAgIHJlc291cmNlQ291bnQgKz0gKHJlc291cmNlcykgPyByZXNvdXJjZXMubGVuZ3RoIDogMDtcbiAgICAgICAgICBidWZmZXIucHVzaCguLi4ocmVzb3VyY2VzIHx8IFtdKSk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShidWZmZXIpO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIHZhciBjb2xsZWN0aW9uUmVxdWVzdHMgPSBbXTtcbiAgICAgIGNvbnN0IGFkdmFuY2UgPSAoKSA9PiB7XG4gICAgICAgIGlmIChsaW5rICYmICFpbkZsaWdodC5oYXMobGluaykgJiYgKGxpbWl0ID09PSAtMSB8fCByZXNvdXJjZUNvdW50IDwgbGltaXQpKSB7XG4gICAgICAgICAgY29sbGVjdGlvblJlcXVlc3RzLnB1c2goZG9SZXF1ZXN0KGxpbmspKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gIWJ1ZmZlci5sZW5ndGggJiYgY29sbGVjdGlvblJlcXVlc3RzLmxlbmd0aFxuICAgICAgICAgID8gY29sbGVjdGlvblJlcXVlc3RzLnNoaWZ0KCkudGhlbigoKSA9PiBidWZmZXIpXG4gICAgICAgICAgOiBQcm9taXNlLnJlc29sdmUoYnVmZmVyKTtcbiAgICAgIH07XG5cbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICBjb25zdCBjdXJzb3IgPSAoZnVuY3Rpb24qKCkge1xuICAgICAgICB3aGlsZSAoYnVmZmVyLmxlbmd0aCB8fCBpbkZsaWdodC5zaXplIHx8IGxpbmspIHtcbiAgICAgICAgICB5aWVsZCBsaW1pdCA9PT0gLTEgfHwgY291bnQgPCBsaW1pdCA/IGFkdmFuY2UoKS50aGVuKGJ1ZmZlciA9PiB7XG4gICAgICAgICAgICBjb3VudCsrXG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZSA9IGJ1ZmZlci5zaGlmdCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlIHx8IG51bGw7XG4gICAgICAgICAgfSkgOiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcbiAgICAgIGN1cnNvci5jYW5Db250aW51ZSA9ICgpID0+IGJ1ZmZlci5sZW5ndGggfHwgaW5GbGlnaHQuc2l6ZSB8fCBsaW5rO1xuICAgICAgY3Vyc29yLmFkZE1vcmUgPSAobWFueSA9IC0xKSA9PiBtYW55ID09PSAtMSA/IChsaW1pdCA9IC0xKSA6IChsaW1pdCArPSBtYW55KTtcblxuICAgICAgcmV0dXJuIHRoaXMudG9Db25zdW1lcihjdXJzb3IpO1xuICAgIH0pO1xuICB9XG5cbiAgdG9Db25zdW1lcihjdXJzb3IpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uc3VtZTogZnVuY3Rpb24oZykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGYgPSBuZXh0ID0+IHtcbiAgICAgICAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgICAgICAgIG5leHRcbiAgICAgICAgICAgICAgICAudGhlbihyZXNvdXJjZSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2UpIGcocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgZihjdXJzb3IubmV4dCgpLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShcbiAgICAgICAgICAgICAgICBjdXJzb3IuY2FuQ29udGludWUoKSA/IGN1cnNvci5hZGRNb3JlIDogZmFsc2UsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBmKGN1cnNvci5uZXh0KCkudmFsdWUpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIGZldGNoRG9jdW1lbnQodXJsKSB7XG4gICAgcmV0dXJuIGZldGNoKHVybCkudGhlbihcbiAgICAgIHJlcyA9PiAocmVzLm9rID8gcmVzLmpzb24oKSA6IFByb21pc2UucmVqZWN0KHJlcy5zdGF0dXNUZXh0KSksXG4gICAgKTtcbiAgfVxuXG4gIGRvY3VtZW50RGF0YShkb2MpIHtcbiAgICBpZiAoZG9jLmhhc093blByb3BlcnR5KCdkYXRhJykpIHtcbiAgICAgIHJldHVybiBkb2MuZGF0YTtcbiAgICB9XG4gICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eSgnZXJyb3JzJykpIHtcbiAgICAgIGRvYy5lcnJvcnMuZm9yRWFjaCh0aGlzLmxvZ2dlci5sb2cpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9nZ2VyLmxvZyhcbiAgICAgICAgJ1RoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5wcm9jZXNzYWJsZSBkb2N1bWVudCB3aXRoIG5vIGRhdGEgb3IgZXJyb3JzLicsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHdpdGhMaW5rKHR5cGUpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5saW5rc1xuICAgICAgICAudGhlbihsaW5rcyA9PiB7XG4gICAgICAgICAgaWYgKCFsaW5rcy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkge1xuICAgICAgICAgICAgcmVqZWN0KGAnJHt0eXBlfScgaXMgbm90IGEgdmFsaWQgdHlwZSBmb3IgJHt0aGlzLmJhc2VVcmx9LmApO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXNvbHZlKGxpbmtzW3R5cGVdKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICBmaWx0ZXIoZikge1xuICAgIHJldHVybiBuZXcgRmlsdGVyKGYpO1xuICB9XG5cbn1cblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9saWIvaW5kZXguanMiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBGaWx0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGYpIHtcbiAgICB0aGlzLmNvbmRpdGlvbnMgPSBmKENvbmRpdGlvbnMsIChrZXkpID0+IChwYXJhbWV0ZXJzKSA9PiBwYXJhbWV0ZXJzW2tleV0pO1xuICB9XG5cbiAgY29tcGlsZShwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgaWQgPSBmdW5jdGlvbiogKCkge1xuICAgICAgdmFyIGNvdW50ZXIgPSAxO1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgeWllbGQgY291bnRlcisrO1xuICAgICAgfVxuICAgIH0oKTtcblxuICAgIGNvbnN0IGNvbXBpbGVyID0gKGFjYywgaXRlbSwgXywgcGFyZW50SUQgPSBudWxsKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50SUQgPSBpZC5uZXh0KCkudmFsdWU7XG4gICAgICBjb25zdCBwcmVmaXggPSBhY2MubGVuZ3RoID8gYCR7YWNjfSZgIDogJyc7XG4gICAgICBpZiAoaXRlbS5tZW1iZXJzKSB7XG4gICAgICAgIGNvbnN0IHJvb3QgPSBgZmlsdGVyWyR7Y3VycmVudElEfV1bZ3JvdXBdYDtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHBhcmVudElEXG4gICAgICAgICAgPyBgJHtyb290fVtjb25qdW5jdGlvbl09JHtpdGVtLmNvbmp1bmN0aW9ufSYke3Jvb3R9W21lbWJlck9mXT0ke3BhcmVudElEfWBcbiAgICAgICAgICA6IGAke3Jvb3R9W2Nvbmp1bmN0aW9uXT0ke2l0ZW0uY29uanVuY3Rpb259YDtcbiAgICAgICAgcmV0dXJuIGAke3ByZWZpeH0ke2l0ZW0ubWVtYmVycy5yZWR1Y2UoKGFjYywgaXRlbSwgXykgPT4gY29tcGlsZXIoYWNjLCBpdGVtLCBfLCBjdXJyZW50SUQpLCBzZWxmKX1gO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IHJvb3QgPSBgZmlsdGVyWyR7Y3VycmVudElEfV1bY29uZGl0aW9uXWA7XG4gICAgICAgIHZhciBzZWxmID0gJyc7XG4gICAgICAgIHNlbGYgKz0gYCR7cm9vdH1bcGF0aF09JHtpdGVtLnBhdGh9YDtcbiAgICAgICAgLy8gQHRvZG8gZXhwYW5kIGZvciBtdWx0aXZhbHVlIG9wZXJhdG9ycyBhbiBudWxsL25vdCBudWxsXG4gICAgICAgIHNlbGYgKz0gYCYke3Jvb3R9W3ZhbHVlXT0ke3R5cGVvZiBpdGVtLnZhbHVlID09PSBcImZ1bmN0aW9uXCIgPyBpdGVtLnZhbHVlKHBhcmFtZXRlcnMpIDogaXRlbS52YWx1ZX1gO1xuICAgICAgICBzZWxmICs9IGAmJHtyb290fVtvcGVyYXRvcl09JHtpdGVtLm9wZXJhdG9yfWA7XG4gICAgICAgIHJldHVybiBwYXJlbnRJRFxuICAgICAgICAgID8gYCR7cHJlZml4fSR7c2VsZn0mJHtyb290fVttZW1iZXJPZl09JHtwYXJlbnRJRH1gXG4gICAgICAgICAgOiBgJHtwcmVmaXh9JHtzZWxmfWA7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBjb21waWxlcignJywgdGhpcy5jb25kaXRpb25zKTtcbiAgfVxuXG59XG5cbmNvbnN0IEdyb3VwcyA9IHtcblxuICBhbmQ6ICguLi5tZW1iZXJzKSA9PiB7XG4gICAgcmV0dXJuIEdyb3Vwcy5ncm91cChtZW1iZXJzLCAnQU5EJyk7XG4gIH0sXG5cbiAgb3I6ICguLi5tZW1iZXJzKSA9PiB7XG4gICAgcmV0dXJuIEdyb3Vwcy5ncm91cChtZW1iZXJzLCAnT1InKTtcbiAgfSxcblxuICBncm91cDogKG1lbWJlcnMsIGNvbmp1bmN0aW9uKSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmp1bmN0aW9uLFxuICAgICAgbWVtYmVycyxcbiAgICB9XG4gIH0sXG5cbn1cblxuY29uc3QgQ29uZGl0aW9ucyA9IGZ1bmN0aW9uIChmLCB2KSB7XG4gIHJldHVybiBDb25kaXRpb25zLmVxKGYsIHYpO1xufVxuXG5Db25kaXRpb25zLmFuZCA9IEdyb3Vwcy5hbmQ7XG5cbkNvbmRpdGlvbnMub3IgPSBHcm91cHMub3I7XG5cbkNvbmRpdGlvbnMuZXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJz0nKTtcbn1cblxuQ29uZGl0aW9ucy5ub3RFcSA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPD4nKTtcbn1cblxuQ29uZGl0aW9ucy5ndCA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPicpO1xufVxuXG5Db25kaXRpb25zLmd0RXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJz49Jyk7XG59XG5cbkNvbmRpdGlvbnMubHQgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJzwnKTtcbn1cblxuQ29uZGl0aW9ucy5sdEVxID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc8PScpO1xufVxuXG5Db25kaXRpb25zLnN0YXJ0c1dpdGggPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ1NUQVJUU19XSVRIJyk7XG59XG5cbkNvbmRpdGlvbnMuY29udGFpbnMgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ0NPTlRBSU5TJyk7XG59XG5cbkNvbmRpdGlvbnMuZW5kc1dpdGggPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ0VORFNfV0lUSCcpO1xufVxuXG4vLyBAdG9kbyBhZGQgc3VwcG9ydCBmb3I6ICdJTicsICdOT1QgSU4nXG4vLyBAdG9kbyBhZGQgc3VwcG9ydCBmb3I6ICdCRVRXRUVOJywgJ05PVCBCRVRXRUVOJ1xuLy8gQHRvZG8gYWRkIHN1cHBvcnQgZm9yOiAnSVMgTlVMTCcsICdJUyBOT1QgTlVMTCdcblxuQ29uZGl0aW9ucy5jb25kaXRpb24gPSAoZiwgdiwgb3ApID0+IHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoOiBmLFxuICAgIHZhbHVlOiB2LFxuICAgIG9wZXJhdG9yOiBlbmNvZGVVUklDb21wb25lbnQob3ApLFxuICB9O1xufVxuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sInNvdXJjZVJvb3QiOiIifQ==