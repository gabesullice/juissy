import {
  DataDocument,
  ErrorDocument,
  ErrorObject,
  LinksObject,
  ResourceObject,
  ResourceIdentifierObject,
} from './JsonApiObjects';

import {
  ContextObjectType,
  OperationManager,
  Operations,
} from './Operations';

export class Result {

  protected raw: DataDocument|ErrorDocument;
  protected data: Resource|Resource[]|null;
  protected errors: ErrorObject[]|null;
  protected operations: Operations;

  constructor (raw: DataDocument|ErrorDocument, operationManager: OperationManager) {
    this.raw = raw;
    this.data = this.isSuccessful() ? this.extractData(raw as DataDocument, operationManager) : null;
    this.errors = this.isFailure() ? (raw as ErrorDocument).errors : null;
    this.operations = operationManager.parse(ContextObjectType.Document, raw, raw.links || {}, raw)
  }

  isSuccessful(): boolean {
    return this.raw.hasOwnProperty('data');
  }

  isFailure(): boolean {
    return this.raw.hasOwnProperty('errors');
  }

  getData(): Resource|Resource[]|null {
    return this.data;
  }

  getErrors(): ErrorObject[]|null {
    return this.errors;
  }

  getOperations(): Operations {
    return this.operations;
  }

  protected extractData(doc: DataDocument, operationManager: OperationManager): Resource|Resource[]|null {
    if (doc.data === null) {
      return null;
    }
    else if (Array.isArray(doc.data)) {
      return doc.data.map(obj => Result.toResource(obj, doc, operationManager))
    }
    return Result.toResource(doc.data, doc, operationManager);
  }

  protected static toResource(obj: ResourceObject, doc: DataDocument, operationManager: OperationManager): Resource {
    const operations: Operations = obj.hasOwnProperty('links')
      ? operationManager.parse(ContextObjectType.Resource, obj, (obj.links as LinksObject), doc)
      : new Operations([]);
    return new Resource(obj, operations);
  }

}

export class Resource {

  protected obj: ResourceObject|ResourceIdentifierObject;
  
  protected operations: Operations;

  constructor(resource: ResourceObject|ResourceIdentifierObject, operations: Operations) {
    this.obj = resource;
    this.operations = operations;
  }

  getObject(): ResourceObject {
    return this.obj;
  }

  getOperations(): Operations {
    return this.operations;
  }

}
