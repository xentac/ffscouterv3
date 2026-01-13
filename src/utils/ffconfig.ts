import type { TornApiKey } from "./types";

export class FFConfig {
  private name: string;

  private _key: TornApiKey = "";

  constructor(name: string) {
    this.name = name;
  }

  get key(): TornApiKey {
    return this._key;
  }

  set key(key: TornApiKey) {
    this._key = key;
  }
}
