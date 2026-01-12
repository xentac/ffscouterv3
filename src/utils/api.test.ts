import { expect, test, vi } from "vitest";
import { FFApiError, type gmRequest, make_stats_url, query_stats } from "./api";

test("make_stats_url generates proper url", () => {
  expect(make_stats_url("a", [1])).toEqual(
    "https://ffscouter.com/api/v1/get-stats?key=a&targets=1",
  );
  expect(make_stats_url("a", [1, 4, 3, 2])).toEqual(
    "https://ffscouter.com/api/v1/get-stats?key=a&targets=1%2C4%2C3%2C2",
  );
});

test("handle errors", async () => {
  const error400: typeof gmRequest = vi.fn().mockResolvedValue({
    responseHeaders: "",
    readyState: 4,
    response: "",
    responseText: "error",
    responseXML: null,
    status: 400,
    statusText: "status error",
    finalUrl: "",
    context: {},
  });

  await expect(query_stats("a", [], error400)).rejects.toThrow(
    new FFApiError(
      "API request failed. Couldn't parse response. HTTP status code: 400",
    ),
  );
  const error400_but_json: typeof gmRequest = vi.fn().mockResolvedValue({
    responseHeaders: "",
    readyState: 4,
    response: "",
    responseText: "{}",
    responseXML: null,
    status: 400,
    statusText: "status error",
    finalUrl: "",
    context: {},
  });

  await expect(query_stats("a", [], error400_but_json)).rejects.toThrow(
    new FFApiError("API request failed. HTTP status code: 400"),
  );

  const error_with_code_1: typeof gmRequest = vi.fn().mockResolvedValue({
    responseHeaders: "",
    readyState: 4,
    response: "",
    responseText: JSON.stringify({
      code: 1,
      error: "API key is required",
    }),
    responseXML: null,
    status: 400,
    statusText: "status error",
    finalUrl: "",
    context: {},
  });

  await expect(query_stats("a", [], error_with_code_1)).rejects.toThrow(
    new FFApiError("API request failed. Error: API key is required; Code: 1", {
      ff_api_error: {
        code: 1,
        error: "API key is required",
      },
    }),
  );

  const error_with_code_4: typeof gmRequest = vi.fn().mockResolvedValue({
    responseHeaders: "",
    readyState: 4,
    response: "",
    responseText: JSON.stringify({
      code: 4,
      error: "At least one target ID is required and no more than 205",
    }),
    responseXML: null,
    status: 200,
    statusText: "status error",
    finalUrl: "",
    context: {},
  });

  await expect(query_stats("a", [], error_with_code_4)).rejects.toThrow(
    new FFApiError(
      "API request failed. Error: At least one target ID is required and no more than 205; Code: 4",
      {
        ff_api_error: {
          code: 4,
          error: "At least one target ID is required and no more than 205",
        },
      },
    ),
  );
});

test("success", async () => {
  const success: typeof gmRequest = vi.fn().mockResolvedValue({
    responseHeaders:
      "cache-control: no-cache, private\n\
      x-ratelimit-reset-until: 55\n\
x-ratelimit-reset-timestamp: 1768192440\n\
x-ratelimit-limit: 120\n\
x-ratelimit-remaining: 118\n",
    readyState: 4,
    response: "",
    responseText: JSON.stringify([
      {
        player_id: 234,
        fair_fight: 1.01,
        bs_estimate: 11249,
        bs_estimate_human: "11.2k",
        bss_public: 208,
        last_updated: 1767667811,
      },
      {
        player_id: 567,
        fair_fight: 12.21,
        bs_estimate: 8110418660,
        bs_estimate_human: "8.11b",
        bss_public: 176618,
        last_updated: 1768045549,
      },
      {
        player_id: 1,
        fair_fight: null,
        bs_estimate: null,
        bs_estimate_human: null,
        bss_public: null,
        last_updated: null,
      },
    ]),
    responseXML: null,
    status: 200,
    statusText: "",
    finalUrl: "",
    context: {},
  });

  expect(await query_stats("a", [234, 567, 1], success)).toEqual({
    result: new Map([
      [
        234,
        {
          player_id: 234,
          no_data: false,
          fair_fight: 1.01,
          bs_estimate: 11249,
          bs_estimate_human: "11.2k",
          bss_public: 208,
          last_updated: 1767667811,
        },
      ],
      [
        567,
        {
          player_id: 567,
          no_data: false,
          fair_fight: 12.21,
          bs_estimate: 8110418660,
          bs_estimate_human: "8.11b",
          bss_public: 176618,
          last_updated: 1768045549,
        },
      ],
      [
        1,
        {
          player_id: 1,
          no_data: true,
        },
      ],
    ]),
    blank: false,
    limits: {
      rate_limit: 120,
      remaining: 118,
      reset_time: new Date("2026-01-12T04:34:00.000Z"),
      this_minute: 2,
    },
  });
});

test("success but missing results", async () => {
  const success: typeof gmRequest = vi.fn().mockResolvedValue({
    responseHeaders:
      "cache-control: no-cache, private\n\
      x-ratelimit-reset-until: 55\n\
x-ratelimit-reset-timestamp: 1768192440\n\
x-ratelimit-limit: 120\n\
x-ratelimit-remaining: 118\n",
    readyState: 4,
    response: "",
    responseText: JSON.stringify([]),
    responseXML: null,
    status: 200,
    statusText: "",
    finalUrl: "",
    context: {},
  });

  expect(await query_stats("a", [234, 567, 1], success)).toEqual({
    result: new Map([
      [
        234,
        {
          player_id: 234,
          no_data: true,
        },
      ],
      [
        567,
        {
          player_id: 567,
          no_data: true,
        },
      ],
      [
        1,
        {
          player_id: 1,
          no_data: true,
        },
      ],
    ]),
    blank: false,
    limits: {
      rate_limit: 120,
      remaining: 118,
      reset_time: new Date("2026-01-12T04:34:00.000Z"),
      this_minute: 2,
    },
  });
});

test("empty response", async () => {
  // This is a weird scenario that Torn PDA will do if you make requests too quickly
  const empty: typeof gmRequest = vi.fn().mockResolvedValue(null);

  expect(await query_stats("a", [234, 567], empty)).toEqual({
    result: new Map(),
    blank: true,
  });
});
