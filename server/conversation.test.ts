import { test } from "node:test";
import assert from "node:assert/strict";
import { empty, addDevice, type LiveState } from "./live.js";
import { createConversationHandler } from "./conversation.js";
function setup() {
  const s = empty();
  const store = {
    async read() {
      return structuredClone(s);
    },
    async update<T>(fn: (s: LiveState) => T) {
      return fn(s);
    },
  };
  const handler = createConversationHandler(
    store,
    async (photo) => (photo ? "/api/photos/test" : undefined),
    async () => ({
      model: "ThinkPad T480",
      description: "Cracked screen",
      parts: ["screen"],
      analysis: "gemini",
    }),
  );
  return { s, handler };
}
test("phone donor intake asks for contact details and saves explicit replies", async () => {
  const { s, handler } = setup();
  await handler("phone", "start", "DONATE");
  assert.equal(s.devices.length, 0);
  const reply = await handler("phone", "item", "Laptop screen available");
  assert.equal(s.devices[0].role, "donor");
  assert.match(reply, /NAME/);
  assert.match(reply, /LOCATION/);
  assert.match(reply, /EMAIL/);
  await handler("phone", "name", "NAME Sam");
  await handler("phone", "location", "LOCATION Chapel Hill");
  await handler("phone", "email", "EMAIL SKIP");
  assert.equal(s.devices[0].owner, "Sam");
  assert.equal(s.devices[0].location, "Chapel Hill");
  assert.equal(s.devices[0].emailDeclined, true);
  await handler("phone", "bad-email", "EMAIL invalid");
  assert.equal(s.devices[0].email, "");
});
test("phone photo is persisted before analysis and name updates the same listing", async () => {
  const s = empty();
  const handler = createConversationHandler({ read: async () => structuredClone(s), update: async (fn) => fn(s) }, async () => "/api/photos/saved", async () => {
    assert.equal(s.devices[0].photo, "/api/photos/saved");
    return { model: "Unverified device", description: "Photo received", parts: [], analysis: "pending" };
  });
  await handler("phone", "photo1", "", { mimeType: "image/jpeg", data: "test" });
  await handler("phone", "name1", "NAME Alex");
  assert.equal(s.devices.length, 1);
  assert.equal(s.devices[0].owner, "Alex");
  assert.equal(s.devices[0].photo, "/api/photos/saved");
});
test("website link is one-use and phone photo updates the same device", async () => {
  const { s, handler } = setup();
  const d = addDevice(s, {
    owner: "Owner",
    model: "ThinkPad T480",
    description: "Broken",
    role: "repair-target",
    parts: [],
    session: "web-owner",
    source: "website",
  });
  s.links["private-code"] = d.id;
  assert.match(
    await handler("phone-owner", "msg1", "LINK private-code"),
    /Connected/,
  );
  assert.equal(s.links["private-code"], undefined);
  assert.match(
    await handler("other-phone", "msg2", "LINK private-code"),
    /invalid/,
  );
  await handler("phone-owner", "msg3", "", {
    mimeType: "image/jpeg",
    data: "fixture",
  });
  assert.equal(s.devices.length, 1);
  assert.equal(s.devices[0].photo, "/api/photos/test");
  assert.deepEqual(s.devices[0].parts, ["screen"]);
  assert.equal(await handler("phone-owner", "msg3", "duplicate"), "");
  assert.equal(s.devices.length, 1);
  assert.match(
    await handler("phone-owner", "msg4", "STATUS"),
    new RegExp(d.id),
  );
});
test("independent phone sessions cannot alter each other and NEW starts a new intake", async () => {
  const { s, handler } = setup();
  await handler("donor-phone", "msg1", "DONATE ThinkPad T480 screen");
  assert.equal(s.devices[0].role, "donor");
  await handler("owner-phone", "msg2", "ThinkPad T480 broken screen");
  assert.equal(s.devices.length, 2);
  assert.notEqual(s.sessions["owner-phone"], s.sessions["donor-phone"]);
  await handler("owner-phone", "msg3", "NEW");
  await handler("owner-phone", "msg4", "Another laptop");
  assert.equal(s.devices.length, 3);
  assert.equal(s.devices[0].session, "donor-phone");
});
