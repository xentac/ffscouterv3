import { expect, test } from "vitest";
import { make_stats_url } from "./api";

test("make_stats_url generates proper url", () => {
  expect(make_stats_url("a", [1])).toEqual(
    "https://ffscouter.com/api/v1/get-stats?key=a&targets=1",
  );
  expect(make_stats_url("a", [1, 4, 3, 2])).toEqual(
    "https://ffscouter.com/api/v1/get-stats?key=a&targets=1%2C4%2C3%2C2",
  );
});
