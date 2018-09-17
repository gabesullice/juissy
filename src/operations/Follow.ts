import {
  ContextObject,
  ContextObjectType,
  Method,
  Operation,
  OperationProvider,
  OperationType,
  RouteType,
} from '../Operations';

import {
  DataDocument,
  ErrorDocument,
  LinkObject,
  MetaDataObject,
  MetaObject,
  RelationshipObject,
} from '../JsonApiObjects';

function isLinkObject(obj: Object): boolean {
  return typeof obj !== "string";
}

export class FollowProvider implements OperationProvider {

  parse(contextType: ContextObjectType, contextObject: ContextObject, link: string|LinkObject, doc: DataDocument|ErrorDocument): Operation|null {
    const href: string = isLinkObject(link) ? (link as LinkObject)['href'] : link as string;
    const attr: MetaObject|null = isLinkObject(link)
      ? link.hasOwnProperty('meta') ? ((link as LinkObject)['meta'] as MetaObject) : null
      : null;
    const routeType: RouteType = contextObject.hasOwnProperty('data')
      ? (Array.isArray((contextObject as DataDocument|RelationshipObject)['data']) ? RouteType.Collection : RouteType.Individual)
      : RouteType.Unknown;
    return !(isLinkObject(link) && attr && attr.rels)
      ? new Follow(href, routeType, attr)
      : null;
  }

}

export class Follow implements Operation {

  protected url: string;

  protected attrs: MetaObject|null;

  protected routeType: RouteType;
  
  constructor(url: string, routeType: RouteType, attrs: MetaObject|null) {
    this.url = url;
    this.routeType = routeType;
    this.attrs = attrs;
  }

  getUrl(): string {
    return this.url;
  }

  getMethod(): Method {
    return Method.Get;
  }

  getOperationType(): OperationType {
    return OperationType.Get;
  }

  getAttributes(): MetaObject|null {
    return this.attrs;
  }

  getRouteType(): RouteType {
    return this.routeType;
  }

  getData(): null {
    return null;
  }

  withData(data: object): Operation {
    return this;
  }

  needsData(): boolean {
    return false;
  }

}
