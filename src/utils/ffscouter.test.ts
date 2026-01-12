import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { query_stats } from "./api";

import { BatchedQueryProcessor } from "./ffscouter";
import { FFCache } from "./ffcache";
import { generate_test_ff_data } from "./test.js";
import type { FFData } from "./types.js";

vi.mock(import("./api.js"), () => {
  return {
    query_stats: vi.fn(),
  };
});

beforeEach(() => {
  // Take control of time.
  vi.useFakeTimers();
  const date = new Date(2012, 1, 1, 0, 0, 0);
  vi.setSystemTime(date);

  vi.clearAllMocks();
});

afterEach(() => {
  // Put things back the way you found it.
  vi.useRealTimers();
});

type ObservedPromise<T> = {
  promise: Promise<T>;
  resolved: boolean;
  value?: T;
};

function observe<T>(p: Promise<T>): ObservedPromise<T> {
  const o: ObservedPromise<T> = {
    promise: p,
    resolved: false,
  };

  p.then((v) => {
    o.resolved = true;
    o.value = v;
  });

  return o;
}

test("start creates runner that runs and does nothing", async () => {
  const cache = new FFCache("name");

  vi.spyOn(cache, "update").mockResolvedValue();

  const b = new BatchedQueryProcessor("a", cache);
  vi.spyOn(b, "schedule");

  expect(b.running()).toBeFalsy();

  expect(b.schedule).not.toHaveBeenCalled();
  b.start();
  expect(b.schedule).toHaveBeenCalled();

  expect(b.running()).toBeTruthy();
  await vi.advanceTimersByTimeAsync(50);
  expect(b.running()).toBeTruthy();
  await vi.advanceTimersByTimeAsync(50);
  expect(b.running()).toBeFalsy();
  expect(query_stats).toBeCalledTimes(0);
  expect(b.schedule).toHaveBeenCalledTimes(1);
});

test("enqueue with wait causes single request to be sent", async () => {
  const cache = new FFCache("name");

  vi.spyOn(cache, "update").mockResolvedValue();
  vi.fn(query_stats).mockResolvedValue({
    result: new Map([[10, generate_test_ff_data(10)]]),
    blank: false,
  });

  const b = new BatchedQueryProcessor("a", cache);
  vi.spyOn(b, "schedule");

  expect(b.schedule).toHaveBeenCalledTimes(0);
  const p = b.enqueue(10);
  expect(b.queue_length()).toBe(1);
  expect(b.running()).toBeTruthy();
  expect(query_stats).toBeCalledTimes(0);
  expect(cache.update).toBeCalledTimes(0);
  expect(b.schedule).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(100);

  expect(b.queue_length()).toBe(0);
  expect(query_stats).toBeCalledTimes(1);
  expect(b.running()).toBeTruthy();
  expect(cache.update).toBeCalledTimes(1);
  expect(b.schedule).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(1000);

  expect(b.queue_length()).toBe(0);
  expect(query_stats).toBeCalledTimes(1);
  expect(b.running()).toBeFalsy();
  expect(cache.update).toBeCalledTimes(1);
  expect(b.schedule).toHaveBeenCalledTimes(2);

  expect(await p).toEqual(generate_test_ff_data(10));
});

