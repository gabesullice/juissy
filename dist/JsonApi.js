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
    class Document {
        constructor(raw) {
            this.raw = raw;
            this.operations = new Operations_1.Operations([]);
        }
        getOperations() {
            return this.operations;
        }
        isSuccessful() {
            return this.raw.hasOwnProperty('data');
        }
        isFailure() {
            return this.raw.hasOwnProperty('errors');
        }
    }
    exports.Document = Document;
});
//# sourceMappingURL=JsonApi.js.map