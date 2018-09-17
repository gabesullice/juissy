(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../Operations"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Operations_1 = require("../Operations");
    function isLinkObject(obj) {
        return typeof obj !== "string";
    }
    class FollowProvider {
        parse(contextType, contextObject, link, doc) {
            const href = isLinkObject(link) ? link['href'] : link;
            const attr = isLinkObject(link)
                ? link.hasOwnProperty('meta') ? link['meta'] : null
                : null;
            const routeType = contextObject.hasOwnProperty('data')
                ? (Array.isArray(contextObject['data']) ? Operations_1.RouteType.Collection : Operations_1.RouteType.Individual)
                : Operations_1.RouteType.Unknown;
            return !(isLinkObject(link) && attr && attr.rels)
                ? new Follow(href, routeType, attr)
                : null;
        }
    }
    exports.FollowProvider = FollowProvider;
    class Follow {
        constructor(url, routeType, attrs) {
            this.url = url;
            this.routeType = routeType;
            this.attrs = attrs;
        }
        getUrl() {
            return this.url;
        }
        getMethod() {
            return Operations_1.Method.Get;
        }
        getOperationType() {
            return Operations_1.OperationType.Get;
        }
        getAttributes() {
            return this.attrs;
        }
        getRouteType() {
            return this.routeType;
        }
        getData() {
            return null;
        }
        withData(data) {
            return this;
        }
        needsData() {
            return false;
        }
    }
    exports.Follow = Follow;
});
//# sourceMappingURL=Follow.js.map