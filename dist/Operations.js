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
    class OperationManager {
        parse(contextType, contextObject, links, doc) {
            return new Operations([]);
        }
    }
    exports.OperationManager = OperationManager;
    var ContextObjectType;
    (function (ContextObjectType) {
        ContextObjectType[ContextObjectType["Document"] = 0] = "Document";
        ContextObjectType[ContextObjectType["Resource"] = 1] = "Resource";
        ContextObjectType[ContextObjectType["Relationship"] = 2] = "Relationship";
        ContextObjectType[ContextObjectType["Error"] = 3] = "Error";
    })(ContextObjectType = exports.ContextObjectType || (exports.ContextObjectType = {}));
    class Operations {
        constructor(ops) {
            this.operations = ops;
        }
        has(name) {
            return this.operations.reduce((has, op) => {
                return has || op[0] === name;
            }, false);
        }
    }
    exports.Operations = Operations;
    var Method;
    (function (Method) {
        Method["Get"] = "GET";
        Method["Post"] = "POST";
        Method["Patch"] = "PATCH";
        Method["Delete"] = "DELETE";
    })(Method = exports.Method || (exports.Method = {}));
    var OperationType;
    (function (OperationType) {
        OperationType[OperationType["Get"] = 0] = "Get";
        OperationType[OperationType["Add"] = 1] = "Add";
        OperationType[OperationType["Update"] = 2] = "Update";
        OperationType[OperationType["Remove"] = 3] = "Remove";
    })(OperationType = exports.OperationType || (exports.OperationType = {}));
    var RouteType;
    (function (RouteType) {
        RouteType[RouteType["Individual"] = 0] = "Individual";
        RouteType[RouteType["Related"] = 1] = "Related";
        RouteType[RouteType["Relationship"] = 2] = "Relationship";
        RouteType[RouteType["Collection"] = 3] = "Collection";
    })(RouteType = exports.RouteType || (exports.RouteType = {}));
});
//# sourceMappingURL=Operations.js.map