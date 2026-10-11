import { test } from "node:test";
import assert from "node:assert/strict";
import { sharedParts } from "../src/parts.js";
test("donor leads recognize combined part entries without inventing missing offers", () => {
  assert.deepEqual(sharedParts(["battery"], ["Battery and screen"]), ["battery"]);
  assert.deepEqual(sharedParts(["battery"], ["batter and screen"]), ["battery"]);
  assert.deepEqual(sharedParts(["wheel"], ["battery and screen"]), []);
});
