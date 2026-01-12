import { query_stats } from "./api";
import { FFCache } from "./ffcache";
import logger from "./logger";
import type { FFData, PlayerId, TornApiKey } from "./types";

const DB_NAME = "FFSV3-cache";

export class FFScouter {
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
  attempts: number;
};

type Resolver<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export class BatchedQueryProcessor {
  private key: TornApiKey;
  private queue: Map<PlayerId, Job<FFData>> = new Map();

  private runner: ReturnType<typeof setTimeout> | null = null;

  private max_ids_per_request = 200;
  private initial_collect_time = 100;
  private max_attempts = 5;

  private cache: FFCache;

  constructor(key: TornApiKey, cache: FFCache) {
    this.key = key;
    this.cache = cache;
  }

  change_key = (key: TornApiKey) => {
    this.key = key;
  };

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
        attempts: 0,
      });

      this.start();
    });
  };

  get_unscheduled = () => {
    return Array.from(
      this.queue.entries().filter(([_, job]): boolean => {
        if (job.in_flight) {
          return false;
        }
        return true;
      }),
    );
  };

  queue_length = () => {
    return this.get_unscheduled().length;
  };

  process = async () => {
    this.runner = null;
    let unscheduled = this.get_unscheduled();
    logger.debug(
      "Starting process with unscheduled length",
      unscheduled.length,
    );
    if (unscheduled.length <= 0) {
      logger.debug("Stopping processor nothing to do");
      return;
    }

    if (unscheduled.length > this.max_ids_per_request) {
      unscheduled = unscheduled.slice(0, this.max_ids_per_request);
    }

    const ids_to_query = unscheduled.map(([id, job]) => {
      job.in_flight = true;
      return id;
    });

    let next_run = this.initial_collect_time;

    try {
      logger.info(`Making ffscouter stat query for ${ids_to_query.length} ids`);
      const results = await query_stats(this.key, ids_to_query);
      //logger.debug("Received result", results);

      // API didn't respond case
      if (results.blank) {
        logger.debug("Got a blank result, will retry request in 500ms");
        // This is a special case where Torn PDA returns no values because we requested the same URL too quickly, try querying again
        for (const id of ids_to_query) {
          const job = this.queue.get(id);
          // How did we ask for a result but it was never queued in the first place?
          if (!job) {
            continue;
          }
          job.in_flight = false;
        }
        next_run = 500;
        return;
      }

      // Update the cache with the new responses from the ffscoter api
      this.cache.update(Array.from(results.result.values()));
      logger.debug("Updated cache");

      const processed: Set<PlayerId> = new Set();
      // Happy path
      for (const [id, d] of results.result) {
        logger.debug("Processing result", [id, d]);
        const job = this.queue.get(id);
        // How did we ask for a result but it was never queued in the first place?
        if (!job) {
          continue;
        }
        processed.add(id);
        this.queue.delete(id);
        for (const { resolve } of job.resolvers) {
          resolve(d);
        }
      }

      for (const [id, job] of unscheduled) {
        if (!processed.has(id)) {
          job.in_flight = false;
          job.attempts++;

          if (job.attempts <= this.max_attempts) {
            logger.error(
              `Didn't receive query response for id ${id}. Rescheduling attempt ${job.attempts}.`,
            );
          } else {
            logger.error(
              `Didn't receive query response for id ${id}. Max attempts reached. Giving up.`,
            );
            for (const { reject } of job.resolvers) {
              reject(new Error("Max attempts reached."));
            }
          }
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
      logger.debug("Rescheduling processor for", next_run, "ms");
      this.runner = this.schedule(this.process, next_run);
    }
  };

  schedule = (fn: () => void, delay: number) => {
    return setTimeout(fn, delay);
  };

  start = () => {
    if (!this.runner) {
      this.runner = this.schedule(this.process, this.initial_collect_time);
    }
  };

  stop = () => {
    if (this.runner) {
      clearTimeout(this.runner);
    }
    this.runner = null;
  };

  running = () => {
    if (this.runner) {
      return true;
    }
    return false;
  };
}
