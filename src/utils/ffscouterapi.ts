import { query_stats } from "./api";
import { FFCache } from "./ffcache";
import logger from "./logger";
import type { FFData, PlayerId, TornApiKey } from "./types";

const DB_NAME = "FFSV3-cache";

export class FFScouterAPI {
  private key: string;

  private cache: FFCache = new FFCache(DB_NAME);

  private batched_query_processor: BatchedQueryProcessor;

  constructor(key: string) {
    this.key = key;
    this.batched_query_processor = new BatchedQueryProcessor(
      this.key,
      this.cache,
    );
  }

  change_key = (key: string) => {
    this.key = key;
  };

  get_cached_estimates = async (
    player_ids: PlayerId[],
  ): Promise<Map<PlayerId, FFData | null>> => {
    logger.info(`Querying cache for ${player_ids.length} players.`);
    return this.cache.get(player_ids);
  };

  get_estimates = async (
    player_ids: PlayerId[],
  ): Promise<Promise<FFData>[]> => {
    // NOTE: This API may look awkward right now, but that's because it will
    // eventually support arbitrary batching. Each Promise will return its value
    // when we have a result, either from the cache or from one of potentially
    // many api calls.
    const cached = await this.get_cached_estimates(player_ids);

    return player_ids.map((id) => {
      const c = cached.get(id);
      if (c) {
        return new Promise((resolve) => resolve(c));
      }
      return this.batched_query_processor.enqueue(id);
    });
  };
}

type Job<T> = {
  resolvers: Resolver<T>[];
  in_flight: boolean;
};

type Resolver<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

class BatchedQueryProcessor {
  private key: TornApiKey;
  private queue: Map<PlayerId, Job<FFData>> = new Map();
  private scheduled: boolean = false;

  private runner: ReturnType<typeof setTimeout> | null = null;

  private max_ids_per_request = 200;

  private cache: FFCache;

  constructor(key: TornApiKey, cache: FFCache) {
    this.key = key;
    this.cache = cache;
  }

  enqueue = async (id: PlayerId): Promise<FFData> => {
    return new Promise((resolve, reject) => {
      const existing = this.queue.get(id);

      // If a queued request for this ID already exists, just piggyback off of it
      if (existing) {
        existing.resolvers.push({ resolve, reject });
        return;
      }

      this.queue.set(id, {
        in_flight: false,
        resolvers: [{ resolve, reject }],
      });

      this.scheduled = true;
      this.start();
    });
  };

  process = async () => {
    if (!this.scheduled) {
      this.runner = setTimeout(this.process, 100);
      return;
    }

    logger.debug("Doing a process");
    logger.debug(this.queue);

    let ids_to_query = Array.from(
      this.queue
        .entries()
        .filter(([_, job]): boolean => {
          if (job.in_flight) {
            return false;
          }
          return true;
        })
        .map(([id, job]): PlayerId => {
          job.in_flight = true;
          return id;
        }),
    );

    if (ids_to_query.length > this.max_ids_per_request) {
      ids_to_query = ids_to_query.slice(0, this.max_ids_per_request);
    }
    this.scheduled = false;

    let next_run = 100;

    try {
      logger.info(`Making ffscouter stat query for ${ids_to_query.length} ids`);
      const results = await query_stats(this.key, ids_to_query);

      // API didn't respond case
      if (results.blank) {
        // This is a special case where Torn PDA returns no values because we requested the same URL too quickly, try querying again
        for (const id of ids_to_query) {
          const job = this.queue.get(id);
          // How did we ask for a result but it was never queued in the first place?
          if (!job) {
            continue;
          }
          job.in_flight = false;
        }
        this.scheduled = true;
        next_run = 500;
        return;
      }

      // Update the cache with the new responses from the ffscoter api
      void this.cache.update(Array.from(results.result.values()));

      // Happy path
      for (const [id, d] of results.result) {
        const job = this.queue.get(id);
        // How did we ask for a result but it was never queued in the first place?
        if (!job) {
          continue;
        }
        this.queue.delete(id);
        for (const { resolve } of job.resolvers) {
          resolve(d);
        }
      }

      // TODO: Process limits data to schedule next run
    } catch (error) {
      logger.error("Received error response querying ffscouter api:", error);
      for (const id of ids_to_query) {
        const job = this.queue.get(id);
        // How did we ask for a result but it was never queued in the first place?
        if (!job) {
          continue;
        }
        this.queue.delete(id);
        for (const { reject } of job.resolvers) {
          reject(error);
        }
      }
    } finally {
      this.runner = setTimeout(this.process, next_run);
    }
  };

  start = () => {
    if (!this.runner) {
      this.runner = setTimeout(this.process, 100);
    }
  };

  stop = () => {
    this.runner?.close();
    this.runner = null;
  };
}
