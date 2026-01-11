import { query_stats } from "./api";
import { FFCache } from "./ffcache";
import logger from "./logger";
import type { FFData, PlayerId } from "./types";

const DB_NAME = "FFSV3-cache";

export class FFScouterAPI {
  private key: string;

  private max_ids_per_request = 200;
  private batch_delay = 100; // ms

  private cache: FFCache = new FFCache(DB_NAME);

  constructor(key: string) {
    this.key = key;
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
  ): Promise<Map<PlayerId, FFData>> => {
    const cached = await this.get_cached_estimates(player_ids);

    const still_needed = cached.entries().filter(([_id, elem]) => {
      if (!elem || elem.no_data) {
        return true;
      }
      return false;
    });

    const res = await this.query(
      Array.from(still_needed.map(([id, _elem]) => id)),
    );
    this.cache.update(Array.from(res.values()));

    return new Map(
      player_ids.map((id) => {
        return [
          id,
          cached.get(id) ?? res.get(id) ?? { player_id: id, no_data: true },
        ];
      }),
    );
  };

  query = async (player_ids: PlayerId[]): Promise<Map<PlayerId, FFData>> => {
    try {
      const results = await query_stats(this.key, player_ids);
      return results;
    } catch (error) {
      logger.info(error);
      return new Map();
    }
  };
}
