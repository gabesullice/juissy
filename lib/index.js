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
client.all('node--recipe', options).then(cursor => {
  return cursor.consume(logger('Initial')).then(more => {
    console.log(`There are ${more ? 'more' : 'no more'} resources!`);

    if (more) {
      more(20);
      cursor.consume(logger('Additional')).then(evenMore => {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgM2JlYmM1ZWZjNDE1MDkyMDFiNDYiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2xpYi9maWx0ZXJzLmpzIl0sIm5hbWVzIjpbImNsaWVudCIsImNvbnNvbGUiLCJsb2dnZXIiLCJsYWJlbCIsInJlc291cmNlIiwibG9nIiwiYXR0cmlidXRlcyIsInRpdGxlIiwiZmlsdGVyIiwiYyIsImFuZCIsIm9yIiwicGFyYW0iLCJjb250YWlucyIsInN0YXJ0c1dpdGgiLCJvcHRpb25zIiwibGltaXQiLCJzb3J0IiwiYWxsIiwidGhlbiIsImN1cnNvciIsImNvbnN1bWUiLCJtb3JlIiwiZXZlbk1vcmUiLCJjYXRjaCIsImVycm9yIiwiRHJ1cGFsQ2xpZW50IiwiY29uc3RydWN0b3IiLCJiYXNlVXJsIiwibGlua3MiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImZldGNoRG9jdW1lbnQiLCJkb2MiLCJlcnIiLCJnZXQiLCJ0eXBlIiwiaWQiLCJ3aXRoTGluayIsImxpbmsiLCJkb2N1bWVudERhdGEiLCJiYXNlTGluayIsImxlbmd0aCIsImJ1ZmZlciIsInJlc291cmNlQ291bnQiLCJpbkZsaWdodCIsIlNldCIsImRvUmVxdWVzdCIsIm5leHRMaW5rIiwiYWRkIiwiZGVsZXRlIiwibmV4dCIsInJlc291cmNlcyIsInB1c2giLCJjb2xsZWN0aW9uUmVxdWVzdHMiLCJhZHZhbmNlIiwiaGFzIiwic2hpZnQiLCJjb3VudCIsInNpemUiLCJjYW5Db250aW51ZSIsImFkZE1vcmUiLCJtYW55IiwidG9Db25zdW1lciIsImciLCJmIiwidmFsdWUiLCJ1cmwiLCJmZXRjaCIsInJlcyIsIm9rIiwianNvbiIsInN0YXR1c1RleHQiLCJoYXNPd25Qcm9wZXJ0eSIsImRhdGEiLCJlcnJvcnMiLCJmb3JFYWNoIiwiRmlsdGVyIiwiY29uZGl0aW9ucyIsIkNvbmRpdGlvbnMiLCJHcm91cHMiLCJrZXkiLCJwYXJhbWV0ZXJzIiwiY29tcGlsZSIsImNvdW50ZXIiLCJjb21waWxlciIsImFjYyIsIml0ZW0iLCJfIiwicGFyZW50SUQiLCJjdXJyZW50SUQiLCJwcmVmaXgiLCJtZW1iZXJzIiwicm9vdCIsInNlbGYiLCJjb25qdW5jdGlvbiIsInJlZHVjZSIsInBhdGgiLCJvcGVyYXRvciIsImdyb3VwIiwidiIsImVxIiwiY29uZGl0aW9uIiwibm90RXEiLCJndCIsImd0RXEiLCJsdCIsImx0RXEiLCJlbmRzV2l0aCIsIm9wIiwiZW5jb2RlVVJJQ29tcG9uZW50Il0sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG1DQUEyQiwwQkFBMEIsRUFBRTtBQUN2RCx5Q0FBaUMsZUFBZTtBQUNoRDtBQUNBO0FBQ0E7O0FBRUE7QUFDQSw4REFBc0QsK0RBQStEOztBQUVySDtBQUNBOztBQUVBO0FBQ0E7Ozs7Ozs7Ozs7QUM3REE7QUFFQSxNQUFNQSxTQUFTLElBQUkscURBQUosQ0FBWSwwQkFBWixFQUF3Q0MsT0FBeEMsQ0FBZjs7QUFFQSxNQUFNQyxTQUFTQyxTQUFTO0FBQ3RCLFNBQU9DLFlBQVlILFFBQVFJLEdBQVIsQ0FBYSxHQUFFRixLQUFNLEdBQXJCLEVBQXlCQyxTQUFTRSxVQUFULENBQW9CQyxLQUE3QyxDQUFuQjtBQUNELENBRkQ7O0FBSUEsTUFBTUMsU0FBU1IsT0FBT1EsTUFBUCxDQUFjLENBQUNDLENBQUQsRUFBSUMsR0FBSixFQUFTQyxFQUFULEVBQWFDLEtBQWIsS0FBdUI7QUFDbEQsU0FBT0YsSUFDTEQsRUFBRSxRQUFGLEVBQVksQ0FBWixDQURLLEVBRUxFLEdBQUdGLEVBQUVJLFFBQUYsQ0FBVyxPQUFYLEVBQW9CRCxNQUFNLFVBQU4sQ0FBcEIsQ0FBSCxFQUEyQ0gsRUFBRUssVUFBRixDQUFhLE9BQWIsRUFBc0IsTUFBdEIsQ0FBM0MsQ0FGSyxDQUFQO0FBSUQsQ0FMYyxDQUFmO0FBT0EsTUFBTUMsVUFBVTtBQUNkQyxTQUFPLENBRE87QUFFZEMsUUFBTSxPQUZRLENBR2Q7O0FBSGMsQ0FBaEI7QUFNQWpCLE9BQ0drQixHQURILENBQ08sY0FEUCxFQUN1QkgsT0FEdkIsRUFFR0ksSUFGSCxDQUVRQyxVQUFVO0FBQ2QsU0FBT0EsT0FBT0MsT0FBUCxDQUFlbkIsT0FBTyxTQUFQLENBQWYsRUFBa0NpQixJQUFsQyxDQUF1Q0csUUFBUTtBQUNwRHJCLFlBQVFJLEdBQVIsQ0FBYSxhQUFZaUIsT0FBTyxNQUFQLEdBQWdCLFNBQVUsYUFBbkQ7O0FBQ0EsUUFBSUEsSUFBSixFQUFVO0FBQ1JBLFdBQUssRUFBTDtBQUNBRixhQUFPQyxPQUFQLENBQWVuQixPQUFPLFlBQVAsQ0FBZixFQUFxQ2lCLElBQXJDLENBQTBDSSxZQUFZO0FBQ3BEdEIsZ0JBQVFJLEdBQVIsQ0FBYSxhQUFZa0IsV0FBVyxNQUFYLEdBQW9CLFNBQVUsYUFBdkQ7QUFDRCxPQUZEO0FBR0Q7QUFDRixHQVJNLENBQVA7QUFTRCxDQVpILEVBYUdDLEtBYkgsQ0FhU0MsU0FBU3hCLFFBQVFJLEdBQVIsQ0FBWSxRQUFaLEVBQXNCb0IsS0FBdEIsQ0FibEIsRSxDQWVBO0FBQ0E7QUFDQSxrRDs7Ozs7Ozs7QUN0Q0E7QUFFZSxNQUFNQyxZQUFOLENBQW1CO0FBQ2hDQyxjQUFZQyxPQUFaLEVBQXFCMUIsTUFBckIsRUFBNkI7QUFDM0IsU0FBSzBCLE9BQUwsR0FBZUEsT0FBZjtBQUNBLFNBQUsxQixNQUFMLEdBQWNBLE1BQWQ7QUFDQSxTQUFLMkIsS0FBTCxHQUFhLElBQUlDLE9BQUosQ0FBWSxDQUFDQyxPQUFELEVBQVVDLE1BQVYsS0FBcUI7QUFDNUMsV0FBS0MsYUFBTCxDQUFvQixHQUFFTCxPQUFRLFVBQTlCLEVBQ0dULElBREgsQ0FDUWUsT0FBT0gsUUFBUUcsSUFBSUwsS0FBSixJQUFhLEVBQXJCLENBRGYsRUFFR0wsS0FGSCxDQUVTVyxPQUFPO0FBQ1osYUFBS2pDLE1BQUwsQ0FBWUcsR0FBWixDQUFnQixtQ0FBaEI7QUFDQTJCLGVBQU9HLEdBQVA7QUFDRCxPQUxIO0FBTUQsS0FQWSxDQUFiO0FBUUQ7O0FBRURDLE1BQUlDLElBQUosRUFBVUMsRUFBVixFQUFjO0FBQ1osV0FBTyxLQUFLQyxRQUFMLENBQWNGLElBQWQsRUFDSmxCLElBREksQ0FDQ3FCLFFBQVEsS0FBS1AsYUFBTCxDQUFvQixHQUFFTyxJQUFLLElBQUdGLEVBQUcsRUFBakMsQ0FEVCxFQUVKbkIsSUFGSSxDQUVDZSxPQUFPLEtBQUtPLFlBQUwsQ0FBa0JQLEdBQWxCLENBRlIsRUFHSlYsS0FISSxDQUdFVyxPQUFPO0FBQ1osV0FBS2pDLE1BQUwsQ0FBWUcsR0FBWixDQUFnQjhCLEdBQWhCO0FBQ0EsYUFBTyxJQUFQO0FBQ0QsS0FOSSxDQUFQO0FBT0Q7O0FBRURqQixNQUFJbUIsSUFBSixFQUFVO0FBQUVyQixZQUFRLENBQUMsQ0FBWDtBQUFjQyxXQUFPLEVBQXJCO0FBQXlCVCxhQUFTO0FBQWxDLE1BQXlDLEVBQW5ELEVBQXVEO0FBQ3JELFdBQU8sS0FBSytCLFFBQUwsQ0FBY0YsSUFBZCxFQUFvQmxCLElBQXBCLENBQXlCdUIsWUFBWTtBQUMxQyxVQUFJRixPQUFRLEdBQUVFLFFBQVMsRUFBdkI7O0FBQ0EsVUFBSWxDLE9BQU9tQyxNQUFYLEVBQW1CO0FBQ2pCSCxnQkFBUyxJQUFHaEMsTUFBTyxFQUFuQjtBQUNEOztBQUNELFVBQUlTLEtBQUswQixNQUFULEVBQWlCO0FBQ2ZILGdCQUFTLEdBQUVoQyxPQUFPbUMsTUFBUCxHQUFnQixHQUFoQixHQUFzQixHQUFJLFFBQU8xQixJQUFLLEVBQWpEO0FBQ0F1QixnQkFBUyxnQkFBVDtBQUNEOztBQUVELFVBQUlJLFNBQVMsRUFBYjtBQUNBLFVBQUlDLGdCQUFnQixDQUFwQjtBQUNBLFlBQU1DLFdBQVcsSUFBSUMsR0FBSixDQUFRLEVBQVIsQ0FBakI7O0FBRUEsWUFBTUMsWUFBWUMsWUFBWTtBQUM1QkgsaUJBQVNJLEdBQVQsQ0FBYUQsUUFBYjtBQUNBLGVBQU8sS0FBS2hCLGFBQUwsQ0FBbUJnQixRQUFuQixFQUE2QjlCLElBQTdCLENBQWtDZSxPQUFPO0FBQzlDWSxtQkFBU0ssTUFBVCxDQUFnQkYsUUFBaEI7QUFDQVQsaUJBQU9OLElBQUlMLEtBQUosQ0FBVXVCLElBQVYsSUFBa0IsS0FBekI7QUFDQSxjQUFJQyxZQUFZLEtBQUtaLFlBQUwsQ0FBa0JQLEdBQWxCLENBQWhCO0FBQ0FXLDJCQUFrQlEsU0FBRCxHQUFjQSxVQUFVVixNQUF4QixHQUFpQyxDQUFsRDtBQUNBQyxpQkFBT1UsSUFBUCxDQUFZLElBQUlELGFBQWEsRUFBakIsQ0FBWjtBQUNBLGlCQUFPdkIsUUFBUUMsT0FBUixDQUFnQmEsTUFBaEIsQ0FBUDtBQUNELFNBUE0sQ0FBUDtBQVFELE9BVkQ7O0FBWUEsVUFBSVcscUJBQXFCLEVBQXpCOztBQUNBLFlBQU1DLFVBQVUsTUFBTTtBQUNwQixZQUFJaEIsUUFBUSxDQUFDTSxTQUFTVyxHQUFULENBQWFqQixJQUFiLENBQVQsS0FBZ0N4QixVQUFVLENBQUMsQ0FBWCxJQUFnQjZCLGdCQUFnQjdCLEtBQWhFLENBQUosRUFBNEU7QUFDMUV1Qyw2QkFBbUJELElBQW5CLENBQXdCTixVQUFVUixJQUFWLENBQXhCO0FBQ0Q7O0FBQ0QsZUFBTyxDQUFDSSxPQUFPRCxNQUFSLElBQWtCWSxtQkFBbUJaLE1BQXJDLEdBQ0hZLG1CQUFtQkcsS0FBbkIsR0FBMkJ2QyxJQUEzQixDQUFnQyxNQUFNeUIsTUFBdEMsQ0FERyxHQUVIZCxRQUFRQyxPQUFSLENBQWdCYSxNQUFoQixDQUZKO0FBR0QsT0FQRDs7QUFTQSxVQUFJZSxRQUFRLENBQVo7O0FBQ0EsWUFBTXZDLFNBQVUsYUFBWTtBQUMxQixlQUFPd0IsT0FBT0QsTUFBUCxJQUFpQkcsU0FBU2MsSUFBMUIsSUFBa0NwQixJQUF6QyxFQUErQztBQUM3QyxnQkFBTXhCLFVBQVUsQ0FBQyxDQUFYLElBQWdCMkMsUUFBUTNDLEtBQXhCLEdBQWdDd0MsVUFBVXJDLElBQVYsQ0FBZXlCLFVBQVU7QUFDN0RlO0FBQ0Esa0JBQU12RCxXQUFXd0MsT0FBT2MsS0FBUCxFQUFqQjtBQUNBLG1CQUFPdEQsWUFBWSxJQUFuQjtBQUNELFdBSnFDLENBQWhDLEdBSUQsS0FKTDtBQUtEO0FBQ0YsT0FSYyxFQUFmOztBQVNBZ0IsYUFBT3lDLFdBQVAsR0FBcUIsTUFBTWpCLE9BQU9ELE1BQVAsSUFBaUJHLFNBQVNjLElBQTFCLElBQWtDcEIsSUFBN0Q7O0FBQ0FwQixhQUFPMEMsT0FBUCxHQUFpQixDQUFDQyxPQUFPLENBQUMsQ0FBVCxLQUFlQSxTQUFTLENBQUMsQ0FBVixHQUFlL0MsUUFBUSxDQUFDLENBQXhCLEdBQThCQSxTQUFTK0MsSUFBdkU7O0FBRUEsYUFBTyxLQUFLQyxVQUFMLENBQWdCNUMsTUFBaEIsQ0FBUDtBQUNELEtBbERNLENBQVA7QUFtREQ7O0FBRUQ0QyxhQUFXNUMsTUFBWCxFQUFtQjtBQUNqQixXQUFPO0FBQ0xDLGVBQVMsaUJBQVM0QyxDQUFULEVBQVk7QUFDbkIsZUFBTyxJQUFJbkMsT0FBSixDQUFZLENBQUNDLE9BQUQsRUFBVUMsTUFBVixLQUFxQjtBQUN0QyxnQkFBTWtDLElBQUlkLFFBQVE7QUFDaEIsZ0JBQUlBLElBQUosRUFBVTtBQUNSQSxtQkFDR2pDLElBREgsQ0FDUWYsWUFBWTtBQUNoQixvQkFBSUEsUUFBSixFQUFjNkQsRUFBRTdELFFBQUY7QUFDZDhELGtCQUFFOUMsT0FBT2dDLElBQVAsR0FBY2UsS0FBaEI7QUFDRCxlQUpILEVBS0czQyxLQUxILENBS1NRLE1BTFQ7QUFNRCxhQVBELE1BT087QUFDTEQsc0JBQ0VYLE9BQU95QyxXQUFQLEtBQXVCekMsT0FBTzBDLE9BQTlCLEdBQXdDLEtBRDFDO0FBR0Q7QUFDRixXQWJEOztBQWNBSSxZQUFFOUMsT0FBT2dDLElBQVAsR0FBY2UsS0FBaEI7QUFDRCxTQWhCTSxDQUFQO0FBaUJEO0FBbkJJLEtBQVA7QUFxQkQ7O0FBRURsQyxnQkFBY21DLEdBQWQsRUFBbUI7QUFDakIsV0FBT0MsTUFBTUQsR0FBTixFQUFXakQsSUFBWCxDQUNMbUQsT0FBUUEsSUFBSUMsRUFBSixHQUFTRCxJQUFJRSxJQUFKLEVBQVQsR0FBc0IxQyxRQUFRRSxNQUFSLENBQWVzQyxJQUFJRyxVQUFuQixDQUR6QixDQUFQO0FBR0Q7O0FBRURoQyxlQUFhUCxHQUFiLEVBQWtCO0FBQ2hCLFFBQUlBLElBQUl3QyxjQUFKLENBQW1CLE1BQW5CLENBQUosRUFBZ0M7QUFDOUIsYUFBT3hDLElBQUl5QyxJQUFYO0FBQ0Q7O0FBQ0QsUUFBSXpDLElBQUl3QyxjQUFKLENBQW1CLFFBQW5CLENBQUosRUFBa0M7QUFDaEN4QyxVQUFJMEMsTUFBSixDQUFXQyxPQUFYLENBQW1CLEtBQUszRSxNQUFMLENBQVlHLEdBQS9CO0FBQ0EsYUFBTyxJQUFQO0FBQ0QsS0FIRCxNQUdPO0FBQ0wsV0FBS0gsTUFBTCxDQUFZRyxHQUFaLENBQ0UsdUVBREY7QUFHRDtBQUNGOztBQUVEa0MsV0FBU0YsSUFBVCxFQUFlO0FBQ2IsV0FBTyxJQUFJUCxPQUFKLENBQVksQ0FBQ0MsT0FBRCxFQUFVQyxNQUFWLEtBQXFCO0FBQ3RDLFdBQUtILEtBQUwsQ0FDR1YsSUFESCxDQUNRVSxTQUFTO0FBQ2IsWUFBSSxDQUFDQSxNQUFNNkMsY0FBTixDQUFxQnJDLElBQXJCLENBQUwsRUFBaUM7QUFDL0JMLGlCQUFRLElBQUdLLElBQUssNkJBQTRCLEtBQUtULE9BQVEsR0FBekQ7QUFDRDs7QUFDREcsZ0JBQVFGLE1BQU1RLElBQU4sQ0FBUjtBQUNELE9BTkgsRUFPR2IsS0FQSCxDQU9TUSxNQVBUO0FBUUQsS0FUTSxDQUFQO0FBVUQ7O0FBRUR4QixTQUFPMEQsQ0FBUCxFQUFVO0FBQ1IsV0FBTyxJQUFJLDREQUFKLENBQVdBLENBQVgsQ0FBUDtBQUNEOztBQXpJK0IsQzs7Ozs7Ozs7O0FDRm5CLE1BQU1ZLE1BQU4sQ0FBYTtBQUUxQm5ELGNBQVl1QyxDQUFaLEVBQWU7QUFDYixTQUFLYSxVQUFMLEdBQWtCYixFQUFFYyxVQUFGLEVBQWNDLE9BQU92RSxHQUFyQixFQUEwQnVFLE9BQU90RSxFQUFqQyxFQUFzQ3VFLEdBQUQsSUFBVUMsVUFBRCxJQUFnQkEsV0FBV0QsR0FBWCxDQUE5RCxDQUFsQjtBQUNEOztBQUVERSxVQUFRRCxVQUFSLEVBQW9CO0FBQ2xCLFVBQU03QyxLQUFLLGFBQWE7QUFDdEIsVUFBSStDLFVBQVUsQ0FBZDs7QUFDQSxhQUFPLElBQVAsRUFBYTtBQUNYLGNBQU1BLFNBQU47QUFDRDtBQUNGLEtBTFUsRUFBWDs7QUFPQSxVQUFNQyxXQUFXLENBQUNDLEdBQUQsRUFBTUMsSUFBTixFQUFZQyxDQUFaLEVBQWVDLFdBQVcsSUFBMUIsS0FBbUM7QUFDbEQsWUFBTUMsWUFBWXJELEdBQUdjLElBQUgsR0FBVWUsS0FBNUI7QUFDQSxZQUFNeUIsU0FBU0wsSUFBSTVDLE1BQUosR0FBYyxHQUFFNEMsR0FBSSxHQUFwQixHQUF5QixFQUF4Qzs7QUFDQSxVQUFJQyxLQUFLSyxPQUFULEVBQWtCO0FBQ2hCLGNBQU1DLE9BQVEsVUFBU0gsU0FBVSxVQUFqQztBQUNBLGNBQU1JLE9BQU9MLFdBQ1IsR0FBRUksSUFBSyxpQkFBZ0JOLEtBQUtRLFdBQVksSUFBR0YsSUFBSyxjQUFhSixRQUFTLEVBRDlELEdBRVIsR0FBRUksSUFBSyxpQkFBZ0JOLEtBQUtRLFdBQVksRUFGN0M7QUFHQSxlQUFRLEdBQUVKLE1BQU8sR0FBRUosS0FBS0ssT0FBTCxDQUFhSSxNQUFiLENBQW9CLENBQUNWLEdBQUQsRUFBTUMsSUFBTixFQUFZQyxDQUFaLEtBQWtCSCxTQUFTQyxHQUFULEVBQWNDLElBQWQsRUFBb0JDLENBQXBCLEVBQXVCRSxTQUF2QixDQUF0QyxFQUF5RUksSUFBekUsQ0FBK0UsRUFBbEc7QUFDRCxPQU5ELE1BT0s7QUFDSCxjQUFNRCxPQUFRLFVBQVNILFNBQVUsY0FBakM7QUFDQSxZQUFJSSxPQUFPLEVBQVg7QUFDQUEsZ0JBQVMsR0FBRUQsSUFBSyxVQUFTTixLQUFLVSxJQUFLLEVBQW5DLENBSEcsQ0FJSDs7QUFDQUgsZ0JBQVMsSUFBR0QsSUFBSyxXQUFVLE9BQU9OLEtBQUtyQixLQUFaLEtBQXNCLFVBQXRCLEdBQW1DcUIsS0FBS3JCLEtBQUwsQ0FBV2dCLFVBQVgsQ0FBbkMsR0FBNERLLEtBQUtyQixLQUFNLEVBQWxHO0FBQ0E0QixnQkFBUyxJQUFHRCxJQUFLLGNBQWFOLEtBQUtXLFFBQVMsRUFBNUM7QUFDQSxlQUFPVCxXQUNGLEdBQUVFLE1BQU8sR0FBRUcsSUFBSyxJQUFHRCxJQUFLLGNBQWFKLFFBQVMsRUFENUMsR0FFRixHQUFFRSxNQUFPLEdBQUVHLElBQUssRUFGckI7QUFHRDtBQUNGLEtBckJEOztBQXVCQSxXQUFPVCxTQUFTLEVBQVQsRUFBYSxLQUFLUCxVQUFsQixDQUFQO0FBQ0Q7O0FBdEN5QjtBQUFBO0FBQUE7QUEwQzVCLE1BQU1FLFNBQVM7QUFFYnZFLE9BQUssQ0FBQyxHQUFHbUYsT0FBSixLQUFnQjtBQUNuQixXQUFPWixPQUFPbUIsS0FBUCxDQUFhUCxPQUFiLEVBQXNCLEtBQXRCLENBQVA7QUFDRCxHQUpZO0FBTWJsRixNQUFJLENBQUMsR0FBR2tGLE9BQUosS0FBZ0I7QUFDbEIsV0FBT1osT0FBT21CLEtBQVAsQ0FBYVAsT0FBYixFQUFzQixJQUF0QixDQUFQO0FBQ0QsR0FSWTtBQVViTyxTQUFPLENBQUNQLE9BQUQsRUFBVUcsV0FBVixLQUEwQjtBQUMvQixXQUFPO0FBQ0xBLGlCQURLO0FBRUxIO0FBRkssS0FBUDtBQUlEO0FBZlksQ0FBZjs7QUFtQkEsTUFBTWIsYUFBYSxTQUFiQSxVQUFhLENBQVVkLENBQVYsRUFBYW1DLENBQWIsRUFBZ0I7QUFDakMsU0FBT3JCLFdBQVdzQixFQUFYLENBQWNwQyxDQUFkLEVBQWlCbUMsQ0FBakIsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXc0IsRUFBWCxHQUFnQixDQUFDcEMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ3hCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXd0IsS0FBWCxHQUFtQixDQUFDdEMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzNCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXeUIsRUFBWCxHQUFnQixDQUFDdkMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ3hCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXMEIsSUFBWCxHQUFrQixDQUFDeEMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzFCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXMkIsRUFBWCxHQUFnQixDQUFDekMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ3hCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsR0FBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXNEIsSUFBWCxHQUFrQixDQUFDMUMsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzFCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsSUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXbEUsVUFBWCxHQUF3QixDQUFDb0QsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQ2hDLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsYUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXbkUsUUFBWCxHQUFzQixDQUFDcUQsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzlCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsVUFBM0IsQ0FBUDtBQUNELENBRkQ7O0FBSUFyQixXQUFXNkIsUUFBWCxHQUFzQixDQUFDM0MsQ0FBRCxFQUFJbUMsQ0FBSixLQUFVO0FBQzlCLFNBQU9yQixXQUFXdUIsU0FBWCxDQUFxQnJDLENBQXJCLEVBQXdCbUMsQ0FBeEIsRUFBMkIsV0FBM0IsQ0FBUDtBQUNELENBRkQsQyxDQUlBO0FBQ0E7QUFDQTs7O0FBRUFyQixXQUFXdUIsU0FBWCxHQUF1QixDQUFDckMsQ0FBRCxFQUFJbUMsQ0FBSixFQUFPUyxFQUFQLEtBQWM7QUFDbkMsU0FBTztBQUNMWixVQUFNaEMsQ0FERDtBQUVMQyxXQUFPa0MsQ0FGRjtBQUdMRixjQUFVWSxtQkFBbUJELEVBQW5CO0FBSEwsR0FBUDtBQUtELENBTkQsQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKSB7XG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG4gXHRcdH1cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGk6IG1vZHVsZUlkLFxuIFx0XHRcdGw6IGZhbHNlLFxuIFx0XHRcdGV4cG9ydHM6IHt9XG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmwgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb24gZm9yIGhhcm1vbnkgZXhwb3J0c1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kID0gZnVuY3Rpb24oZXhwb3J0cywgbmFtZSwgZ2V0dGVyKSB7XG4gXHRcdGlmKCFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywgbmFtZSkpIHtcbiBcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgbmFtZSwge1xuIFx0XHRcdFx0Y29uZmlndXJhYmxlOiBmYWxzZSxcbiBcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG4gXHRcdFx0XHRnZXQ6IGdldHRlclxuIFx0XHRcdH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5uID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gXHRcdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuIFx0XHRcdGZ1bmN0aW9uIGdldERlZmF1bHQoKSB7IHJldHVybiBtb2R1bGVbJ2RlZmF1bHQnXTsgfSA6XG4gXHRcdFx0ZnVuY3Rpb24gZ2V0TW9kdWxlRXhwb3J0cygpIHsgcmV0dXJuIG1vZHVsZTsgfTtcbiBcdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgJ2EnLCBnZXR0ZXIpO1xuIFx0XHRyZXR1cm4gZ2V0dGVyO1xuIFx0fTtcblxuIFx0Ly8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7IHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSk7IH07XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IDApO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIHdlYnBhY2svYm9vdHN0cmFwIDNiZWJjNWVmYzQxNTA5MjAxYjQ2IiwiaW1wb3J0IERDbGllbnQgZnJvbSAnLi9saWInO1xuXG5jb25zdCBjbGllbnQgPSBuZXcgRENsaWVudCgnaHR0cDovL2pzb25hcGkudGVzdDo4MDgwJywgY29uc29sZSk7XG5cbmNvbnN0IGxvZ2dlciA9IGxhYmVsID0+IHtcbiAgcmV0dXJuIHJlc291cmNlID0+IGNvbnNvbGUubG9nKGAke2xhYmVsfTpgLCByZXNvdXJjZS5hdHRyaWJ1dGVzLnRpdGxlKTtcbn07XG5cbmNvbnN0IGZpbHRlciA9IGNsaWVudC5maWx0ZXIoKGMsIGFuZCwgb3IsIHBhcmFtKSA9PiB7XG4gIHJldHVybiBhbmQoXG4gICAgYygnc3RhdHVzJywgMSksXG4gICAgb3IoYy5jb250YWlucygndGl0bGUnLCBwYXJhbSgncGFyYW1PbmUnKSksIGMuc3RhcnRzV2l0aCgndGl0bGUnLCAnVGhhaScpKSxcbiAgKTtcbn0pO1xuXG5jb25zdCBvcHRpb25zID0ge1xuICBsaW1pdDogMyxcbiAgc29ydDogJ3RpdGxlJyxcbiAgLy9maWx0ZXI6IGZpbHRlci5jb21waWxlKHtwYXJhbU9uZTogJ2Vhc3knfSksXG59O1xuXG5jbGllbnRcbiAgLmFsbCgnbm9kZS0tcmVjaXBlJywgb3B0aW9ucylcbiAgLnRoZW4oY3Vyc29yID0+IHtcbiAgICByZXR1cm4gY3Vyc29yLmNvbnN1bWUobG9nZ2VyKCdJbml0aWFsJykpLnRoZW4obW9yZSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgVGhlcmUgYXJlICR7bW9yZSA/ICdtb3JlJyA6ICdubyBtb3JlJ30gcmVzb3VyY2VzIWApO1xuICAgICAgaWYgKG1vcmUpIHtcbiAgICAgICAgbW9yZSgyMCk7XG4gICAgICAgIGN1cnNvci5jb25zdW1lKGxvZ2dlcignQWRkaXRpb25hbCcpKS50aGVuKGV2ZW5Nb3JlID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgVGhlcmUgYXJlICR7ZXZlbk1vcmUgPyAnbW9yZScgOiAnbm8gbW9yZSd9IHJlc291cmNlcyFgKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pXG4gIC5jYXRjaChlcnJvciA9PiBjb25zb2xlLmxvZygnRXJyb3I6JywgZXJyb3IpKTtcblxuLy9jbGllbnQuZ2V0KCdub2RlLS1yZWNpcGUnLCAnMjVjMDQ4YjYtNjllOS00NmY0LTk4NmQtNGI4MGIwMWRlMmU2Jylcbi8vICAudGhlbihyZXNvdXJjZSA9PiBjb25zb2xlLmxvZygnSW5kaXZpZHVhbDonLCByZXNvdXJjZSkpXG4vLyAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUubG9nKCdFcnJvcjonLCBlcnJvcikpO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2luZGV4LmpzIiwiaW1wb3J0IEZpbHRlciBmcm9tICcuL2ZpbHRlcnMuanMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEcnVwYWxDbGllbnQge1xuICBjb25zdHJ1Y3RvcihiYXNlVXJsLCBsb2dnZXIpIHtcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xuICAgIHRoaXMubG9nZ2VyID0gbG9nZ2VyO1xuICAgIHRoaXMubGlua3MgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLmZldGNoRG9jdW1lbnQoYCR7YmFzZVVybH0vanNvbmFwaWApXG4gICAgICAgIC50aGVuKGRvYyA9PiByZXNvbHZlKGRvYy5saW5rcyB8fCB7fSkpXG4gICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgIHRoaXMubG9nZ2VyLmxvZygnVW5hYmxlIHRvIHJlc29sdmUgcmVzb3VyY2UgbGlua3MuJyk7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0KHR5cGUsIGlkKSB7XG4gICAgcmV0dXJuIHRoaXMud2l0aExpbmsodHlwZSlcbiAgICAgIC50aGVuKGxpbmsgPT4gdGhpcy5mZXRjaERvY3VtZW50KGAke2xpbmt9LyR7aWR9YCkpXG4gICAgICAudGhlbihkb2MgPT4gdGhpcy5kb2N1bWVudERhdGEoZG9jKSlcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICB0aGlzLmxvZ2dlci5sb2coZXJyKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9KTtcbiAgfVxuXG4gIGFsbCh0eXBlLCB7IGxpbWl0ID0gLTEsIHNvcnQgPSAnJywgZmlsdGVyID0gJycgfSA9IHt9KSB7XG4gICAgcmV0dXJuIHRoaXMud2l0aExpbmsodHlwZSkudGhlbihiYXNlTGluayA9PiB7XG4gICAgICB2YXIgbGluayA9IGAke2Jhc2VMaW5rfWA7XG4gICAgICBpZiAoZmlsdGVyLmxlbmd0aCkge1xuICAgICAgICBsaW5rICs9IGA/JHtmaWx0ZXJ9YDtcbiAgICAgIH1cbiAgICAgIGlmIChzb3J0Lmxlbmd0aCkge1xuICAgICAgICBsaW5rICs9IGAke2ZpbHRlci5sZW5ndGggPyAnJicgOiAnPyd9c29ydD0ke3NvcnR9YDtcbiAgICAgICAgbGluayArPSBgJnBhZ2VbbGltaXRdPTJgO1xuICAgICAgfVxuXG4gICAgICB2YXIgYnVmZmVyID0gW107XG4gICAgICB2YXIgcmVzb3VyY2VDb3VudCA9IDA7XG4gICAgICBjb25zdCBpbkZsaWdodCA9IG5ldyBTZXQoW10pO1xuXG4gICAgICBjb25zdCBkb1JlcXVlc3QgPSBuZXh0TGluayA9PiB7XG4gICAgICAgIGluRmxpZ2h0LmFkZChuZXh0TGluayk7XG4gICAgICAgIHJldHVybiB0aGlzLmZldGNoRG9jdW1lbnQobmV4dExpbmspLnRoZW4oZG9jID0+IHtcbiAgICAgICAgICBpbkZsaWdodC5kZWxldGUobmV4dExpbmspO1xuICAgICAgICAgIGxpbmsgPSBkb2MubGlua3MubmV4dCB8fCBmYWxzZTtcbiAgICAgICAgICB2YXIgcmVzb3VyY2VzID0gdGhpcy5kb2N1bWVudERhdGEoZG9jKTtcbiAgICAgICAgICByZXNvdXJjZUNvdW50ICs9IChyZXNvdXJjZXMpID8gcmVzb3VyY2VzLmxlbmd0aCA6IDA7XG4gICAgICAgICAgYnVmZmVyLnB1c2goLi4uKHJlc291cmNlcyB8fCBbXSkpO1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoYnVmZmVyKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuXG4gICAgICB2YXIgY29sbGVjdGlvblJlcXVlc3RzID0gW107XG4gICAgICBjb25zdCBhZHZhbmNlID0gKCkgPT4ge1xuICAgICAgICBpZiAobGluayAmJiAhaW5GbGlnaHQuaGFzKGxpbmspICYmIChsaW1pdCA9PT0gLTEgfHwgcmVzb3VyY2VDb3VudCA8IGxpbWl0KSkge1xuICAgICAgICAgIGNvbGxlY3Rpb25SZXF1ZXN0cy5wdXNoKGRvUmVxdWVzdChsaW5rKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICFidWZmZXIubGVuZ3RoICYmIGNvbGxlY3Rpb25SZXF1ZXN0cy5sZW5ndGhcbiAgICAgICAgICA/IGNvbGxlY3Rpb25SZXF1ZXN0cy5zaGlmdCgpLnRoZW4oKCkgPT4gYnVmZmVyKVxuICAgICAgICAgIDogUHJvbWlzZS5yZXNvbHZlKGJ1ZmZlcik7XG4gICAgICB9O1xuXG4gICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgY29uc3QgY3Vyc29yID0gKGZ1bmN0aW9uKigpIHtcbiAgICAgICAgd2hpbGUgKGJ1ZmZlci5sZW5ndGggfHwgaW5GbGlnaHQuc2l6ZSB8fCBsaW5rKSB7XG4gICAgICAgICAgeWllbGQgbGltaXQgPT09IC0xIHx8IGNvdW50IDwgbGltaXQgPyBhZHZhbmNlKCkudGhlbihidWZmZXIgPT4ge1xuICAgICAgICAgICAgY291bnQrK1xuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2UgPSBidWZmZXIuc2hpZnQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZSB8fCBudWxsO1xuICAgICAgICAgIH0pIDogZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgICBjdXJzb3IuY2FuQ29udGludWUgPSAoKSA9PiBidWZmZXIubGVuZ3RoIHx8IGluRmxpZ2h0LnNpemUgfHwgbGluaztcbiAgICAgIGN1cnNvci5hZGRNb3JlID0gKG1hbnkgPSAtMSkgPT4gbWFueSA9PT0gLTEgPyAobGltaXQgPSAtMSkgOiAobGltaXQgKz0gbWFueSk7XG5cbiAgICAgIHJldHVybiB0aGlzLnRvQ29uc3VtZXIoY3Vyc29yKTtcbiAgICB9KTtcbiAgfVxuXG4gIHRvQ29uc3VtZXIoY3Vyc29yKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnN1bWU6IGZ1bmN0aW9uKGcpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjb25zdCBmID0gbmV4dCA9PiB7XG4gICAgICAgICAgICBpZiAobmV4dCkge1xuICAgICAgICAgICAgICBuZXh0XG4gICAgICAgICAgICAgICAgLnRoZW4ocmVzb3VyY2UgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlKSBnKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICAgIGYoY3Vyc29yLm5leHQoKS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICAgICAgY3Vyc29yLmNhbkNvbnRpbnVlKCkgPyBjdXJzb3IuYWRkTW9yZSA6IGZhbHNlLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgZihjdXJzb3IubmV4dCgpLnZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBmZXRjaERvY3VtZW50KHVybCkge1xuICAgIHJldHVybiBmZXRjaCh1cmwpLnRoZW4oXG4gICAgICByZXMgPT4gKHJlcy5vayA/IHJlcy5qc29uKCkgOiBQcm9taXNlLnJlamVjdChyZXMuc3RhdHVzVGV4dCkpLFxuICAgICk7XG4gIH1cblxuICBkb2N1bWVudERhdGEoZG9jKSB7XG4gICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eSgnZGF0YScpKSB7XG4gICAgICByZXR1cm4gZG9jLmRhdGE7XG4gICAgfVxuICAgIGlmIChkb2MuaGFzT3duUHJvcGVydHkoJ2Vycm9ycycpKSB7XG4gICAgICBkb2MuZXJyb3JzLmZvckVhY2godGhpcy5sb2dnZXIubG9nKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxvZ2dlci5sb2coXG4gICAgICAgICdUaGUgc2VydmVyIHJldHVybmVkIGFuIHVucHJvY2Vzc2FibGUgZG9jdW1lbnQgd2l0aCBubyBkYXRhIG9yIGVycm9ycy4nLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICB3aXRoTGluayh0eXBlKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMubGlua3NcbiAgICAgICAgLnRoZW4obGlua3MgPT4ge1xuICAgICAgICAgIGlmICghbGlua3MuaGFzT3duUHJvcGVydHkodHlwZSkpIHtcbiAgICAgICAgICAgIHJlamVjdChgJyR7dHlwZX0nIGlzIG5vdCBhIHZhbGlkIHR5cGUgZm9yICR7dGhpcy5iYXNlVXJsfS5gKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzb2x2ZShsaW5rc1t0eXBlXSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgIH0pO1xuICB9XG5cbiAgZmlsdGVyKGYpIHtcbiAgICByZXR1cm4gbmV3IEZpbHRlcihmKTtcbiAgfVxuXG59XG5cblxuXG4vLyBXRUJQQUNLIEZPT1RFUiAvL1xuLy8gLi9zcmMvbGliL2luZGV4LmpzIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRmlsdGVyIHtcblxuICBjb25zdHJ1Y3RvcihmKSB7XG4gICAgdGhpcy5jb25kaXRpb25zID0gZihDb25kaXRpb25zLCBHcm91cHMuYW5kLCBHcm91cHMub3IsIChrZXkpID0+IChwYXJhbWV0ZXJzKSA9PiBwYXJhbWV0ZXJzW2tleV0pO1xuICB9XG5cbiAgY29tcGlsZShwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgaWQgPSBmdW5jdGlvbiogKCkge1xuICAgICAgdmFyIGNvdW50ZXIgPSAxO1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgeWllbGQgY291bnRlcisrO1xuICAgICAgfVxuICAgIH0oKTtcblxuICAgIGNvbnN0IGNvbXBpbGVyID0gKGFjYywgaXRlbSwgXywgcGFyZW50SUQgPSBudWxsKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50SUQgPSBpZC5uZXh0KCkudmFsdWU7XG4gICAgICBjb25zdCBwcmVmaXggPSBhY2MubGVuZ3RoID8gYCR7YWNjfSZgIDogJyc7XG4gICAgICBpZiAoaXRlbS5tZW1iZXJzKSB7XG4gICAgICAgIGNvbnN0IHJvb3QgPSBgZmlsdGVyWyR7Y3VycmVudElEfV1bZ3JvdXBdYDtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHBhcmVudElEXG4gICAgICAgICAgPyBgJHtyb290fVtjb25qdW5jdGlvbl09JHtpdGVtLmNvbmp1bmN0aW9ufSYke3Jvb3R9W21lbWJlck9mXT0ke3BhcmVudElEfWBcbiAgICAgICAgICA6IGAke3Jvb3R9W2Nvbmp1bmN0aW9uXT0ke2l0ZW0uY29uanVuY3Rpb259YDtcbiAgICAgICAgcmV0dXJuIGAke3ByZWZpeH0ke2l0ZW0ubWVtYmVycy5yZWR1Y2UoKGFjYywgaXRlbSwgXykgPT4gY29tcGlsZXIoYWNjLCBpdGVtLCBfLCBjdXJyZW50SUQpLCBzZWxmKX1gO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IHJvb3QgPSBgZmlsdGVyWyR7Y3VycmVudElEfV1bY29uZGl0aW9uXWA7XG4gICAgICAgIHZhciBzZWxmID0gJyc7XG4gICAgICAgIHNlbGYgKz0gYCR7cm9vdH1bcGF0aF09JHtpdGVtLnBhdGh9YDtcbiAgICAgICAgLy8gQHRvZG8gZXhwYW5kIGZvciBtdWx0aXZhbHVlIG9wZXJhdG9ycyBhbiBudWxsL25vdCBudWxsXG4gICAgICAgIHNlbGYgKz0gYCYke3Jvb3R9W3ZhbHVlXT0ke3R5cGVvZiBpdGVtLnZhbHVlID09PSBcImZ1bmN0aW9uXCIgPyBpdGVtLnZhbHVlKHBhcmFtZXRlcnMpIDogaXRlbS52YWx1ZX1gO1xuICAgICAgICBzZWxmICs9IGAmJHtyb290fVtvcGVyYXRvcl09JHtpdGVtLm9wZXJhdG9yfWA7XG4gICAgICAgIHJldHVybiBwYXJlbnRJRFxuICAgICAgICAgID8gYCR7cHJlZml4fSR7c2VsZn0mJHtyb290fVttZW1iZXJPZl09JHtwYXJlbnRJRH1gXG4gICAgICAgICAgOiBgJHtwcmVmaXh9JHtzZWxmfWA7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBjb21waWxlcignJywgdGhpcy5jb25kaXRpb25zKTtcbiAgfVxuXG59XG5cbmNvbnN0IEdyb3VwcyA9IHtcblxuICBhbmQ6ICguLi5tZW1iZXJzKSA9PiB7XG4gICAgcmV0dXJuIEdyb3Vwcy5ncm91cChtZW1iZXJzLCAnQU5EJyk7XG4gIH0sXG5cbiAgb3I6ICguLi5tZW1iZXJzKSA9PiB7XG4gICAgcmV0dXJuIEdyb3Vwcy5ncm91cChtZW1iZXJzLCAnT1InKTtcbiAgfSxcblxuICBncm91cDogKG1lbWJlcnMsIGNvbmp1bmN0aW9uKSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmp1bmN0aW9uLFxuICAgICAgbWVtYmVycyxcbiAgICB9XG4gIH0sXG5cbn1cblxuY29uc3QgQ29uZGl0aW9ucyA9IGZ1bmN0aW9uIChmLCB2KSB7XG4gIHJldHVybiBDb25kaXRpb25zLmVxKGYsIHYpO1xufVxuXG5Db25kaXRpb25zLmVxID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc9Jyk7XG59XG5cbkNvbmRpdGlvbnMubm90RXEgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJzw+Jyk7XG59XG5cbkNvbmRpdGlvbnMuZ3QgPSAoZiwgdikgPT4ge1xuICByZXR1cm4gQ29uZGl0aW9ucy5jb25kaXRpb24oZiwgdiwgJz4nKTtcbn1cblxuQ29uZGl0aW9ucy5ndEVxID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc+PScpO1xufVxuXG5Db25kaXRpb25zLmx0ID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICc8Jyk7XG59XG5cbkNvbmRpdGlvbnMubHRFcSA9IChmLCB2KSA9PiB7XG4gIHJldHVybiBDb25kaXRpb25zLmNvbmRpdGlvbihmLCB2LCAnPD0nKTtcbn1cblxuQ29uZGl0aW9ucy5zdGFydHNXaXRoID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICdTVEFSVFNfV0lUSCcpO1xufVxuXG5Db25kaXRpb25zLmNvbnRhaW5zID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICdDT05UQUlOUycpO1xufVxuXG5Db25kaXRpb25zLmVuZHNXaXRoID0gKGYsIHYpID0+IHtcbiAgcmV0dXJuIENvbmRpdGlvbnMuY29uZGl0aW9uKGYsIHYsICdFTkRTX1dJVEgnKTtcbn1cblxuLy8gQHRvZG8gYWRkIHN1cHBvcnQgZm9yOiAnSU4nLCAnTk9UIElOJ1xuLy8gQHRvZG8gYWRkIHN1cHBvcnQgZm9yOiAnQkVUV0VFTicsICdOT1QgQkVUV0VFTidcbi8vIEB0b2RvIGFkZCBzdXBwb3J0IGZvcjogJ0lTIE5VTEwnLCAnSVMgTk9UIE5VTEwnXG5cbkNvbmRpdGlvbnMuY29uZGl0aW9uID0gKGYsIHYsIG9wKSA9PiB7XG4gIHJldHVybiB7XG4gICAgcGF0aDogZixcbiAgICB2YWx1ZTogdixcbiAgICBvcGVyYXRvcjogZW5jb2RlVVJJQ29tcG9uZW50KG9wKSxcbiAgfTtcbn1cblxuXG5cbi8vIFdFQlBBQ0sgRk9PVEVSIC8vXG4vLyAuL3NyYy9saWIvZmlsdGVycy5qcyJdLCJzb3VyY2VSb290IjoiIn0=