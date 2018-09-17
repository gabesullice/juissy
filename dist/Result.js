(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./Operations"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Operations_1 = require("./Operations");
    class Result {
        constructor(raw, operationManager) {
            this.raw = raw;
            this.data = this.isSuccessful() ? this.extractData(raw, operationManager) : null;
            this.errors = this.isFailure() ? raw.errors : null;
            this.operations = operationManager.parse(Operations_1.ContextObjectType.Document, raw, raw.links || {}, raw);
        }
        isSuccessful() {
            return this.raw.hasOwnProperty('data');
        }
        isFailure() {
            return this.raw.hasOwnProperty('errors');
        }
        getData() {
            return this.data;
        }
        getErrors() {
            return this.errors;
        }
        getOperations() {
            return this.operations;
        }
        extractData(doc, operationManager) {
            if (doc.data === null) {
                return null;
            }
            else if (Array.isArray(doc.data)) {
                return doc.data.map(obj => this.toResource(obj, doc, operationManager));
            }
            return this.toResource(doc.data, doc, operationManager);
        }
        toResource(obj, doc, operationManager) {
            const operations = obj.hasOwnProperty('links')
                ? operationManager.parse(Operations_1.ContextObjectType.Resource, obj, obj.links, doc)
                : new Operations_1.Operations([]);
            return new Resource(obj, operations);
        }
    }
    exports.Result = Result;
    class Resource {
        constructor(resource, operations) {
            this.obj = resource;
            this.operations = operations;
        }
        getObject() {
            return this.obj;
        }
        getOperations() {
            return this.operations;
        }
    }
    exports.Resource = Resource;
});
//# sourceMappingURL=Result.js.map