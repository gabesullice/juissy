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
        entryPoint(url) {
            return function (opts) {
                opts.entryPoint = url;
                return opts;
            };
        }
    }
    exports.Opt = Opt;
    class ClientOptions {
        constructor() {
            this.entryPoint = null;
        }
    }
    exports.ClientOptions = ClientOptions;
});
//# sourceMappingURL=ClientOptions.js.map