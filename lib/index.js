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

client.all('node--recipe', {
  max: 3,
  sort: 'title'
}).then(cursor => {
  return cursor.forEach(logger('Initial')).then(more => {
    console.log(`There are ${more ? 'more' : 'no more'} resources!`);
    more(10);
    cursor.forEach(logger('Additional')).then(evenMore => {
      console.log(`There are ${evenMore ? 'more' : 'no more'} resources!`);
    });
  });
}).catch(error => console.log('Error:', error)); //client.get('node--recipe', '25c048b6-69e9-46f4-986d-4b80b01de2e6')
//  .then(resource => console.log('Individual:', resource))
//  .catch(error => console.log('Error:', error));

/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
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
    filter = 'page[limit]=2'
  } = {}) {
    return this.withLink(type).then(baseLink => {
      var link = `${baseLink}?${filter}`;

      if (sort.length) {
        link += `&sort=${sort}`;
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
          reject(`'${type}' is not a valid URL for ${this.baseUrl}.`);
        }

        resolve(links[type]);
      }).catch(reject);
    });
  }

}
/* harmony export (immutable) */ __webpack_exports__["a"] = DrupalClient;


/***/ })
/******/ ]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAgY2ZkMmY2YThiMGU5ZDNhY2EzZWEiLCJ3ZWJwYWNrOi8vLy4vc3JjL2luZGV4LmpzIiwid2VicGFjazovLy8uL3NyYy9saWIvaW5kZXguanMiXSwibmFtZXMiOlsiY2xpZW50IiwiY29uc29sZSIsImxvZ2dlciIsImxhYmVsIiwicmVzb3VyY2UiLCJsb2ciLCJhdHRyaWJ1dGVzIiwidGl0bGUiLCJhbGwiLCJtYXgiLCJzb3J0IiwidGhlbiIsImN1cnNvciIsImZvckVhY2giLCJtb3JlIiwiZXZlbk1vcmUiLCJjYXRjaCIsImVycm9yIiwiRHJ1cGFsQ2xpZW50IiwiY29uc3RydWN0b3IiLCJiYXNlVXJsIiwibGlua3MiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImZldGNoRG9jdW1lbnQiLCJkb2MiLCJlcnIiLCJnZXQiLCJ0eXBlIiwiaWQiLCJ3aXRoTGluayIsImxpbmsiLCJkb2N1bWVudERhdGEiLCJmaWx0ZXIiLCJiYXNlTGluayIsImxlbmd0aCIsImNvbGxlY3Rpb25SZXF1ZXN0cyIsImNvbGxlY3Rpb24iLCJpbkZsaWdodCIsIlNldCIsImRvUmVxdWVzdCIsIm5leHRMaW5rIiwiYWRkIiwiZGVsZXRlIiwibmV4dCIsInB1c2giLCJhZHZhbmNlIiwiaGFzIiwic2hpZnQiLCJjb3VudCIsInNpemUiLCJ2aWV3IiwiZyIsImYiLCJ2YWx1ZSIsImFkZE1vcmUiLCJtYW55IiwidXJsIiwiZmV0Y2giLCJyZXMiLCJvayIsImpzb24iLCJzdGF0dXNUZXh0IiwiaGFzT3duUHJvcGVydHkiLCJkYXRhIiwiZXJyb3JzIl0sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNB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UUFBUUUsTUFBUixDQUFlb0MsSUFBSUcsVUFBbkIsQ0FEekIsQ0FBUDtBQUdEOztBQUVEOUIsZUFBYVAsR0FBYixFQUFrQjtBQUNoQixRQUFJQSxJQUFJc0MsY0FBSixDQUFtQixNQUFuQixDQUFKLEVBQWdDO0FBQzlCLGFBQU90QyxJQUFJdUMsSUFBWDtBQUNEOztBQUNELFFBQUl2QyxJQUFJc0MsY0FBSixDQUFtQixRQUFuQixDQUFKLEVBQWtDO0FBQ2hDdEMsVUFBSXdDLE1BQUosQ0FBV3JELE9BQVgsQ0FBbUIsS0FBS1gsTUFBTCxDQUFZRyxHQUEvQjtBQUNBLGFBQU8sSUFBUDtBQUNELEtBSEQsTUFHTztBQUNMLFdBQUtILE1BQUwsQ0FBWUcsR0FBWixDQUNFLHVFQURGO0FBR0Q7QUFDRjs7QUFFRDBCLFdBQVNGLElBQVQsRUFBZTtBQUNiLFdBQU8sSUFBSVAsT0FBSixDQUFZLENBQUNDLE9BQUQsRUFBVUMsTUFBVixLQUFxQjtBQUN0QyxXQUFLSCxLQUFMLENBQ0dWLElBREgsQ0FDUVUsU0FBUztBQUNiLFlBQUksQ0FBQ0EsTUFBTTJDLGNBQU4sQ0FBcUJuQyxJQUFyQixDQUFMLEVBQWlDO0FBQy9CTCxpQkFBUSxJQUFHSyxJQUFLLDRCQUEyQixLQUFLVCxPQUFRLEdBQXhEO0FBQ0Q7O0FBQ0RHLGdCQUFRRixNQUFNUSxJQUFOLENBQVI7QUFDRCxPQU5ILEVBT0diLEtBUEgsQ0FPU1EsTUFQVDtBQVFELEtBVE0sQ0FBUDtBQVVEOztBQXpIK0IsQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbiBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG5cbiBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cbiBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKSB7XG4gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG4gXHRcdH1cbiBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbiBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuIFx0XHRcdGk6IG1vZHVsZUlkLFxuIFx0XHRcdGw6IGZhbHNlLFxuIFx0XHRcdGV4cG9ydHM6IHt9XG4gXHRcdH07XG5cbiBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4gXHRcdG1vZHVsZXNbbW9kdWxlSWRdLmNhbGwobW9kdWxlLmV4cG9ydHMsIG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG4gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbiBcdFx0bW9kdWxlLmwgPSB0cnVlO1xuXG4gXHRcdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG4gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbiBcdH1cblxuXG4gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5tID0gbW9kdWxlcztcblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbiBcdF9fd2VicGFja19yZXF1aXJlX18uYyA9IGluc3RhbGxlZE1vZHVsZXM7XG5cbiBcdC8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb24gZm9yIGhhcm1vbnkgZXhwb3J0c1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kID0gZnVuY3Rpb24oZXhwb3J0cywgbmFtZSwgZ2V0dGVyKSB7XG4gXHRcdGlmKCFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywgbmFtZSkpIHtcbiBcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgbmFtZSwge1xuIFx0XHRcdFx0Y29uZmlndXJhYmxlOiBmYWxzZSxcbiBcdFx0XHRcdGVudW1lcmFibGU6IHRydWUsXG4gXHRcdFx0XHRnZXQ6IGdldHRlclxuIFx0XHRcdH0pO1xuIFx0XHR9XG4gXHR9O1xuXG4gXHQvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5uID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gXHRcdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuIFx0XHRcdGZ1bmN0aW9uIGdldERlZmF1bHQoKSB7IHJldHVybiBtb2R1bGVbJ2RlZmF1bHQnXTsgfSA6XG4gXHRcdFx0ZnVuY3Rpb24gZ2V0TW9kdWxlRXhwb3J0cygpIHsgcmV0dXJuIG1vZHVsZTsgfTtcbiBcdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgJ2EnLCBnZXR0ZXIpO1xuIFx0XHRyZXR1cm4gZ2V0dGVyO1xuIFx0fTtcblxuIFx0Ly8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7IHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSk7IH07XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG4gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbiBcdHJldHVybiBfX3dlYnBhY2tfcmVxdWlyZV9fKF9fd2VicGFja19yZXF1aXJlX18ucyA9IDApO1xuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIHdlYnBhY2svYm9vdHN0cmFwIGNmZDJmNmE4YjBlOWQzYWNhM2VhIiwiaW1wb3J0IERDbGllbnQgZnJvbSAnLi9saWInO1xuXG5jb25zdCBjbGllbnQgPSBuZXcgRENsaWVudCgnaHR0cDovL2pzb25hcGkudGVzdDo4MDgwJywgY29uc29sZSk7XG5cbmNvbnN0IGxvZ2dlciA9IChsYWJlbCkgPT4ge1xuICByZXR1cm4gcmVzb3VyY2UgPT4gY29uc29sZS5sb2coYCR7bGFiZWx9OmAsIHJlc291cmNlLmF0dHJpYnV0ZXMudGl0bGUpO1xufTtcblxuY2xpZW50LmFsbCgnbm9kZS0tcmVjaXBlJywgeyBtYXg6IDMsIHNvcnQ6ICd0aXRsZScgfSlcbiAgLnRoZW4oY3Vyc29yID0+IHtcbiAgICByZXR1cm4gY3Vyc29yXG4gICAgICAuZm9yRWFjaChsb2dnZXIoJ0luaXRpYWwnKSlcbiAgICAgIC50aGVuKG1vcmUgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhgVGhlcmUgYXJlICR7bW9yZSA/ICdtb3JlJyA6ICdubyBtb3JlJ30gcmVzb3VyY2VzIWApO1xuICAgICAgICBtb3JlKDEwKTtcbiAgICAgICAgY3Vyc29yLmZvckVhY2gobG9nZ2VyKCdBZGRpdGlvbmFsJykpXG4gICAgICAgICAgLnRoZW4oZXZlbk1vcmUgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFRoZXJlIGFyZSAke2V2ZW5Nb3JlID8gJ21vcmUnIDogJ25vIG1vcmUnfSByZXNvdXJjZXMhYCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfSlcbiAgLmNhdGNoKGVycm9yID0+IGNvbnNvbGUubG9nKCdFcnJvcjonLCBlcnJvcikpO1xuXG4vL2NsaWVudC5nZXQoJ25vZGUtLXJlY2lwZScsICcyNWMwNDhiNi02OWU5LTQ2ZjQtOTg2ZC00YjgwYjAxZGUyZTYnKVxuLy8gIC50aGVuKHJlc291cmNlID0+IGNvbnNvbGUubG9nKCdJbmRpdmlkdWFsOicsIHJlc291cmNlKSlcbi8vICAuY2F0Y2goZXJyb3IgPT4gY29uc29sZS5sb2coJ0Vycm9yOicsIGVycm9yKSk7XG5cblxuXG4vLyBXRUJQQUNLIEZPT1RFUiAvL1xuLy8gLi9zcmMvaW5kZXguanMiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBEcnVwYWxDbGllbnQge1xuXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmwsIGxvZ2dlcikge1xuICAgIHRoaXMuYmFzZVVybCA9IGJhc2VVcmw7XG4gICAgdGhpcy5sb2dnZXIgPSBsb2dnZXI7XG4gICAgdGhpcy5saW5rcyA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuZmV0Y2hEb2N1bWVudChgJHtiYXNlVXJsfS9qc29uYXBpYClcbiAgICAgICAgLnRoZW4oZG9jID0+IHJlc29sdmUoZG9jLmxpbmtzIHx8IHt9KSlcbiAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgdGhpcy5sb2dnZXIubG9nKCdVbmFibGUgdG8gcmVzb2x2ZSByZXNvdXJjZSBsaW5rcy4nKTtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBnZXQodHlwZSwgaWQpIHtcbiAgICByZXR1cm4gdGhpcy53aXRoTGluayh0eXBlKVxuICAgICAgLnRoZW4obGluayA9PiB0aGlzLmZldGNoRG9jdW1lbnQoYCR7bGlua30vJHtpZH1gKSlcbiAgICAgIC50aGVuKGRvYyA9PiB0aGlzLmRvY3VtZW50RGF0YShkb2MpKVxuICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmxvZyhlcnIpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0pO1xuICB9XG5cbiAgYWxsKHR5cGUsIHsgbWF4ID0gLTEsIHNvcnQgPSAnJywgZmlsdGVyID0gJ3BhZ2VbbGltaXRdPTInIH0gPSB7fSkge1xuICAgIHJldHVybiB0aGlzLndpdGhMaW5rKHR5cGUpLnRoZW4oYmFzZUxpbmsgPT4ge1xuICAgICAgdmFyIGxpbmsgPSBgJHtiYXNlTGlua30/JHtmaWx0ZXJ9YDtcbiAgICAgIGlmIChzb3J0Lmxlbmd0aCkge1xuICAgICAgICBsaW5rICs9IGAmc29ydD0ke3NvcnR9YDtcbiAgICAgIH1cbiAgICAgIHZhciBjb2xsZWN0aW9uUmVxdWVzdHMgPSBbXTtcbiAgICAgIHZhciBjb2xsZWN0aW9uID0gW107XG4gICAgICBjb25zdCBpbkZsaWdodCA9IG5ldyBTZXQoW10pO1xuICAgICAgY29uc3QgZG9SZXF1ZXN0ID0gbmV4dExpbmsgPT4ge1xuICAgICAgICBpbkZsaWdodC5hZGQobmV4dExpbmspO1xuICAgICAgICByZXR1cm4gdGhpcy5mZXRjaERvY3VtZW50KG5leHRMaW5rKS50aGVuKGRvYyA9PiB7XG4gICAgICAgICAgaW5GbGlnaHQuZGVsZXRlKG5leHRMaW5rKTtcbiAgICAgICAgICBsaW5rID0gZG9jLmxpbmtzLm5leHQgfHwgZmFsc2U7XG4gICAgICAgICAgY29sbGVjdGlvbi5wdXNoKC4uLih0aGlzLmRvY3VtZW50RGF0YShkb2MpIHx8IFtdKSk7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShjb2xsZWN0aW9uKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgY29uc3QgYWR2YW5jZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKGxpbmsgJiYgIWluRmxpZ2h0LmhhcyhsaW5rKSkge1xuICAgICAgICAgIGNvbGxlY3Rpb25SZXF1ZXN0cy5wdXNoKGRvUmVxdWVzdChsaW5rKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFjb2xsZWN0aW9uLmxlbmd0aCAmJiBjb2xsZWN0aW9uUmVxdWVzdHMubGVuZ3RoKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb25SZXF1ZXN0cy5zaGlmdCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoY29sbGVjdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICBjb25zdCBjdXJzb3IgPSAoZnVuY3Rpb24qKCkge1xuICAgICAgICB3aGlsZSAoY29sbGVjdGlvbi5sZW5ndGggfHwgaW5GbGlnaHQuc2l6ZSB8fCBsaW5rKSB7XG4gICAgICAgICAgeWllbGQgYWR2YW5jZSgpLnRoZW4odmlldyA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZSA9IHZpZXcuc2hpZnQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZSB8fCBudWxsO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmb3JFYWNoOiBmdW5jdGlvbiAoZykge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmID0gKG5leHQpID0+IHtcbiAgICAgICAgICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgICAgICAgICBuZXh0LnRoZW4ocmVzb3VyY2UgPT4ge1xuICAgICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZSkgZyhyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgICBmKChtYXggPT09IC0xIHx8IGNvdW50IDwgbWF4KSA/IGN1cnNvci5uZXh0KCkudmFsdWUgOiBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhZGRNb3JlID0gKG1hbnkgPSAtMSkgPT4ge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIChtYW55ID09PSAtMSlcbiAgICAgICAgICAgICAgICAgICAgPyAobWF4ID0gLTEpXG4gICAgICAgICAgICAgICAgICAgIDogKG1heCArPSBtYW55KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKGNvbGxlY3Rpb24ubGVuZ3RoIHx8IGluRmxpZ2h0LnNpemUgfHwgbGluaykgPyBhZGRNb3JlIDogZmFsc2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZigobWF4ID09PSAtMSB8fCBjb3VudCA8IG1heCkgPyBjdXJzb3IubmV4dCgpLnZhbHVlIDogZmFsc2UpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZldGNoRG9jdW1lbnQodXJsKSB7XG4gICAgcmV0dXJuIGZldGNoKHVybCkudGhlbihcbiAgICAgIHJlcyA9PiAocmVzLm9rID8gcmVzLmpzb24oKSA6IFByb21pc2UucmVqZWN0KHJlcy5zdGF0dXNUZXh0KSksXG4gICAgKTtcbiAgfVxuXG4gIGRvY3VtZW50RGF0YShkb2MpIHtcbiAgICBpZiAoZG9jLmhhc093blByb3BlcnR5KCdkYXRhJykpIHtcbiAgICAgIHJldHVybiBkb2MuZGF0YTtcbiAgICB9XG4gICAgaWYgKGRvYy5oYXNPd25Qcm9wZXJ0eSgnZXJyb3JzJykpIHtcbiAgICAgIGRvYy5lcnJvcnMuZm9yRWFjaCh0aGlzLmxvZ2dlci5sb2cpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubG9nZ2VyLmxvZyhcbiAgICAgICAgJ1RoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5wcm9jZXNzYWJsZSBkb2N1bWVudCB3aXRoIG5vIGRhdGEgb3IgZXJyb3JzLicsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHdpdGhMaW5rKHR5cGUpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5saW5rc1xuICAgICAgICAudGhlbihsaW5rcyA9PiB7XG4gICAgICAgICAgaWYgKCFsaW5rcy5oYXNPd25Qcm9wZXJ0eSh0eXBlKSkge1xuICAgICAgICAgICAgcmVqZWN0KGAnJHt0eXBlfScgaXMgbm90IGEgdmFsaWQgVVJMIGZvciAke3RoaXMuYmFzZVVybH0uYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlc29sdmUobGlua3NbdHlwZV0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICB9KTtcbiAgfVxufVxuXG5cblxuLy8gV0VCUEFDSyBGT09URVIgLy9cbi8vIC4vc3JjL2xpYi9pbmRleC5qcyJdLCJzb3VyY2VSb290IjoiIn0=