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
  sort: 'title',
  filter: filter.compile({
    paramOne: 'easy'
  })
};
client.all('node--recipe', options).then(cursor => {
  return cursor.forEach(logger('Initial')).then(more => {
    console.log(`There are ${more ? 'more' : 'no more'} resources!`);

    if (more) {
      more(10);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgZmY4YzFiNTEyYzk1MjhlYmU0YzQiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbImNsaWVudCIsImNvbnNvbGUiLCJsb2dnZXIiLCJsYWJlbCIsInJlc291cmNlIiwibG9nIiwiYXR0cmlidXRlcyIsInRpdGxlIiwiZmlsdGVyIiwiYyIsImFuZCIsIm9yIiwicGFyYW0iLCJjb250YWlucyIsInN0YXJ0c1dpdGgiLCJvcHRpb25zIiwibWF4Iiwic29ydCIsImNvbXBpbGUiLCJwYXJhbU9uZSIsImFsbCIsInRoZW4iLCJjdXJzb3IiLCJmb3JFYWNoIiwibW9yZSIsImV2ZW5Nb3JlIiwiY2F0Y2giLCJlcnJvciIsIkRydXBhbENsaWVudCIsImNvbnN0cnVjdG9yIiwiYmFzZVVybCIsImxpbmtzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJmZXRjaERvY3VtZW50IiwiZG9jIiwiZXJyIiwiZ2V0IiwidHlwZSIsImlkIiwid2l0aExpbmsiLCJsaW5rIiwiZG9jdW1lbnREYXRhIiwiYmFzZUxpbmsiLCJsZW5ndGgiLCJjb2xsZWN0aW9uUmVxdWVzdHMiLCJjb2xsZWN0aW9uIiwiaW5GbGlnaHQiLCJTZXQiLCJkb1JlcXVlc3QiLCJuZXh0TGluayIsImFkZCIsImRlbGV0ZSIsIm5leHQiLCJwdXNoIiwiYWR2YW5jZSIsImhhcyIsInNoaWZ0IiwiY291bnQiLCJzaXplIiwidmlldyIsImciLCJmIiwidmFsdWUiLCJhZGRNb3JlIiwibWFueSIsInVybCIsImZldGNoIiwicmVzIiwib2siLCJqc29uIiwic3RhdHVzVGV4dCIsImhhc093blByb3BlcnR5IiwiZGF0YSIsImVycm9ycyIsIkZpbHRlciIsImNvbmRpdGlvbnMiLCJDb25kaXRpb25zIiwiR3JvdXBzIiwia2V5IiwicGFyYW1ldGVycyIsImNvdW50ZXIiLCJjb21waWxlciIsImFjYyIsIml0ZW0iLCJfIiwicGFyZW50SUQiLCJjdXJyZW50SUQiLCJwcmVmaXgiLCJtZW1iZXJzIiwicm9vdCIsInNlbGYiLCJjb25qdW5jdGlvbiIsInJlZHVjZSIsInBhdGgiLCJvcGVyYXRvciIsImdyb3VwIiwidiIsImVxIiwiY29uZGl0aW9uIiwibm90RXEiLCJndCIsImd0RXEiLCJsdCIsImx0RXEiLCJlbmRzV2l0aCIsIm9wIiwiZW5jb2RlVVJJQ29tcG9uZW50Il0sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG1DQUEyQiwwQkFBMEIsRUFBRTtBQUN2RCx5Q0FBaUMsZUFBZTtBQUNoRDtBQUNBO0FBQ0E7O0FBRUE7QUFDQSw4REFBc0QsK0RBQStEOztBQUVySDtBQUNBOztBQUVBO0FBQ0E7Ozs7Ozs7Ozs7QUM3REE7QUFFQSxNQUFNQSxTQUFTLElBQUkscURBQUosQ0FBWSwwQkFBWixFQUF3Q0MsT0FBeEMsQ0FBZjs7QUFFQSxNQUFNQyxTQUFTQyxTQUFTO0FBQ3RCLFNBQU9DLFlBQVlILFFBQVFJLEdBQVIsQ0FBYSxHQUFFRixLQUFNLEdBQXJCLEVBQXlCQyxTQUFTRSxVQUFULENBQW9CQyxLQUE3QyxDQUFuQjtBQUNELENBRkQ7O0FBSUEsTUFBTUMsU0FBU1IsT0FBT1EsTUFBUCxDQUFjLENBQUNDLENBQUQsRUFBSUMsR0FBSixFQUFTQyxFQUFULEVBQWFDLEtBQWIsS0FBdUI7QUFDbEQsU0FBT0YsSUFBSUQsRUFBRSxRQUFGLEVBQVksQ0FBWixDQUFKLEVBQW9C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VTtBQUM5QixTQUFPcEIsV0FBV3NCLFNBQVgsQ0FBcUJyQyxDQUFyQixFQUF3Qm1DLENBQXhCLEVBQTJCLFdBQTNCLENBQVA7QUFDRCxDQUZELEMsQ0FJQTtBQUNBO0FBQ0E7OztBQUVBcEIsV0FBV3NCLFNBQVgsR0FBdUIsQ0FBQ3JDLENBQUQsRUFBSW1DLENBQUosRUFBT1MsRUFBUCxLQUFjO0FBQ25DLFNBQU87QUFDTFosVUFBTWhDLENBREQ7QUFFTEMsV0FBT2tDLENBRkY7QUFHTEYsY0FBVVksbUJBQW1CRCxFQUFuQjtBQUhMLEdBQVA7QUFLRCxDQU5ELEMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyIgXHQvLyBUaGUgbW9kdWxlIGNhY2hlXG4gXHR2YXIgaW5zdGFsbGVkTW9kdWxlcyA9IHt9O1xuXG4gXHQvLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuIFx0ZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXG4gXHRcdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuIFx0XHRpZihpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSkge1xuIFx0XHRcdHJldHVybiBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXS5leHBvcnRzO1xuIFx0XHR9XG4gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4gXHRcdHZhciBtb2R1bGUgPSBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSA9IHtcbiBcdFx0XHRpOiBtb2R1bGVJZCxcbiBcdFx0XHRsOiBmYWxzZSxcbiBcdFx0XHRleHBvcnRzOiB7fVxuIFx0XHR9O1xuXG4gXHRcdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuIFx0XHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG4gXHRcdG1vZHVsZS5sID0gdHJ1ZTtcblxuIFx0XHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuIFx0XHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gXHR9XG5cblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGVzIG9iamVjdCAoX193ZWJwYWNrX21vZHVsZXNfXylcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubSA9IG1vZHVsZXM7XG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlIGNhY2hlXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmMgPSBpbnN0YWxsZWRNb2R1bGVzO1xuXG4gXHQvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9uIGZvciBoYXJtb255IGV4cG9ydHNcbiBcdF9fd2VicGFja19yZXF1aXJlX18uZCA9IGZ1bmN0aW9uKGV4cG9ydHMsIG5hbWUsIGdldHRlcikge1xuIFx0XHRpZighX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIG5hbWUpKSB7XG4gXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIG5hbWUsIHtcbiBcdFx0XHRcdGNvbmZpZ3VyYWJsZTogZmFsc2UsXG4gXHRcdFx0XHRlbnVtZXJhYmxlOiB0cnVlLFxuIFx0XHRcdFx0Z2V0OiBnZXR0ZXJcbiBcdFx0XHR9KTtcbiBcdFx0fVxuIFx0fTtcblxuIFx0Ly8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubiA9IGZ1bmN0aW9uKG1vZHVsZSkge1xuIFx0XHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cbiBcdFx0XHRmdW5jdGlvbiBnZXREZWZhdWx0KCkgeyByZXR1cm4gbW9kdWxlWydkZWZhdWx0J107IH0gOlxuIFx0XHRcdGZ1bmN0aW9uIGdldE1vZHVsZUV4cG9ydHMoKSB7IHJldHVybiBtb2R1bGU7IH07XG4gXHRcdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsICdhJywgZ2V0dGVyKTtcbiBcdFx0cmV0dXJuIGdldHRlcjtcbiBcdH07XG5cbiBcdC8vIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbFxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5vID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpOyB9O1xuXG4gXHQvLyBfX3dlYnBhY2tfcHVibGljX3BhdGhfX1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcblxuIFx0Ly8gTG9hZCBlbnRyeSBtb2R1bGUgYW5kIHJldHVybiBleHBvcnRzXG4gXHRyZXR1cm4gX193ZWJwYWNrX3JlcXVpcmVfXyhfX3dlYnBhY2tfcmVxdWlyZV9fLnMgPSAwKTtcblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyB3ZWJwYWNrL2Jvb3RzdHJhcCBmZjhjMWI1MTJjOTUyOGViZTRjNCIsImltcG9ydCBEQ2xpZW50IGZyb20gJy4vbGliJztcblxuY29uc3QgY2xpZW50ID0gbmV3IERDbGllbnQoJ2h0dHA6Ly9qc29uYXBpLnRlc3Q6ODA4MCcsIGNvbnNvbGUpO1xuXG5jb25zdCBsb2dnZXIgPSBsYWJlbCA9PiB7XG4gIHJldHVybiByZXNvdXJjZSA9PiBjb25zb2xlLmxvZyhgJHtsYWJlbH06YCwgcmVzb3VyY2UuYXR0cmlidXRlcy50aXRsZSk7XG59O1xuXG5jb25zdCBmaWx0ZXIgPSBjbGllbnQuZmlsdGVyKChjLCBhbmQsIG9yLCBwYXJhbSkgPT4ge1xuICByZXR1cm4gYW5kKGMoJ3N0YXR1cycsIDEpLCBvcihjLmNvbnRhaW5zKCd0aXRsZScsIHBhcmFtKCdwYXJhbU9uZScpKSwgYy5zdGFydHNXaXRoKCd0aXRsZScsICdUaGFpJykpKVxufSk7XG5cbmNvbnN0IG9wdGlvbnMgPSB7XG4gIG1heDogMyxcbiAgc29ydDogJ3RpdGxlJyxcbiAgZmlsdGVyOiBmaWx0ZXIuY29tcGlsZSh7cGFyYW1PbmU6ICdlYXN5J30pLFxufTtcblxuY2xpZW50XG4gIC5hbGwoJ25vZGUtLXJlY2lwZScsIG9wdGlvbnMpXG4gIC50aGVuKGN1cnNvciA9PiB7XG4gICAgcmV0dXJuIGN1cnNvci5mb3JFYWNoKGxvZ2dlcignSW5pdGlhbCcpKS50aGVuKG1vcmUgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFRoZXJlIGFyZSAke21vcmUgPyAnbW9yZScgOiAnbm8gbW9yZSd9IHJlc291cmNlcyFgKTtcbiAgICAgIGlmIChtb3JlKSB7XG4gICAgICAgIG1vcmUoMTApO1xuICAgICAgICBjdXJzb3IuZm9yRWFjaChsb2dnZXIoJ0FkZGl0aW9uYWwnKSkudGhlbihldmVuTW9yZSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFRoZXJlIGFyZSAke2V2ZW5Nb3JlID8gJ21vcmUnIDogJ25vIG1vcmUnfSByZXNvdXJjZXMhYCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9KVxuICAuY2F0Y2goZXJyb3IgPT4gY29uc29sZS5sb2coJ0Vycm9yOicsIGVycm9yKSk7XG5cbi8vY2xpZW50LmdldCgnbm9kZS0tcmVjaXBlJywgJzI1YzA0OGI2LTY5ZTktNDZmNC05ODZkLTRiODBiMDFkZTJlNicpXG4vLyAgLnRoZW4ocmVzb3VyY2UgPT4gY29uc29sZS5sb2coJ0luZGl2aWR1YWw6JywgcmVzb3VyY2UpKVxuLy8gIC5jYXRjaChlcnJvciA9PiBjb25zb2xlLmxvZygnRXJyb3I6JywgZXJyb3IpKTtcblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9pbmRleC5qcyIsImltcG9ydCBGaWx0ZXIgZnJvbSAnLi9maWx0ZXJzLmpzJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRHJ1cGFsQ2xpZW50IHtcbiAgY29uc3RydWN0b3IoYmFzZVVybCwgbG9nZ2VyKSB7XG4gICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcbiAgICB0aGlzLmxvZ2dlciA9IGxvZ2dlcjtcbiAgICB0aGlzLmxpbmtzID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5mZXRjaERvY3VtZW50KGAke2Jhc2VVcmx9L2pzb25hcGlgKVxuICAgICAgICAudGhlbihkb2MgPT4gcmVzb2x2ZShkb2MubGlua3MgfHwge30pKVxuICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5sb2coJ1VuYWJsZSB0byByZXNvbHZlIHJlc291cmNlIGxpbmtzLicpO1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldCh0eXBlLCBpZCkge1xuICAgIHJldHVybiB0aGlzLndpdGhMaW5rKHR5cGUpXG4gICAgICAudGhlbihsaW5rID0+IHRoaXMuZmV0Y2hEb2N1bWVudChgJHtsaW5rfS8ke2lkfWApKVxuICAgICAgLnRoZW4oZG9jID0+IHRoaXMuZG9jdW1lbnREYXRhKGRvYykpXG4gICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgdGhpcy5sb2dnZXIubG9nKGVycik7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSk7XG4gIH1cblxuICBhbGwodHlwZSwgeyBtYXggPSAtMSwgc29ydCA9ICcnLCBmaWx0ZXIgPSAnJyB9ID0ge30pIHtcbiAgICByZXR1cm4gdGhpcy53aXRoTGluayh0eXBlKS50aGVuKGJhc2VMaW5rID0+IHtcbiAgICAgIHZhciBsaW5rID0gYCR7YmFzZUxpbmt9YDtcbiAgICAgIGlmIChmaWx0ZXIubGVuZ3RoKSB7XG4gICAgICAgIGxpbmsgKz0gYD8ke2ZpbHRlcn1gO1xuICAgICAgfVxuICAgICAgaWYgKHNvcnQubGVuZ3RoKSB7XG4gICAgICAgIGxpbmsgKz0gYCR7ZmlsdGVyLmxlbmd0aCA/ICcmJyA6ICc/J31zb3J0PSR7c29ydH1gO1xuICAgICAgfVxuICAgICAgdmFyIGNvbGxlY3Rpb25SZXF1ZXN0cyA9IFtdO1xuICAgICAgdmFyIGNvbGxlY3Rpb24gPSBbXTtcbiAgICAgIGNvbnN0IGluRmxpZ2h0ID0gbmV3IFNldChbXSk7XG4gICAgICBjb25zdCBkb1JlcXVlc3QgPSBuZXh0TGluayA9PiB7XG4gICAgICAgIGluRmxpZ2h0LmFkZChuZXh0TGluayk7XG4gICAgICAgIHJldHVybiB0aGlzLmZldGNoRG9jdW1lbnQobmV4dExpbmspLnRoZW4oZG9jID0+IHtcbiAgICAgICAgICBpbkZsaWdodC5kZWxldGUobmV4dExpbmspO1xuICAgICAgICAgIGxpbmsgPSBkb2MubGlua3MubmV4dCB8fCBmYWxzZTtcbiAgICAgICAgICBjb2xsZWN0aW9uLnB1c2goLi4uKHRoaXMuZG9jdW1lbnREYXRhKGRvYykgfHwgW10pKTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGNvbGxlY3Rpb24pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICBjb25zdCBhZHZhbmNlID0gKCkgPT4ge1xuICAgICAgICBpZiAobGluayAmJiAhaW5GbGlnaHQuaGFzKGxpbmspKSB7XG4gICAgICAgICAgY29sbGVjdGlvblJlcXVlc3RzLnB1c2goZG9SZXF1ZXN0KGxpbmspKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNvbGxlY3Rpb24ubGVuZ3RoICYmIGNvbGxlY3Rpb25SZXF1ZXN0cy5sZW5ndGgpIHtcbiAgICAgICAgICByZXR1cm4gY29sbGVjdGlvblJlcXVlc3RzLnNoaWZ0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShjb2xsZWN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgIGNvbnN0IGN1cnNvciA9IChmdW5jdGlvbiooKSB7XG4gICAgICAgIHdoaWxlIChjb2xsZWN0aW9uLmxlbmd0aCB8fCBpbkZsaWdodC5zaXplIHx8IGxpbmspIHtcbiAgICAgICAgICB5aWVsZCBhZHZhbmNlKCkudGhlbih2aWV3ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlID0gdmlldy5zaGlmdCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlIHx8IG51bGw7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZvckVhY2g6IGZ1bmN0aW9uKGcpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZiA9IG5leHQgPT4ge1xuICAgICAgICAgICAgICBpZiAobmV4dCkge1xuICAgICAgICAgICAgICAgIG5leHRcbiAgICAgICAgICAgICAgICAgIC50aGVuKHJlc291cmNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlKSBnKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICAgICAgZihtYXggPT09IC0xIHx8IGNvdW50IDwgbWF4ID8gY3Vyc29yLm5leHQoKS52YWx1ZSA6IGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhZGRNb3JlID0gKG1hbnkgPSAtMSkgPT4ge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hbnkgPT09IC0xID8gKG1heCA9IC0xKSA6IChtYXggKz0gbWFueSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKFxuICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbi5sZW5ndGggfHwgaW5GbGlnaHQuc2l6ZSB8fCBsaW5rID8gYWRkTW9yZSA6IGZhbHNlLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBmKG1heCA9PT0gLTEgfHwgY291bnQgPCBtYXggPyBjdXJzb3IubmV4dCgpLnZhbHVlIDogZmFsc2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZldGNoRG9jdW1lbnQodXJsKSB7XG4gICAgcmV0dXJuIGZldGNoKHVybCkudGhlbihcbiAgICAgIHJlcyA9PiAocmVzLm9rID8gcmVzLmpzb24oKSA6IFByb21pc2UucmVqZWN0KHJlcy5zdGF0dXNUZXh0KSksXG4gICAgKTtcbiAgfVxuXG4gIGRvY3VtZW50RGF0YShkb2MpIHtcbiAgICBpZiAoZG9jLmhhc093blByb3BlcnR5KCdkYXRhJykpIHtcbiAgICAgIHJldHVybiBkb2MuZGF0YTtcbiAgICB9XG4gICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eSgnZXJyb3JzJykpIHtcbiAgICAgIGRvYy5lcnJvcnMuZm9yRWFjaCh0aGlzLmxvZ2dlci5sb2cpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9nZ2VyLmxvZyhcbiAgICAgICAgJ1RoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5wcm9jZXNzYWJsZSBkb2N1bWVudCB3aXRoIG5vIGRhdGEgb3IgZXJyb3JzLicsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHdpdGhMaW5rKHR5cGUpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5saW5rc1xuICAgICAgICAudGhlbihsaW5rcyA9PiB7XG4gICAgICAgICAgaWYgKCFsaW5rcy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkge1xuICAgICAgICAgICAgcmVqZWN0KGAnJHt0eXBlfScgaXMgbm90IGEgdmFsaWQgdHlwZSBmb3IgJHt0aGlzLmJhc2VVcmx9LmApO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXNvbHZlKGxpbmtzW3R5cGVdKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICBmaWx0ZXIoZikge1xuICAgIHJldHVybiBuZXcgRmlsdGVyKGYpO1xuICB9XG5cbn1cblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9saWIvaW5kZXguanMiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBGaWx0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGYpIHtcbiAgICB0aGlzLmNvbmRpdGlvbnMgPSBmKENvbmRpdGlvbnMsIEdyb3Vwcy5hbmQsIEdyb3Vwcy5vciwgKGtleSkgPT4gKHBhcmFtZXRlcnMpID0+IHBhcmFtZXRlcnNba2V5XSk7XG4gIH1cblxuICBjb21waWxlKHBhcmFtZXRlcnMpIHtcbiAgICBjb25zdCBpZCA9IGZ1bmN0aW9uKiAoKSB7XG4gICAgICB2YXIgY291bnRlciA9IDE7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICB5aWVsZCBjb3VudGVyKys7XG4gICAgICB9XG4gICAgfSgpO1xuXG4gICAgY29uc3QgY29tcGlsZXIgPSAoYWNjLCBpdGVtLCBfLCBwYXJlbnRJRCA9IG51bGwpID0+IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRJRCA9IGlkLm5leHQoKS52YWx1ZTtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGFjYy5sZW5ndGggPyBgJHthY2N9JmAgOiAnJztcbiAgICAgIGlmIChpdGVtLm1lbWJlcnMpIHtcbiAgICAgICAgY29uc3Qgcm9vdCA9IGBmaWx0ZXJbJHtjdXJyZW50SUR9XVtncm91cF1gO1xuICAgICAgICBjb25zdCBzZWxmID0gcGFyZW50SURcbiAgICAgICAgICA/IGAke3Jvb3R9W2Nvbmp1bmN0aW9uXT0ke2l0ZW0uY29uanVuY3Rpb259JiR7cm9vdH1bbWVtYmVyT2ZdPSR7cGFyZW50SUR9YFxuICAgICAgICAgIDogYCR7cm9vdH1bY29uanVuY3Rpb25dPSR7aXRlbS5jb25qdW5jdGlvbn1gO1xuICAgICAgICByZXR1cm4gYCR7cHJlZml4fSR7aXRlbS5tZW1iZXJzLnJlZHVjZSgoYWNjLCBpdGVtLCBfKSA9PiBjb21waWxlcihhY2MsIGl0ZW0sIF8sIGN1cnJlbnRJRCksIHNlbGYpfWA7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgcm9vdCA9IGBmaWx0ZXJbJHtjdXJyZW50SUR9XVtjb25kaXRpb25dYDtcbiAgICAgICAgdmFyIHNlbGYgPSAnJztcbiAgICAgICAgc2VsZiArPSBgJHtyb290fVtwYXRoXT0ke2l0ZW0ucGF0aH1gO1xuICAgICAgICAvLyBAdG9kbyBleHBhbmQgZm9yIG11bHRpdmFsdWUgb3BlcmF0b3JzIGFuIG51bGwvbm90IG51bGxcbiAgICAgICAgc2VsZiArPSBgJiR7cm9vdH1bdmFsdWVdPSR7dHlwZW9mIGl0ZW0udmFsdWUgPT09IFwiZnVuY3Rpb25cIiA/IGl0ZW0udmFsdWUocGFyYW1ldGVycykgOiBpdGVtLnZhbHVlfWA7XG4gICAgICAgIHNlbGYgKz0gYCYke3Jvb3R9W29wZXJhdG9yXT0ke2l0ZW0ub3BlcmF0b3J9YDtcbiAgICAgICAgcmV0dXJuIHBhcmVudElEXG4gICAgICAgICAgPyBgJHtwcmVmaXh9JHtzZWxmfSYke3Jvb3R9W21lbWJlck9mXT0ke3BhcmVudElEfWBcbiAgICAgICAgICA6IGAke3ByZWZpeH0ke3NlbGZ9YDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBpbGVyKCcnLCB0aGlzLmNvbmRpdGlvbnMpO1xuICB9XG5cbn1cblxuY29uc3QgR3JvdXBzID0ge1xuXG4gIGFuZDogKC4uLm1lbWJlcnMpID0+IHtcbiAgICByZXR1cm4gR3JvdXBzLmdyb3VwKG1lbWJlcnMsICdBTkQnKTtcbiAgfSxcblxuICBvcjogKC4uLm1lbWJlcnMpID0+IHtcbiAgICByZXR1cm4gR3JvdXBzLmdyb3VwKG1lbWJlcnMsICdPUicpO1xuICB9LFxuXG4gIGdyb3VwOiAobWVtYmVycywgY29uanVuY3Rpb24pID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uanVuY3Rpb24sXG4gICAgICBtZW1iZXJzLFxuICAgIH1cbiAgfSxcblxufVxuXG5jb25zdCBDb25kaXRpb25zID0gZnVuY3Rpb24gKGYsIHYpIHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuZXEoZiwgdik7XG59XG5cbkNvbmRpdGlvbnMuZXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJz0nKTtcbn1cblxuQ29uZGl0aW9ucy5ub3RFcSA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPD4nKTtcbn1cblxuQ29uZGl0aW9ucy5ndCA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPicpO1xufVxuXG5Db25kaXRpb25zLmd0RXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJz49Jyk7XG59XG5cbkNvbmRpdGlvbnMubHQgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJzwnKTtcbn1cblxuQ29uZGl0aW9ucy5sdEVxID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc8PScpO1xufVxuXG5Db25kaXRpb25zLnN0YXJ0c1dpdGggPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ1NUQVJUU19XSVRIJyk7XG59XG5cbkNvbmRpdGlvbnMuY29udGFpbnMgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ0NPTlRBSU5TJyk7XG59XG5cbkNvbmRpdGlvbnMuZW5kc1dpdGggPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJ0VORFNfV0lUSCcpO1xufVxuXG4vLyBAdG9kbyBhZGQgc3VwcG9ydCBmb3I6ICdJTicsICdOT1QgSU4nXG4vLyBAdG9kbyBhZGQgc3VwcG9ydCBmb3I6ICdCRVRXRUVOJywgJ05PVCBCRVRXRUVOJ1xuLy8gQHRvZG8gYWRkIHN1cHBvcnQgZm9yOiAnSVMgTlVMTCcsICdJUyBOT1QgTlVMTCdcblxuQ29uZGl0aW9ucy5jb25kaXRpb24gPSAoZiwgdiwgb3ApID0+IHtcbiAgcmV0dXJuIHtcbiAgICBwYXRoOiBmLFxuICAgIHZhbHVlOiB2LFxuICAgIG9wZXJhdG9yOiBlbmNvZGVVUklDb21wb25lbnQob3ApLFxuICB9O1xufVxuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sInNvdXJjZVJvb3QiOiIifQ==