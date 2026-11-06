import test from "node:test";
import assert from "node:assert/strict";
import { pageFromHash, routes } from "../src/model.ts";
test("all four hash URLs resolve and unknown routes recover to calendar", () => {
  for (const [page, path] of Object.entries(routes))
    assert.equal(pageFromHash("#" + path), page);
  assert.equal(pageFromHash(""), "日历");
  assert.equal(pageFromHash("#/unknown"), "日历");
});
