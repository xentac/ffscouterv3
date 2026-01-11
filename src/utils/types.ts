export type PlayerId = number;

export type Timestamp = number; // ms

export type FFData =
  | {
      no_data: false;
      ff_score: number;
      last_updated: Timestamp;
      bs_estimate: number;
      bs_estimate_human: string;
      player_id: PlayerId;
    }
  | { no_data: true; player_id: PlayerId };

export type CachedFFData = FFData & { expiry: Timestamp };
