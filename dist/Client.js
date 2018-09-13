(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./ClientOptions", "./Operations"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ClientOptions_1 = require("./ClientOptions");
    const Operations_1 = require("./Operations");
    class Client {
        constructor(...opts) {
            this.options = new ClientOptions_1.ClientOptions();
            for (let opt of opts) {
                this.options = opt(this.options);
            }
        }
        do(op) {
            const init = { method: op.method() };
            if (op.operationType() !== Operations_1.OperationType.Get) {
                init.body = JSON.stringify(op.data());
            }
            return fetch(op.url(), init)
                .then(res => res.json())
                .then(raw => new Result(raw, new Operations_1.OperationManager()));
        }
    }
    exports.Client = Client;
    class Result {
        constructor(raw, operationManager) {
            this.raw = raw;
            this.data = this.isSuccessful() ? raw.data : null;
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
    }
    exports.Result = Result;
});
//# sourceMappingURL=Client.js.map