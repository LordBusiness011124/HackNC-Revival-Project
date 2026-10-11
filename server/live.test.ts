import { test } from "node:test";
import assert from "node:assert/strict";
import { empty, addDevice, candidates } from "./live.js";
test("real network starts empty; unknown model cannot create a connection", () => {
  const s = empty();
  assert.equal(s.devices.length, 0);
  for (const role of ["repair-target", "donor"] as const)
    addDevice(s, {
      owner: "Test",
      model: "Unverified device",
      description: "screen",
      role,
      parts: ["screen"],
      source: "test",
      session: role,
    });
  assert.equal(candidates(s).length, 0);
});
test("actual matching requires reported same model and part, always awaiting review", () => {
  const s = empty();
  const target = addDevice(s, {
    owner: "Test owner",
    model: "ThinkPad T480",
    description: "Cracked screen",
    role: "repair-target",
    parts: ["screen"],
    source: "test",
    session: "owner",
  });
  addDevice(s, {
    owner: "Test donor",
    model: "ThinkPad T480",
    description: "Battery only",
    role: "donor",
    parts: ["battery"],
    source: "test",
    session: "donor1",
  });
  assert.equal(candidates(s).length, 0);
  const donor = addDevice(s, {
    owner: "Test donor",
    model: "thinkpad t480",
    description: "Screen offered",
    role: "donor",
    parts: ["screen"],
    source: "test",
    session: "donor2",
  });
  assert.deepEqual(candidates(s), [
    {
      target: target.id,
      donor: donor.id,
      part: "screen",
      status: "Compatibility review required",
    },
  ]);
  assert.equal(s.sessions.owner, target.id);
});
