import {
  //unwrap,
  //wrap,
  type DBSchema,
  deleteDB,
  type IDBPDatabase,
  type IDBPTransaction,
  openDB,
  type StoreNames,
} from "idb";
import logger from "./logger";
import type { CachedFFData, FFData, PlayerId } from "./types";

export const STORES = {
  CACHE: "cache",
} as const;

interface CacheDB extends DBSchema {
  [STORES.CACHE]: {
    key: PlayerId;
    value: CachedFFData;
    indexes: { expiry: number };
  };
}

type MigrationFn = (
  db: IDBPDatabase<CacheDB>,
  transaction: IDBPTransaction<CacheDB, StoreNames<CacheDB>[], "versionchange">,
) => void;

export class FFCache {
  private db_name: string;
  private db: IDBPDatabase<CacheDB> | null = null;
  private db_version = 1;

  private cache_interval: number = 60 * 60 * 1000; // one hour cache

  private migrations: Map<number, MigrationFn> = new Map([
    [
      1,
      (db, _) => {
        const store = db.createObjectStore(STORES.CACHE, {
          keyPath: "player_id",
        });
        store.createIndex("expiry", ["expiry"], {
          unique: false,
        });
      },
    ],
  ]);

  constructor(db_name: string) {
    this.db_name = db_name;
  }

  open = async () => {
    if (this.db) {
      return;
    }
    const cache = this;
    this.db = await openDB<CacheDB>(this.db_name, 1, {
      upgrade(db, oldVersion, newVersion, transaction, _event) {
        // …
        logger.info("Need to upgrade from", oldVersion, "to", newVersion);

        for (let i = (oldVersion ?? 0) + 1; i <= cache.db_version; i++) {
          logger.debug(`Migration: ${i}`);
          const m = cache.migrations.get(1);
          if (m) {
            logger.debug(`Migration not found: ${i}`);
            m(db, transaction);
          }
          logger.debug(`Migration complete: ${i}`);
        }
      },
      blocking(currentVersion, blockedVersion, _event) {
        logger.debug(
          `Can't open ${blockedVersion} because ${currentVersion} is open. Closing and reopening.`,
        );
        if (!cache.db) {
          return;
        }
        cache.db.close();
      },
      /*blocked(currentVersion, blockedVersion, event) {
        // …
      },
      terminated() {
        // …
      },*/
    });
  };

  close = () => {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  };

  delete_db = async () => {
    this.close();

    await deleteDB(this.db_name);

    logger.info(`Successfully deleted ${this.db_name} IndexedDB.`);
  };

  get = async (
    player_ids: PlayerId[],
  ): Promise<Map<PlayerId, CachedFFData | null>> => {
    await this.open();
    if (!this.db) {
      logger.error("Tried to open IndexedDB but failed.");
      throw new Error("Tried to open IndexedDB but failed.");
    }

    const tx = this.db.transaction(STORES.CACHE, "readonly");

    const requests = [];

    for (const id of player_ids) {
      requests.push(tx.store.get(id));
    }
    const entries = await Promise.all(requests);

    await tx.done;

    if (!entries) {
      return new Map();
    }

    return new Map(
      entries.map((value, i) => {
        if (!value) {
          if (!player_ids[i]) {
            return [-1, null];
          }
          return [player_ids[i], null];
        }
        if (value.expiry < Date.now()) {
          return [value.player_id, null];
        }
        return [value.player_id, value];
      }),
    );
  };

  update = async (values: FFData[]): Promise<void> => {
    await this.open();
    if (!this.db) {
      logger.error("Tried to open IndexedDB but failed.");
      throw new Error("Tried to open IndexedDB but failed.");
    }

    const tx = this.db.transaction(STORES.CACHE, "readwrite");

    const values_expiry = values.map((value) => {
      return {
        ...value,
        expiry: Date.now() + this.cache_interval,
      };
    });

    const requests = values_expiry.map((value) => {
      return tx.store.put(value);
    });

    await Promise.all(requests);

    await tx.done;
  };

  clean_expired = async () => {
    await this.open();
    if (!this.db) {
      logger.error("Tried to open IndexedDB but failed.");
      throw new Error("Tried to open IndexedDB but failed.");
    }
    const tx = this.db.transaction(STORES.CACHE, "readwrite");

    const index = tx.store.index("expiry");

    const range = IDBKeyRange.upperBound(Date.now(), true);

    const r = await index.getAllKeys(range);
    logger.info(`Found ${r.length} expired values to delete.`);

    let deletes = 0;

    r.map(async (id) => {
      const res = await tx.store.delete(id);
      deletes++;
      return res;
    });

    await tx.done;

    tx.commit();
    logger.info(`Cleaned ${deletes} expired values from cache.`);
  };

  dump = async () => {
    await this.open();
    if (!this.db) {
      logger.error("Tried to open IndexedDB but failed.");
      throw new Error("Tried to open IndexedDB but failed.");
    }

    const tx = this.db.transaction(STORES.CACHE, "readonly");

    const res = await tx.store.getAll();

    return res;
  };
}
