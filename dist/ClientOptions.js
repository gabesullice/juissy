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
    class Opt {
        static entryPoint(url) {
            return function (opts) {
                opts.entryPoint = url;
                return opts;
            };
        }
        static addOperationProvider(provider) {
            return function (opts) {
                opts.operationProviders.push(provider);
                return opts;
            };
        }
    }
    exports.Opt = Opt;
    class ClientOptions {
        constructor() {
            this.entryPoint = null;
            this.operationProviders = [];
            this.urls = {};
        }
    }
    exports.ClientOptions = ClientOptions;
});
//# sourceMappingURL=ClientOptions.js.map