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
        constructor(operator, providers) {
            this.operator = operator;
            this.providers = providers;
        }
        parse(contextType, contextObject, links, doc) {
            let ops = [];
            for (const name in links) {
                if (links.hasOwnProperty(name)) {
                    const link = links[name];
                    ops = this.providers.reduce((ops, provider) => {
                        const operation = provider.parse(contextType, contextObject, link, doc);
                        if (operation !== null) {
                            let named = [name.split(':')[0], operation];
                            ops.push(named);
                        }
                        return ops;
                    }, ops);
                }
            }
            return new Operations(ops.map((operation) => {
                const executable = [operation[0], new ExecutableOperation(this.operator, operation[1])];
                return executable;
            }));
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
        getByName(name) {
            return this.operations.filter(named => name === named[0]).map(named => named[1]);
        }
        has(name) {
            return this.operations.reduce((has, op) => {
                return has || op[0] === name;
            }, false);
        }
        available() {
            return Array.from(this.operations
                .reduce((available, named) => available.add(named[0]), new Set())
                .values());
        }
    }
    exports.Operations = Operations;
    class ExecutableOperation {
        constructor(operator, operation) {
            this.operator = operator;
            this.innerOperation = operation;
        }
        do() {
            return this.operator(this.innerOperation);
        }
        getUrl() {
            return this.innerOperation.getUrl();
        }
        getMethod() {
            return this.innerOperation.getMethod();
        }
        getOperationType() {
            return this.innerOperation.getOperationType();
        }
        getAttributes() {
            return this.innerOperation.getAttributes();
        }
        getRouteType() {
            return this.innerOperation.getRouteType();
        }
        getData() {
            return this.innerOperation.getData();
        }
        withData(data) {
            return new ExecutableOperation(this.operator, this.innerOperation.withData(data));
        }
        needsData() {
            return this.innerOperation.needsData();
        }
    }
    exports.ExecutableOperation = ExecutableOperation;
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
        RouteType[RouteType["Unknown"] = 0] = "Unknown";
        RouteType[RouteType["Individual"] = 1] = "Individual";
        RouteType[RouteType["Collection"] = 2] = "Collection";
    })(RouteType = exports.RouteType || (exports.RouteType = {}));
});
//# sourceMappingURL=Operations.js.map