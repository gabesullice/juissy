export type ToOneData = ResourceObject|ResourceIdentifierObject|null;

export type ToManyData = (ResourceObject|ResourceIdentifierObject)[];

export interface DataDocument extends MetaDataObject, LinkedObject {
  data: ToOneData|ToManyData;
  included?: ResourceObject[];
}

export interface ErrorDocument extends LinkedObject {
  errors: ErrorObject[];
}

type toOneRelationship = ResourceIdentifierObject|null;

type toManyRelationship = ResourceIdentifierObject[];

export interface ResourceIdentifierObject extends MetaDataObject {
  type: string;
  id: string;
}

export interface ResourceObject extends ResourceIdentifierObject, MetaDataObject, LinkedObject {
  attributes?: {[index:string]: any};
  relationships?: {[index:string]: RelationshipObject};
}

export interface RelationshipObject extends MetaDataObject, LinkedObject {
  data: toOneRelationship|toManyRelationship;
}

export interface ErrorObject extends LinkedObject, MetaDataObject {
  id?: string;
  about?: string|LinkObject;
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  source?: {
    pointer?: string
    parameter?: string;
  };
}

export interface MetaDataObject {
  meta?: MetaObject;
}

export interface MetaObject {
  [index:string]: any;
}

export interface LinkedObject {
  links?: LinksObject,
}

export interface LinksObject {
  [index:string]: string|LinkObject;
}

export interface LinkObject extends MetaDataObject {
  href: string;
}
