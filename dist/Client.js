var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./ClientOptions", "./Operations", "./Result", "./operations/Follow", "./operations/DefaultProviders"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ClientOptions_1 = require("./ClientOptions");
    const Operations_1 = require("./Operations");
    const Result_1 = require("./Result");
    const Follow_1 = require("./operations/Follow");
    const DefaultProviders_1 = __importDefault(require("./operations/DefaultProviders"));
    class Client {
        constructor(...opts) {
            this.settings = new ClientOptions_1.ClientOptions();
            this.operationManager = new Operations_1.OperationManager(this.getOperator(), []);
            this.initialized = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this.settings = yield this.getOptions(opts);
                this.operationManager = new Operations_1.OperationManager(this.getOperator(), this.settings.operationProviders);
                resolve(true);
            }));
        }
        ready() {
            return __awaiter(this, void 0, void 0, function* () {
                return yield this.initialized;
            });
        }
        load(resourceType, id, ...opts) {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.ready();
                let result = yield this.do(new Follow_1.Follow(this.getResourceUrl(resourceType, id), Operations_1.RouteType.Individual, null));
                return result.getData();
            });
        }
        do(op) {
            const init = { method: op.getMethod() };
            if (op.getOperationType() !== Operations_1.OperationType.Get) {
                init.body = JSON.stringify(op.getData());
            }
            return fetch(op.getUrl(), init)
                .then(res => res.json())
                .then(raw => new Result_1.Result(raw, this.operationManager));
        }
        getResourceUrl(resourceType, id) {
            return this.settings.urls[resourceType] + `/${id}`;
        }
        getOperator() {
            return (op) => {
                return this.do(op);
            };
        }
        getOptions(applicators) {
            return __awaiter(this, void 0, void 0, function* () {
                for (const provider of DefaultProviders_1.default()) {
                    applicators.push(ClientOptions_1.Opt.addOperationProvider(provider));
                }
                let settings = new ClientOptions_1.ClientOptions();
                for (let applyOption of applicators) {
                    settings = applyOption(settings);
                }
                if (!settings.entryPoint) {
                    throw new Error('An entrypoint URL must be provided');
                }
                if (!settings.urls) {
                    yield this.discoverUrls();
                }
                return settings;
            });
        }
        discoverUrls() {
            return __awaiter(this, void 0, void 0, function* () {
                let result = yield this.do(new Follow_1.Follow(this.settings.entryPoint, Operations_1.RouteType.Unknown, null));
                let operations = result.getOperations();
                return operations.available().reduce((urls, operationName) => {
                    urls[operationName] = operations.getByName(operationName).pop().getUrl();
                    return urls;
                }, {});
            });
        }
    }
    exports.default = Client;
});
//# sourceMappingURL=Client.js.map