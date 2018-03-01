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
  limit: 3,
  sort: 'title' //filter: filter.compile({paramOne: 'easy'}),

};
client.all('node--recipe', options).then(stream => {
  return stream.subscribe(logger('Initial')).then(more => {
    console.log(`There are ${more ? 'more' : 'no more'} resources!`);

    if (more) {
      more(20);
      stream.subscribe(logger('Additional')).then(evenMore => {
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

      return this.toStream(cursor);
    });
  }

  toStream(cursor) {
    return {
      subscribe: function subscribe(g) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgNTAwODUxYTM1ZDJmMTNmOGNiNmYiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbImNsaWVudCIsImNvbnNvbGUiLCJsb2dnZXIiLCJsYWJlbCIsInJlc291cmNlIiwibG9nIiwiYXR0cmlidXRlcyIsInRpdGxlIiwiZmlsdGVyIiwiYyIsImFuZCIsIm9yIiwicGFyYW0iLCJjb250YWlucyIsInN0YXJ0c1dpdGgiLCJvcHRpb25zIiwibGltaXQiLCJzb3J0IiwiYWxsIiwidGhlbiIsInN0cmVhbSIsInN1YnNjcmliZSIsIm1vcmUiLCJldmVuTW9yZSIsImNhdGNoIiwiZXJyb3IiLCJEcnVwYWxDbGllbnQiLCJjb25zdHJ1Y3RvciIsImJhc2VVcmwiLCJsaW5rcyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZmV0Y2hEb2N1bWVudCIsImRvYyIsImVyciIsImdldCIsInR5cGUiLCJpZCIsIndpdGhMaW5rIiwibGluayIsImRvY3VtZW50RGF0YSIsImJhc2VMaW5rIiwibGVuZ3RoIiwiYnVmZmVyIiwicmVzb3VyY2VDb3VudCIsImluRmxpZ2h0IiwiU2V0IiwiZG9SZXF1ZXN0IiwibmV4dExpbmsiLCJhZGQiLCJkZWxldGUiLCJuZXh0IiwicmVzb3VyY2VzIiwicHVzaCIsImNvbGxlY3Rpb25SZXF1ZXN0cyIsImFkdmFuY2UiLCJoYXMiLCJzaGlmdCIsImNvdW50IiwiY3Vyc29yIiwic2l6ZSIsImNhbkNvbnRpbnVlIiwiYWRkTW9yZSIsIm1hbnkiLCJ0b1N0cmVhbSIsImciLCJmIiwidmFsdWUiLCJ1cmwiLCJmZXRjaCIsInJlcyIsIm9rIiwianNvbiIsInN0YXR1c1RleHQiLCJoYXNPd25Qcm9wZXJ0eSIsImRhdGEiLCJlcnJvcnMiLCJmb3JFYWNoIiwiRmlsdGVyIiwiY29uZGl0aW9ucyIsIkNvbmRpdGlvbnMiLCJHcm91cHMiLCJrZXkiLCJwYXJhbWV0ZXJzIiwiY29tcGlsZSIsImNvdW50ZXIiLCJjb21waWxlciIsImFjYyIsIml0ZW0iLCJfIiwicGFyZW50SUQiLCJjdXJyZW50SUQiLCJwcmVmaXgiLCJtZW1iZXJzIiwicm9vdCIsInNlbGYiLCJjb25qdW5jdGlvbiIsInJlZHVjZSIsInBhdGgiLCJvcGVyYXRvciIsImdyb3VwIiwidiIsImVxIiwiY29uZGl0aW9uIiwibm90RXEiLCJndCIsImd0RXEiLCJsdCIsImx0RXEiLCJlbmRzV2l0aCIsIm9wIiwiZW5jb2RlVVJJQ29tcG9uZW50Il0sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG1DQUEyQiwwQkFBMEIsRUFBRTtBQUN2RCx5Q0FBaUMsZUFBZTtBQUNoRDtBQUNBO0FBQ0E7O0FBRUE7QUFDQSw4REFBc0QsK0RBQStEOztBQUVySDtBQUNBOztBQUVBO0FBQ0E7Ozs7Ozs7Ozs7QUM3REE7QUFFQSxNQUFNQSxTQUFTLElBQUkscURBQUosQ0FBWSwwQkFBWixFQUF3Q0MsT0FBeEMsQ0FBZjs7QUFFQSxNQUFNQyxTQUFTQyxTQUFTO0FBQ3RCLFNBQU9DLFlBQVlILFFBQVFJLEdBQVIsQ0FBYSxHQUFFRixLQUFNLEdBQXJCLEVBQXlCQyxTQUFTRSxVQUFULENBQW9CQyxLQUE3QyxDQUFuQjtBQUNELENBRkQ7O0FBSUEsTUFBTUMsU0FBU1IsT0FBT1EsTUFBUCxDQUFjLENBQUNDLENBQUQsRUFBSUMsR0FBSixFQUFTQyxFQUFULEVBQWFDLEtBQWIs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QUFDcEMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ3hCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXd0IsS0FBWCxHQUFtQixDQUFDdEMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzNCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXeUIsRUFBWCxHQUFnQixDQUFDdkMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ3hCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXMEIsSUFBWCxHQUFrQixDQUFDeEMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzFCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXMkIsRUFBWCxHQUFnQixDQUFDekMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ3hCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXNEIsSUFBWCxHQUFrQixDQUFDMUMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzFCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXbkUsVUFBWCxHQUF3QixDQUFDcUQsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ2hDLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsYUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXcEUsUUFBWCxHQUFzQixDQUFDc0QsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzlCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsVUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXNkIsUUFBWCxHQUFzQixDQUFDM0MsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzlCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsV0FBM0IsQ0FBUDtBQUNELENBRkQsQyxDQUlBO0FBQ0E7QUFDQTs7O0FBRUFyQixXQUFXdUIsU0FBWCxHQUF1QixDQUFDckMsQ0FBRCxFQUFJbUMsQ0FBSixFQUFPUyxFQUFQLEtBQWM7QUFDbkMsU0FBTztBQUNMWixVQUFNaEMsQ0FERDtBQUVMQyxXQUFPa0MsQ0FGRjtBQUdMRixjQUFVWSxtQkFBbUJELEVBQW5CO0FBSEwsR0FBUDtBQUtELENBTkQsQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKSB7XG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG4gXHRcdH1cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGk6IG1vZHVsZUlkLFxuIFx0XHRcdGw6IGZhbHNlLFxuIFx0XHRcdGV4cG9ydHM6IHt9XG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmwgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb24gZm9yIGhhcm1vbnkgZXhwb3J0c1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kID0gZnVuY3Rpb24oZXhwb3J0cywgbmFtZSwgZ2V0dGVyKSB7XG4gXHRcdGlmKCFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywgbmFtZSkpIHtcbiBcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgbmFtZSwge1xuIFx0XHRcdFx0Y29uZmlndXJhYmxlOiBmYWxzZSxcbiBcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG4gXHRcdFx0XHRnZXQ6IGdldHRlclxuIFx0XHRcdH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5uID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gXHRcdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuIFx0XHRcdGZ1bmN0aW9uIGdldERlZmF1bHQoKSB7IHJldHVybiBtb2R1bGVbJ2RlZmF1bHQnXTsgfSA6XG4gXHRcdFx0ZnVuY3Rpb24gZ2V0TW9kdWxlRXhwb3J0cygpIHsgcmV0dXJuIG1vZHVsZTsgfTtcbiBcdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgJ2EnLCBnZXR0ZXIpO1xuIFx0XHRyZXR1cm4gZ2V0dGVyO1xuIFx0fTtcblxuIFx0Ly8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7IHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSk7IH07XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IDApO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIHdlYnBhY2svYm9vdHN0cmFwIDUwMDg1MWEzNWQyZjEzZjhjYjZmIiwiaW1wb3J0IERDbGllbnQgZnJvbSAnLi9saWInO1xuXG5jb25zdCBjbGllbnQgPSBuZXcgRENsaWVudCgnaHR0cDovL2pzb25hcGkudGVzdDo4MDgwJywgY29uc29sZSk7XG5cbmNvbnN0IGxvZ2dlciA9IGxhYmVsID0+IHtcbiAgcmV0dXJuIHJlc291cmNlID0+IGNvbnNvbGUubG9nKGAke2xhYmVsfTpgLCByZXNvdXJjZS5hdHRyaWJ1dGVzLnRpdGxlKTtcbn07XG5cbmNvbnN0IGZpbHRlciA9IGNsaWVudC5maWx0ZXIoKGMsIGFuZCwgb3IsIHBhcmFtKSA9PiB7XG4gIHJldHVybiBhbmQoXG4gICAgYygnc3RhdHVzJywgMSksXG4gICAgb3IoYy5jb250YWlucygndGl0bGUnLCBwYXJhbSgncGFyYW1PbmUnKSksIGMuc3RhcnRzV2l0aCgndGl0bGUnLCAnVGhhaScpKSxcbiAgKTtcbn0pO1xuXG5jb25zdCBvcHRpb25zID0ge1xuICBsaW1pdDogMyxcbiAgc29ydDogJ3RpdGxlJyxcbiAgLy9maWx0ZXI6IGZpbHRlci5jb21waWxlKHtwYXJhbU9uZTogJ2Vhc3knfSksXG59O1xuXG5jbGllbnRcbiAgLmFsbCgnbm9kZS0tcmVjaXBlJywgb3B0aW9ucylcbiAgLnRoZW4oc3RyZWFtID0+IHtcbiAgICByZXR1cm4gc3RyZWFtLnN1YnNjcmliZShsb2dnZXIoJ0luaXRpYWwnKSkudGhlbihtb3JlID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBUaGVyZSBhcmUgJHttb3JlID8gJ21vcmUnIDogJ25vIG1vcmUnfSByZXNvdXJjZXMhYCk7XG4gICAgICBpZiAobW9yZSkge1xuICAgICAgICBtb3JlKDIwKTtcbiAgICAgICAgc3RyZWFtLnN1YnNjcmliZShsb2dnZXIoJ0FkZGl0aW9uYWwnKSkudGhlbihldmVuTW9yZSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFRoZXJlIGFyZSAke2V2ZW5Nb3JlID8gJ21vcmUnIDogJ25vIG1vcmUnfSByZXNvdXJjZXMhYCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9KVxuICAuY2F0Y2goZXJyb3IgPT4gY29uc29sZS5sb2coJ0Vycm9yOicsIGVycm9yKSk7XG5cbi8vY2xpZW50LmdldCgnbm9kZS0tcmVjaXBlJywgJzI1YzA0OGI2LTY5ZTktNDZmNC05ODZkLTRiODBiMDFkZTJlNicpXG4vLyAgLnRoZW4ocmVzb3VyY2UgPT4gY29uc29sZS5sb2coJ0luZGl2aWR1YWw6JywgcmVzb3VyY2UpKVxuLy8gIC5jYXRjaChlcnJvciA9PiBjb25zb2xlLmxvZygnRXJyb3I6JywgZXJyb3IpKTtcblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9pbmRleC5qcyIsImltcG9ydCBGaWx0ZXIgZnJvbSAnLi9maWx0ZXJzLmpzJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRHJ1cGFsQ2xpZW50IHtcbiAgY29uc3RydWN0b3IoYmFzZVVybCwgbG9nZ2VyKSB7XG4gICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcbiAgICB0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcbiAgICB0aGlzLmxpbmtzID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5mZXRjaERvY3VtZW50KGAke2Jhc2VVcmx9L2pzb25hcGlgKVxuICAgICAgICAudGhlbihkb2MgPT4gcmVzb2x2ZShkb2MubGlua3MgfHwge30pKVxuICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5sb2coJ1VuYWJsZSB0byByZXNvbHZlIHJlc291cmNlIGxpbmtzLicpO1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldCh0eXBlLCBpZCkge1xuICAgIHJldHVybiB0aGlzLndpdGhMaW5rKHR5cGUpXG4gICAgICAudGhlbihsaW5rID0+IHRoaXMuZmV0Y2hEb2N1bWVudChgJHtsaW5rfS8ke2lkfWApKVxuICAgICAgLnRoZW4oZG9jID0+IHRoaXMuZG9jdW1lbnREYXRhKGRvYykpXG4gICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgdGhpcy5sb2dnZXIubG9nKGVycik7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSk7XG4gIH1cblxuICBhbGwodHlwZSwgeyBsaW1pdCA9IC0xLCBzb3J0ID0gJycsIGZpbHRlciA9ICcnIH0gPSB7fSkge1xuICAgIHJldHVybiB0aGlzLndpdGhMaW5rKHR5cGUpLnRoZW4oYmFzZUxpbmsgPT4ge1xuICAgICAgdmFyIGxpbmsgPSBgJHtiYXNlTGlua31gO1xuICAgICAgaWYgKGZpbHRlci5sZW5ndGgpIHtcbiAgICAgICAgbGluayArPSBgPyR7ZmlsdGVyfWA7XG4gICAgICB9XG4gICAgICBpZiAoc29ydC5sZW5ndGgpIHtcbiAgICAgICAgbGluayArPSBgJHtmaWx0ZXIubGVuZ3RoID8gJyYnIDogJz8nfXNvcnQ9JHtzb3J0fWA7XG4gICAgICAgIGxpbmsgKz0gYCZwYWdlW2xpbWl0XT0yYDtcbiAgICAgIH1cblxuICAgICAgdmFyIGJ1ZmZlciA9IFtdO1xuICAgICAgdmFyIHJlc291cmNlQ291bnQgPSAwO1xuICAgICAgY29uc3QgaW5GbGlnaHQgPSBuZXcgU2V0KFtdKTtcblxuICAgICAgY29uc3QgZG9SZXF1ZXN0ID0gbmV4dExpbmsgPT4ge1xuICAgICAgICBpbkZsaWdodC5hZGQobmV4dExpbmspO1xuICAgICAgICByZXR1cm4gdGhpcy5mZXRjaERvY3VtZW50KG5leHRMaW5rKS50aGVuKGRvYyA9PiB7XG4gICAgICAgICAgaW5GbGlnaHQuZGVsZXRlKG5leHRMaW5rKTtcbiAgICAgICAgICBsaW5rID0gZG9jLmxpbmtzLm5leHQgfHwgZmFsc2U7XG4gICAgICAgICAgdmFyIHJlc291cmNlcyA9IHRoaXMuZG9jdW1lbnREYXRhKGRvYyk7XG4gICAgICAgICAgcmVzb3VyY2VDb3VudCArPSAocmVzb3VyY2VzKSA/IHJlc291cmNlcy5sZW5ndGggOiAwO1xuICAgICAgICAgIGJ1ZmZlci5wdXNoKC4uLihyZXNvdXJjZXMgfHwgW10pKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGJ1ZmZlcik7XG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgdmFyIGNvbGxlY3Rpb25SZXF1ZXN0cyA9IFtdO1xuICAgICAgY29uc3QgYWR2YW5jZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKGxpbmsgJiYgIWluRmxpZ2h0LmhhcyhsaW5rKSAmJiAobGltaXQgPT09IC0xIHx8IHJlc291cmNlQ291bnQgPCBsaW1pdCkpIHtcbiAgICAgICAgICBjb2xsZWN0aW9uUmVxdWVzdHMucHVzaChkb1JlcXVlc3QobGluaykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAhYnVmZmVyLmxlbmd0aCAmJiBjb2xsZWN0aW9uUmVxdWVzdHMubGVuZ3RoXG4gICAgICAgICAgPyBjb2xsZWN0aW9uUmVxdWVzdHMuc2hpZnQoKS50aGVuKCgpID0+IGJ1ZmZlcilcbiAgICAgICAgICA6IFByb21pc2UucmVzb2x2ZShidWZmZXIpO1xuICAgICAgfTtcblxuICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgIGNvbnN0IGN1cnNvciA9IChmdW5jdGlvbiooKSB7XG4gICAgICAgIHdoaWxlIChidWZmZXIubGVuZ3RoIHx8IGluRmxpZ2h0LnNpemUgfHwgbGluaykge1xuICAgICAgICAgIHlpZWxkIGxpbWl0ID09PSAtMSB8fCBjb3VudCA8IGxpbWl0ID8gYWR2YW5jZSgpLnRoZW4oYnVmZmVyID0+IHtcbiAgICAgICAgICAgIGNvdW50KytcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlID0gYnVmZmVyLnNoaWZ0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2UgfHwgbnVsbDtcbiAgICAgICAgICB9KSA6IGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuICAgICAgY3Vyc29yLmNhbkNvbnRpbnVlID0gKCkgPT4gYnVmZmVyLmxlbmd0aCB8fCBpbkZsaWdodC5zaXplIHx8IGxpbms7XG4gICAgICBjdXJzb3IuYWRkTW9yZSA9IChtYW55ID0gLTEpID0+IG1hbnkgPT09IC0xID8gKGxpbWl0ID0gLTEpIDogKGxpbWl0ICs9IG1hbnkpO1xuXG4gICAgICByZXR1cm4gdGhpcy50b1N0cmVhbShjdXJzb3IpO1xuICAgIH0pO1xuICB9XG5cbiAgdG9TdHJlYW0oY3Vyc29yKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1YnNjcmliZTogZnVuY3Rpb24oZykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGYgPSBuZXh0ID0+IHtcbiAgICAgICAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgICAgICAgIG5leHRcbiAgICAgICAgICAgICAgICAudGhlbihyZXNvdXJjZSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2UpIGcocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgZihjdXJzb3IubmV4dCgpLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShcbiAgICAgICAgICAgICAgICBjdXJzb3IuY2FuQ29udGludWUoKSA/IGN1cnNvci5hZGRNb3JlIDogZmFsc2UsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBmKGN1cnNvci5uZXh0KCkudmFsdWUpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIGZldGNoRG9jdW1lbnQodXJsKSB7XG4gICAgcmV0dXJuIGZldGNoKHVybCkudGhlbihcbiAgICAgIHJlcyA9PiAocmVzLm9rID8gcmVzLmpzb24oKSA6IFByb21pc2UucmVqZWN0KHJlcy5zdGF0dXNUZXh0KSksXG4gICAgKTtcbiAgfVxuXG4gIGRvY3VtZW50RGF0YShkb2MpIHtcbiAgICBpZiAoZG9jLmhhc093blByb3BlcnR5KCdkYXRhJykpIHtcbiAgICAgIHJldHVybiBkb2MuZGF0YTtcbiAgICB9XG4gICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eSgnZXJyb3JzJykpIHtcbiAgICAgIGRvYy5lcnJvcnMuZm9yRWFjaCh0aGlzLmxvZ2dlci5sb2cpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9nZ2VyLmxvZyhcbiAgICAgICAgJ1RoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5wcm9jZXNzYWJsZSBkb2N1bWVudCB3aXRoIG5vIGRhdGEgb3IgZXJyb3JzLicsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHdpdGhMaW5rKHR5cGUpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5saW5rc1xuICAgICAgICAudGhlbihsaW5rcyA9PiB7XG4gICAgICAgICAgaWYgKCFsaW5rcy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkge1xuICAgICAgICAgICAgcmVqZWN0KGAnJHt0eXBlfScgaXMgbm90IGEgdmFsaWQgdHlwZSBmb3IgJHt0aGlzLmJhc2VVcmx9LmApO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXNvbHZlKGxpbmtzW3R5cGVdKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICBmaWx0ZXIoZikge1xuICAgIHJldHVybiBuZXcgRmlsdGVyKGYpO1xuICB9XG5cbn1cblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9saWIvaW5kZXguanMiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBGaWx0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGYpIHtcbiAgICB0aGlzLmNvbmRpdGlvbnMgPSBmKENvbmRpdGlvbnMsIEdyb3Vwcy5hbmQsIEdyb3Vwcy5vciwgKGtleSkgPT4gKHBhcmFtZXRlcnMpID0+IHBhcmFtZXRlcnNba2V5XSk7XG4gIH1cblxuICBjb21waWxlKHBhcmFtZXRlcnMpIHtcbiAgICBjb25zdCBpZCA9IGZ1bmN0aW9uKiAoKSB7XG4gICAgICB2YXIgY291bnRlciA9IDE7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICB5aWVsZCBjb3VudGVyKys7XG4gICAgICB9XG4gICAgfSgpO1xuXG4gICAgY29uc3QgY29tcGlsZXIgPSAoYWNjLCBpdGVtLCBfLCBwYXJlbnRJRCA9IG51bGwpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRJRCA9IGlkLm5leHQoKS52YWx1ZTtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGFjYy5sZW5ndGggPyBgJHthY2N9JmAgOiAnJztcbiAgICAgIGlmIChpdGVtLm1lbWJlcnMpIHtcbiAgICAgICAgY29uc3Qgcm9vdCA9IGBmaWx0ZXJbJHtjdXJyZW50SUR9XVtncm91cF1gO1xuICAgICAgICBjb25zdCBzZWxmID0gcGFyZW50SURcbiAgICAgICAgICA/IGAke3Jvb3R9W2Nvbmp1bmN0aW9uXT0ke2l0ZW0uY29uanVuY3Rpb259JiR7cm9vdH1bbWVtYmVyT2ZdPSR7cGFyZW50SUR9YFxuICAgICAgICAgIDogYCR7cm9vdH1bY29uanVuY3Rpb25dPSR7aXRlbS5jb25qdW5jdGlvbn1gO1xuICAgICAgICByZXR1cm4gYCR7cHJlZml4fSR7aXRlbS5tZW1iZXJzLnJlZHVjZSgoYWNjLCBpdGVtLCBfKSA9PiBjb21waWxlcihhY2MsIGl0ZW0sIF8sIGN1cnJlbnRJRCksIHNlbGYpfWA7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgcm9vdCA9IGBmaWx0ZXJbJHtjdXJyZW50SUR9XVtjb25kaXRpb25dYDtcbiAgICAgICAgdmFyIHNlbGYgPSAnJztcbiAgICAgICAgc2VsZiArPSBgJHtyb290fVtwYXRoXT0ke2l0ZW0ucGF0aH1gO1xuICAgICAgICAvLyBAdG9kbyBleHBhbmQgZm9yIG11bHRpdmFsdWUgb3BlcmF0b3JzIGFuIG51bGwvbm90IG51bGxcbiAgICAgICAgc2VsZiArPSBgJiR7cm9vdH1bdmFsdWVdPSR7dHlwZW9mIGl0ZW0udmFsdWUgPT09IFwiZnVuY3Rpb25cIiA/IGl0ZW0udmFsdWUocGFyYW1ldGVycykgOiBpdGVtLnZhbHVlfWA7XG4gICAgICAgIHNlbGYgKz0gYCYke3Jvb3R9W29wZXJhdG9yXT0ke2l0ZW0ub3BlcmF0b3J9YDtcbiAgICAgICAgcmV0dXJuIHBhcmVudElEXG4gICAgICAgICAgPyBgJHtwcmVmaXh9JHtzZWxmfSYke3Jvb3R9W21lbWJlck9mXT0ke3BhcmVudElEfWBcbiAgICAgICAgICA6IGAke3ByZWZpeH0ke3NlbGZ9YDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBpbGVyKCcnLCB0aGlzLmNvbmRpdGlvbnMpO1xuICB9XG5cbn1cblxuY29uc3QgR3JvdXBzID0ge1xuXG4gIGFuZDogKC4uLm1lbWJlcnMpID0+IHtcbiAgICByZXR1cm4gR3JvdXBzLmdyb3VwKG1lbWJlcnMsICdBTkQnKTtcbiAgfSxcblxuICBvcjogKC4uLm1lbWJlcnMpID0+IHtcbiAgICByZXR1cm4gR3JvdXBzLmdyb3VwKG1lbWJlcnMsICdPUicpO1xuICB9LFxuXG4gIGdyb3VwOiAobWVtYmVycywgY29uanVuY3Rpb24pID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uanVuY3Rpb24sXG4gICAgICBtZW1iZXJzLFxuICAgIH1cbiAgfSxcblxufVxuXG5jb25zdCBDb25kaXRpb25zID0gZnVuY3Rpb24gKGYsIHYpIHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuZXEoZiwgdik7XG59XG5cbkNvbmRpdGlvbnMuZXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJz0nKTtcbn1cblxuQ29uZGl0aW9ucy5ub3RFcSA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPD4nKTtcbn1cblxuQ29uZGl0aW9ucy5ndCA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPicpO1xufVxuXG5Db25kaXRpb25zLmd0RXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJz49Jyk7XG59XG5cbkNvbmRpdGlvbnMubHQgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJzwnKTtcbn1cblxuQ29uZGl0aW9ucy5sdEVxID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc8PScpO1xufVxuXG5Db25kaXRpb25zLnN0YXJ0c1dpdGggPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ1NUQVJUU19XSVRIJyk7XG59XG5cbkNvbmRpdGlvbnMuY29udGFpbnMgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ0NPTlRBSU5TJyk7XG59XG5cbkNvbmRpdGlvbnMuZW5kc1dpdGggPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ0VORFNfV0lUSCcpO1xufVxuXG4vLyBAdG9kbyBhZGQgc3VwcG9ydCBmb3I6ICdJTicsICdOT1QgSU4nXG4vLyBAdG9kbyBhZGQgc3VwcG9ydCBmb3I6ICdCRVRXRUVOJywgJ05PVCBCRVRXRUVOJ1xuLy8gQHRvZG8gYWRkIHN1cHBvcnQgZm9yOiAnSVMgTlVMTCcsICdJUyBOT1QgTlVMTCdcblxuQ29uZGl0aW9ucy5jb25kaXRpb24gPSAoZiwgdiwgb3ApID0+IHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoOiBmLFxuICAgIHZhbHVlOiB2LFxuICAgIG9wZXJhdG9yOiBlbmNvZGVVUklDb21wb25lbnQob3ApLFxuICB9O1xufVxuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sInNvdXJjZVJvb3QiOiIifQ==