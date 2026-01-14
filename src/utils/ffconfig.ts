import { Storage as StorageUtil } from "./storage";
import type { TornApiKey } from "./types";

enum CONFIG {
  KEY = "key",
}

export class FFConfig {
  private name: string;
  private storage: StorageUtil;

  constructor(name: string) {
    this.name = name;
    this.storage = new StorageUtil(this.name);
  }

  get key(): TornApiKey {
    return this.storage.get(CONFIG.KEY) ?? "";
  }

  set key(key: TornApiKey) {
    this.storage.set(CONFIG.KEY, key);
  }
}
