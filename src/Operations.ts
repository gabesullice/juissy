import { 
  DataDocument,
  ErrorDocument,
  ResourceObject,
  RelationshipObject,
  ErrorObject,
  LinksObject,
} from './JsonApiObjects';

export type NamedOperation = [string, Operation];

type ContextObject = DataDocument|ErrorDocument|ResourceObject|RelationshipObject|ErrorObject|null;

export class OperationManager {

  parse(contextType: ContextObjectType, contextObject: ContextObject, links: LinksObject, doc: DataDocument|ErrorDocument): Operations {
    return new Operations([]);
  }

}

export enum ContextObjectType {
  Document = 0,
  Resource,
  Relationship,
  Error,
}

export class Operations {

  protected operations: NamedOperation[];

  constructor(ops: NamedOperation[]) {
    this.operations = ops;
  }

  has(name: string): boolean {
    return this.operations.reduce((has, op) => {
      return has || op[0] === name;
    }, false);
  }

}

export interface Operation {

  url(): string;

  method(): Method;

  operationType(): OperationType;

  routeType(): RouteType;

  data(): object|null;

}

export enum Method {
  Get = "GET",
  Post = "POST",
  Patch = "PATCH",
  Delete = "DELETE",
}

export enum OperationType { 
  Get = 0,
  Add = 1,
  Update = 2,
  Remove = 3,
}

export enum RouteType {
  Individual = 0,
  Related = 1,
  Relationship = 2,
  Collection = 3,
}
