import {
  OperationProvider,
} from './Operations';

export type ClientOption = (opts: ClientOptions) => ClientOptions;

export class Opt {

  static entryPoint(url: string): ClientOption {
    return function (opts: ClientOptions): ClientOptions {
      opts.entryPoint = url;
      return opts;
    }
  }

  static addOperationProvider(provider: OperationProvider): ClientOption {
    return function (opts: ClientOptions): ClientOptions {
      opts.operationProviders.push(provider);
      return opts;
    }
  }

}

export class ClientOptions {

  entryPoint: string|null = null;

  operationProviders: OperationProvider[] = [];

  urls: {[index:string]: string} = {};

}
