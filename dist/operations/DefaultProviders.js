(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./Follow"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Follow_1 = require("./Follow");
    function getDefaultProviders() {
        return [
            new Follow_1.FollowProvider(),
        ];
    }
    exports.default = getDefaultProviders;
});
//# sourceMappingURL=DefaultProviders.js.map