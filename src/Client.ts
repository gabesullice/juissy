import { ClientOptions, ClientOption } from './ClientOptions';
import {
  ContextObjectType,
  OperationManager,
  Operations,
  Operation,
  OperationType
} from './Operations';
import {
  DataDocument,
  ErrorDocument,
  ToOneData,
  ToManyData,
  ErrorObject,
  LinksObject,
} from './JsonApiObjects';

export class Client {

  protected options: ClientOptions;

  constructor(...opts: ClientOption[]) {
    this.options = new ClientOptions();
    for (let opt of opts) {
      this.options = opt(this.options);
    }
  }

  do(op: Operation): Promise<Result> {
    const init : any = {method: op.method()};
    if (op.operationType() !== OperationType.Get) {
      init.body = JSON.stringify(op.data());
    }
    return fetch(op.url(), init)
    .then(res => res.json())
    .then(raw => new Result(raw, new OperationManager()));
  }

}

export class Result {

  protected raw: DataDocument|ErrorDocument;
  protected data: ToOneData|ToManyData;
  protected errors: ErrorObject[]|null;
  protected operations: Operations;

  constructor (raw: DataDocument|ErrorDocument, operationManager: OperationManager) {
    this.raw = raw;
    this.data = this.isSuccessful() ? (raw as DataDocument).data : null;
    this.errors = this.isFailure() ? (raw as ErrorDocument).errors : null;
    this.operations = operationManager.parse(ContextObjectType.Document, raw, raw.links || {}, raw)
  }

  isSuccessful(): boolean {
    return this.raw.hasOwnProperty('data');
  }

  isFailure(): boolean {
    return this.raw.hasOwnProperty('errors');
  }

  getData(): ToOneData|ToManyData {
    return this.data;
  }

  getErrors(): ErrorObject[]|null {
    return this.errors;
  }

  getOperations(): Operations {
    return this.operations;
  }

}

