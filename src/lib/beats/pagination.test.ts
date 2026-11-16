import { test } from "node:test";
import assert from "node:assert/strict";
import { beatPagination, beatCatalogHref, parseBeatGenre, BEATS_PER_PAGE, CAROUSEL_BEATS } from "./pagination";

test("catalogue pages contain at most 30 beats, including the last page", () => {
  assert.equal(BEATS_PER_PAGE, 30);
  assert.equal(CAROUSEL_BEATS, 12);
  assert.deepEqual(beatPagination("1", 71), { page: 1, pages: 3, offset: 0 });
  assert.deepEqual(beatPagination("2", 71), { page: 2, pages: 3, offset: 30 });
  assert.deepEqual(beatPagination("3", 71), { page: 3, pages: 3, offset: 60 });
});

test("invalid and out-of-bounds page inputs stay within the catalogue", () => {
  for (const input of [undefined, "-1", "0", "1.5", "NaN", "Infinity"]) assert.equal(beatPagination(input, 71).page, 1);
  assert.equal(beatPagination("99999", 71).page, 3);
  assert.deepEqual(beatPagination("2", 0), { page: 1, pages: 1, offset: 0 });
});

test("genre links reset pagination; page links preserve the selected genre", () => {
  assert.equal(parseBeatGenre("trap"), "trap");
  assert.equal(parseBeatGenre("not-a-genre"), undefined);
  assert.equal(beatCatalogHref(1), "/beats");
  assert.equal(beatCatalogHref(1, "trap"), "/beats?genre=trap");
  assert.equal(beatCatalogHref(2, "trap"), "/beats?genre=trap&page=2");
});
