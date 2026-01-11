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
  const mockRequester: typeof gmRequest = vi.fn().mockResolvedValue({
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

  await expect(query_stats("a", [], mockRequester)).rejects.toThrow(
    new FFApiError("API request failed. HTTP status code: 400"),
  );
});
