import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FFCache } from "./ffcache";
import type { FFData, PlayerId } from "./types";

const SEC = 1000;
const MINUTE = 60 * SEC;
const HOUR = 60 * MINUTE;

beforeEach(() => {
  // Take control of time.
  vi.useFakeTimers();
  const date = new Date(2012, 1, 1, 0, 0, 0);
  vi.setSystemTime(date);
});

afterEach(() => {
  // Put things back the way you found it.
  vi.useRealTimers();
});

test("can create and destroy db", async () => {
  const c = new FFCache("test");
  await c.open();

  await c.delete_db();
});

test("get an entry that doesn't exist returns null", async () => {
  const c = new FFCache("test");

  expect(await c.get([12345])).toEqual(new Map([[12345, null]]));

  await c.delete_db();
});

test("can save and recover data", async () => {
  const c = new FFCache("test");

  const players: Map<PlayerId, FFData> = new Map([
    [
      12345,
      {
        no_data: true,
        player_id: 12345,
      },
    ],
    [
      1,
      {
        no_data: false,
        ff_score: 3.0,
        last_updated: Date.now() - 10 * SEC,
        bs_estimate: 1000,
        bs_estimate_human: "1k",
        player_id: 1,
      },
    ],
  ]);

  await c.update([
    players.get(12345) ?? { no_data: true, player_id: -1 },
    players.get(1) ?? { no_data: true, player_id: -1 },
  ]);

  expect(await c.get([12345, 1])).toEqual(
    new Map(
      players.entries().map(([id, v]) => {
        return [id, { ...v, expiry: Date.now() + HOUR }];
      }),
    ),
  );

  expect(await c.get([1])).toEqual(
    new Map([
      [
        1,
        {
          ...(players.get(1) ?? { no_data: true, player_id: -1 }),
          expiry: Date.now() + HOUR,
        },
      ],
    ]),
  );

  expect(await c.get([12345])).toEqual(
    new Map([
      [
        12345,
        {
          ...(players.get(12345) ?? { no_data: true, player_id: -1 }),
          expiry: Date.now() + HOUR,
        },
      ],
    ]),
  );

  await c.delete_db();
});
