import { TornApiClient } from 'tornapi-typescript';

// This used to be Kwack's V1 wrapper. It turned into a v1 & v2 wrapper when I annoyed DKK so much he made it lol

export const client = new TornApiClient({
  defaultComment: 'FFScouterV3',
  defaultTimeout: 30,
  // you can also provide a http client implementation, but the default `fetch` will do for now
});
