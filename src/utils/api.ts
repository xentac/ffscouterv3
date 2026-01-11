import { TornApiClient } from "tornapi-typescript";
import type { FFData, PlayerId, TornApiKey } from "./types";

/// <reference types="tampermonkey" />

const FF_SCOUTER_BASE_URL = "https://ffscouter.com/api/v1";

// This used to be Kwack's V1 wrapper. It turned into a v1 & v2 wrapper when I annoyed DKK so much he made it lol

export const client = new TornApiClient({
  defaultComment: "FFScouterV3",
  defaultTimeout: 30,
  // you can also provide a http client implementation, but the default `fetch` will do for now
});

// Promise wrapper function
export async function gmRequest<T = any>(
  options: Tampermonkey.Request<T>,
): Promise<Tampermonkey.Response<T>> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      ...options,
      onload: (response) => resolve(response),
      onerror: (err) => reject(err),
      ontimeout: () => reject(new Error("Timeout making GM_xmlhttpRequest")),
    });
  });
}

export const make_stats_url = (key: TornApiKey, player_ids: PlayerId[]) => {
  const query = new URLSearchParams([
    ["key", key],
    ["targets", player_ids.toString()],
  ]);
  return `${FF_SCOUTER_BASE_URL}/get-stats?${query.toString()}`;
};

export type FFSuccess = {
  player_id: number;
  fair_fight: number | null;
  bs_estimate: number | null;
  bs_estimate_human: string | null;
  last_updated: number | null;
};

export type FFError = {
  code: number;
  error: string;
};

function is_ff_success(resp: FFSuccess[] | FFError): resp is FFSuccess[] {
  return (resp as FFError).code === undefined;
}

export const query_stats = async (
  key: TornApiKey,
  player_ids: PlayerId[],
): Promise<FFData[]> => {
  const url = make_stats_url(key, player_ids);

  const resp = await gmRequest({
    method: "GET",
    url: url,
  });

  if (!resp) {
    return [];
  }
  if (resp.status !== 200) {
    try {
      const err: FFError = JSON.parse(resp.responseText);
      if (err.error) {
        throw new Error(
          `API request failed. Error: ${err.error}; Code: ${err.code}`,
        );
      } else {
        throw new Error(`API request failed. HTTP status code: ${resp.status}`);
      }
    } catch {
      throw new Error(`API request failed. HTTP status code: ${resp.status}`);
    }
  }

  const ff_response: FFSuccess[] | FFError = JSON.parse(resp.responseText);
  if (!is_ff_success(ff_response)) {
    throw new Error(ff_response.error); // TODO figure out how to raise codes
  }
  const results: FFData[] = [];
  ff_response.forEach((result) => {
    if (result?.player_id) {
      if (
        !result.fair_fight ||
        !result.last_updated ||
        !result.bs_estimate ||
        !result.bs_estimate_human
      ) {
        results.push({
          no_data: true,
          player_id: result.player_id,
        });
      } else {
        results.push({
          no_data: false,
          fair_fight: result.fair_fight,
          last_updated: result.last_updated,
          bs_estimate: result.bs_estimate,
          bs_estimate_human: result.bs_estimate_human,
          player_id: result.player_id,
        });
      }
    }
  });

  return results;

  // TODO Handle limit tracking
};
