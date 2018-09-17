import {
  ClientOption,
  ClientOptions,
  Opt,
} from './ClientOptions';

import {
  Operation,
  OperationManager,
  OperationType,
  Operations,
  Operator,
  RouteType,
} from './Operations';

import {
  Result,
  Resource,
} from './Result';

import { Follow } from './operations/Follow';

import getDefaultProviders from './operations/DefaultProviders';

type RequestOption = {};

export default class Client {

  protected initialized: Promise<boolean>;

  protected settings: ClientOptions = new ClientOptions();

  protected operationManager: OperationManager = new OperationManager(this.getOperator(), []);

  constructor(...opts: ClientOption[]) {
    this.initialized = new Promise(async (resolve, reject) => {
      this.settings = await this.getOptions(opts);
      this.operationManager = new OperationManager(this.getOperator(), this.settings.operationProviders);
      resolve(true);
    });
  }

  public async ready(): Promise<boolean> {
    return await this.initialized;
  }

  public async load(resourceType: string, id: string, ...opts: RequestOption[]): Promise<Resource> {
    await this.ready();
    let result = await this.do(new Follow(this.getResourceUrl(resourceType, id), RouteType.Individual, null))
    return result.getData() as Resource;
  }

  protected do(op: Operation): Promise<Result> {
    const init : any = {method: op.getMethod()};
    if (op.getOperationType() !== OperationType.Get) {
      init.body = JSON.stringify(op.getData());
    }
    return fetch(op.getUrl(), init)
    .then(res => res.json())
    .then(raw => new Result(raw, this.operationManager));
  }

  protected getResourceUrl(resourceType: string, id: string): string {
    return (this.settings.urls[resourceType] as string) + `/${id}`;
  }

  protected getOperator(): Operator {
    return (op: Operation) => {
      return this.do(op);
    };
  }

  protected async getOptions(applicators: ClientOption[]): Promise<ClientOptions> {
    for (const provider of getDefaultProviders()) {
      applicators.push(Opt.addOperationProvider(provider));
    }
    let settings = new ClientOptions();
    for (let applyOption of applicators) {
      settings = applyOption(settings);
    }
    if (!settings.entryPoint) {
      throw new Error('An entrypoint URL must be provided');
    }
    if (!settings.urls) {
      await this.discoverUrls();
    }
    return settings;
  }

  protected async discoverUrls(): Promise<{[index:string]: string}> {
    let result = await this.do(new Follow((this.settings.entryPoint as string), RouteType.Unknown, null))
    let operations = result.getOperations();
    return operations.available().reduce((urls: {[index:string]: string}, operationName: string) => {
      urls[operationName] = (operations.getByName(operationName).pop() as Operation).getUrl();
      return urls;
    }, {});
  }

}
