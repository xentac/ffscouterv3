import { TornApiClient } from 'tornapi-typescript';

export const client = new TornApiClient({
  defaultComment: 'torn-base-script',
  defaultTimeout: 30,
  // you can also provide a http client implementation, but the default `fetch` will do for now
});
