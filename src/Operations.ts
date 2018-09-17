import { 
  DataDocument,
  ErrorDocument,
  ResourceObject,
  RelationshipObject,
  ErrorObject,
  LinksObject,
  LinkObject,
  MetaObject,
} from './JsonApiObjects';

import {
  Result,
} from './Result';

type NamedOperation = [string, Operation];

type NamedExecutable = [string, ExecutableOperation];

export type ContextObject = DataDocument|ErrorDocument|ResourceObject|RelationshipObject|ErrorObject;

export interface Operator {

  (op: Operation): Promise<Result>;

}

export class OperationManager {

  protected providers: OperationProvider[];

  protected operator: Operator;

  constructor(operator: Operator, providers: OperationProvider[]) {
    this.operator = operator;
    this.providers = providers;
  }

  parse(contextType: ContextObjectType, contextObject: ContextObject, links: LinksObject, doc: DataDocument|ErrorDocument): Operations {
    let ops: NamedOperation[] = [];
    for (const name in links) {
      if (links.hasOwnProperty(name)) {
        const link: string|LinkObject = links[name];
        ops = this.providers.reduce((ops: NamedOperation[], provider: OperationProvider) => {
          const operation = provider.parse(contextType, contextObject, link, doc);
          if (operation !== null) {
            let named: NamedOperation = [name.split(':')[0], operation];
            ops.push(named);
          }
          return ops;
        }, ops);
      }
    }
    return new Operations(ops.map((operation: NamedOperation) => {
      const executable: NamedExecutable = [operation[0], new ExecutableOperation(this.operator, operation[1])];
      return executable;
    }));
  }

}

export interface OperationProvider {

  parse(contextType: ContextObjectType, contextObject: ContextObject, link: string|LinkObject, doc: DataDocument|ErrorDocument): Operation|null;

}

export enum ContextObjectType {
  Document = 0,
  Resource,
  Relationship,
  Error,
}

export class Operations {

  protected operations: NamedExecutable[];

  constructor(ops: NamedExecutable[]) {
    this.operations = ops;
  }

  getByName(name: string): ExecutableOperation[] {
    return this.operations.filter(named => name === named[0]).map(named => named[1]);
  }

  has(name: string): boolean {
    return this.operations.reduce((has, op) => {
      return has || op[0] === name;
    }, false);
  }

  available(): string[] {
    return Array.from(this.operations
      .reduce((available, named) => available.add(named[0]), new Set())
      .values());
  }

}

export class ExecutableOperation implements Operation {

  protected operator: Operator;
   
  protected innerOperation: Operation;

  constructor(operator: Operator, operation: Operation) {
    this.operator = operator;
    this.innerOperation = operation;
  }

  do(): Promise<Result> {
    return this.operator(this.innerOperation);
  }

  getUrl(): string {
    return this.innerOperation.getUrl();
  }

  getMethod(): Method {
    return this.innerOperation.getMethod();
  }

  getOperationType(): OperationType {
    return this.innerOperation.getOperationType();
  }

  getAttributes(): MetaObject|null {
    return this.innerOperation.getAttributes();
  }

  getRouteType(): RouteType {
    return this.innerOperation.getRouteType();
  }

  getData(): object|null {
    return this.innerOperation.getData();
  }

  withData(data: object): Operation {
    return new ExecutableOperation(this.operator, this.innerOperation.withData(data));
  }

  needsData(): boolean {
    return this.innerOperation.needsData();
  }

}

export interface Operation {

  getUrl(): string;

  getMethod(): Method;

  getOperationType(): OperationType;

  getAttributes(): MetaObject|null;

  getRouteType(): RouteType;

  getData(): object|null;

  withData(data: object): Operation;

  needsData(): boolean;

}

export enum Method {
  Get = "GET",
  Post = "POST",
  Patch = "PATCH",
  Delete = "DELETE",
}

export enum OperationType { 
  Get = 0,
  Add,
  Update,
  Remove,
}

export enum RouteType {
  Unknown = 0,
  Individual,
  Collection,
}
