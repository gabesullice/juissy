(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./ClientOptions", "./Operations", "./JsonApi"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ClientOptions_1 = require("./ClientOptions");
    const Operations_1 = require("./Operations");
    const JsonApi_1 = require("./JsonApi");
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
            const request = fetch(op.url(), init);
            return new Promise((resolve, reject) => {
                request.then(res => {
                    res.json().then(doc => resolve(new JsonApi_1.Document(doc)));
                }).catch(reject);
            });
        }
    }
    exports.Client = Client;
});
//# sourceMappingURL=Client.js.map