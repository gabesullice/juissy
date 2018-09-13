(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Document {
        constructor(raw, operationsManager) {
            this.raw = raw;
            this.data = this.isSuccessful() ? this.raw.data : null;
            this.errors = this.isFailure() ? this.raw.errors : null;
            const links = raw.hasOwnProperty('links')
                ? raw.links
                : null;
            this.operations = operationsManager.parse(links, raw);
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
    }
    exports.Document = Document;
});
//# sourceMappingURL=JsonApiObject.js.map