export type ClientOption = (opts: ClientOptions) => ClientOptions;

export class Opt {

  entryPoint(url: string): ClientOption {
    return function (opts: ClientOptions): ClientOptions {
      opts.entryPoint = url;
      return opts;
    }
  }

}

export class ClientOptions {

  entryPoint: string|null = null;

}