test("enqueue less than one batch over less than initial interval", async () => {
  const cache = new FFCache("name");

  vi.spyOn(cache, "update").mockResolvedValue();
  vi.fn(query_stats).mockResolvedValue({
    result: new Map([
      [10, generate_test_ff_data(10)],
      [11, generate_test_ff_data(11)],
      [12, generate_test_ff_data(12)],
      [13, generate_test_ff_data(13)],
      [14, generate_test_ff_data(14)],
      [15, generate_test_ff_data(15)],
      [16, generate_test_ff_data(16)],
      [17, generate_test_ff_data(17)],
    ]),
    blank: false,
  });

  const b = new BatchedQueryProcessor("a", cache);

  const promises = new Map<number, ObservedPromise<FFData>>();
  for (const i of [10, 11, 12, 13, 14, 15, 16, 17]) {
    promises.set(i, observe(b.enqueue(i)));
    //await vi.advanceTimersByTimeAsync(2);
  }

  for (const p of promises.values()) {
    expect(p.resolved).toBe(false);
  }

  expect(b.queue_length()).toBe(8);
  expect(b.running()).toBeTruthy();
  expect(query_stats).toBeCalledTimes(0);

  await b.process();
  await Promise.resolve();
  expect(query_stats).toBeCalledTimes(1);

  for (const [id, p] of promises.entries()) {
    expect(p.resolved).toBe(true);
    expect(p.value).toEqual(generate_test_ff_data(id));
  }

  expect(b.queue_length()).toBe(0);
  expect(query_stats).toBeCalledTimes(1);
  expect(b.running()).toBeTruthy();

  await b.process();
  await Promise.resolve();

  expect(b.queue_length()).toBe(0);
  expect(query_stats).toBeCalledTimes(1);
  expect(b.running()).toBeFalsy();

  expect(query_stats).toHaveBeenCalledWith(
    "a",
    [10, 11, 12, 13, 14, 15, 16, 17],
  );
});

test("enqueue across interval boundaries", async () => {
  const cache = new FFCache("name");

  vi.spyOn(cache, "update").mockResolvedValue();

  const b = new BatchedQueryProcessor("a", cache);

  for (const i of [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]) {
    vi.fn(query_stats).mockResolvedValue({
      result: new Map([[i, generate_test_ff_data(i)]]),
      blank: false,
    });
    const p = observe(b.enqueue(i));
    await b.process();
    await Promise.resolve();
    expect(p.resolved).toBe(true);
    expect(p.value).toEqual(generate_test_ff_data(i));
    expect(vi.fn(query_stats)).toHaveBeenCalledWith("a", [i]);
  }
});

test("enqueue more than one batch in a single batch time", async () => {
  const cache = new FFCache("name");

  vi.spyOn(cache, "update").mockResolvedValue();
  const spy = vi.fn(query_stats);

  for (let i = 0; i < 5; i++) {
    spy.mockResolvedValueOnce({
      result: new Map(
        Array.from({ length: 200 }, (_, j) => {
          return [
            i * 200 + j + 1000,
            generate_test_ff_data(i * 200 + j + 1000),
          ];
        }),
      ),
      blank: false,
    });
  }

  const b = new BatchedQueryProcessor("a", cache);

  for (let i = 1000; i < 2000; i++) {
    observe(b.enqueue(i));
  }

  for (let i = 0; i < 5; i++) {
    await b.process();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith(
      "a",
      Array.from({ length: 200 }, (_, j) => {
        return i * 200 + j + 1000;
      }),
    );
  }
});

test("calculate_next_run works", () => {
  const cache = new FFCache("name");

  const b = new BatchedQueryProcessor("a", cache);

  expect(
    b.calculate_next_run({
      reset_time: new Date(Date.now() + 1000),
      remaining: 100,
      rate_limit: 100,
      this_minute: 0,
    }),
  ).toEqual(1000);

  expect(
    b.calculate_next_run({
      reset_time: new Date(Date.now() + 1000),
      remaining: 99,
      rate_limit: 100,
      this_minute: 1,
    }),
  ).toEqual(1000);

  expect(
    b.calculate_next_run({
      reset_time: new Date(Date.now() + 1000),
      remaining: 98,
      rate_limit: 100,
      this_minute: 2,
    }),
  ).toEqual(1000);

  expect(
    b.calculate_next_run({
      reset_time: new Date(Date.now() + 1000),
      remaining: 75,
      rate_limit: 100,
      this_minute: 25,
    }),
  ).toEqual(1000 / 75);

  expect(
    b.calculate_next_run({
      reset_time: new Date(Date.now() + 1000),
      remaining: 35,
      rate_limit: 100,
      this_minute: 65,
    }),
  ).toEqual(1000 / 35);

  expect(
    b.calculate_next_run({
      reset_time: new Date(Date.now() + 1000),
      remaining: 0,
      rate_limit: 100,
      this_minute: 100,
    }),
  ).toEqual(1000);
});
