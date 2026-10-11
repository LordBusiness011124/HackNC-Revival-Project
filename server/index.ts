import express from "express";
import path from "node:path";
import { mkdir, writeFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const runFile = promisify(execFile);
import { randomUUID, randomBytes } from "node:crypto";
import { LiveStore, extract, addDevice } from "./live.js";
import { createConversationHandler } from "./conversation.js";
const app = express();
app.use(express.json({ limit: "12mb" }));
const store = new LiveStore();
const integration = {
  photon: "connecting",
  gemini: Boolean(process.env.GEMINI_API_KEY),
  storage: store.kind,
  detail: "Connecting to your Photon line…",
};
const allowed = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
async function photoSave(photo?: { mimeType: string; data: string }) {
  if (!photo) return undefined;
  if (!allowed.includes(photo.mimeType) || typeof photo.data !== "string")
    throw Error("Use a JPEG, PNG, WebP or HEIC photo.");
  const bytes = Buffer.from(photo.data, "base64");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw Error("Photo must be under 8 MB.");
  const id = randomUUID();
  await mkdir("data/uploads", { recursive: true });
  await writeFile(`data/uploads/${id}`, bytes);
  return `/api/photos/${id}?type=${encodeURIComponent(photo.mimeType)}`;
}
app.get("/api/photos/:id", async (req, res) => {
  if (!/^[a-f0-9-]{36}$/.test(req.params.id)) {
    res.sendStatus(404);
    return;
  }
  const type = String(req.query.type);
  if (type === "image/heic" || type === "image/heif") {
    const original = path.resolve("data/uploads", req.params.id);
    const preview = `${original}.jpg`;
    try {
      await access(preview);
    } catch {
      await runFile("sips", ["-s", "format", "jpeg", original, "--out", preview]);
    }
    res.type("image/jpeg");
    res.set("X-Content-Type-Options", "nosniff");
    res.sendFile(preview);
    return;
  }
  res.type(allowed.includes(type) ? type : "application/octet-stream");
  res.set("X-Content-Type-Options", "nosniff");
  res.sendFile(path.resolve("data/uploads", req.params.id));
});
app.get("/api/state", async (_req, res) => {
  const s = await store.read();
  res.json({
    devices: s.devices.map(({ session, ...d }) => d),
    events: s.events,
    messages: s.messages.map(({ session, ...m }) => {
      const legacyDevice = s.devices.find((d) => d.id === s.sessions[session] && m.time >= d.createdAt);
      return { ...m, deviceId: m.deviceId || legacyDevice?.id };
    }),
    matches: await store.matches(),
    metrics: await store.metrics(),
    integration,
  });
});
app.post("/api/intake", async (req, res) => {
  const {
    description = "",
    owner = "You",
    location = "",
    email = "",
    role = "repair-target",
    photo,
    model,
    parts,
  } = req.body;
  if (
    typeof email !== "string" || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    typeof description !== "string" ||
    typeof location !== "string" || location.length > 150 ||
    description.length > 2000 ||
    !["repair-target", "donor"].includes(role) ||
    (!description.trim() && !photo)
  ) {
    res.status(400).json({ error: "Add a description or photo." });
    return;
  }
  const saved = await photoSave(photo);
  let parsed;
  try {
    parsed = await extract(description, photo);
  } catch {
    res
      .status(502)
      .json({ error: "Gemini could not read this intake. Please try again." });
    return;
  }
  const session = `web:${randomBytes(24).toString("hex")}`,
    linkCode = randomBytes(12).toString("hex");
  const device = await store.update((s) => {
    const d = addDevice(s, {
      owner: String(owner).slice(0, 80),
      location: location.trim(),
      email: email.trim(),
      model:
        typeof model === "string" && model.trim()
          ? model.trim().slice(0, 150)
          : parsed.model,
      description: parsed.description,
      parts:
        typeof parts === "string" && parts.trim()
          ? parts
              .split(",")
              .map((p: string) => p.trim().toLowerCase())
              .filter(Boolean)
              .slice(0, 12)
          : parsed.parts,
      role,
      source: "website",
      analysis: parsed.analysis,
      session,
      photo: saved,
    });
    s.links[linkCode] = d.id;
    return d;
  });
  res.json({ device, linkCode });
});
const inbound = createConversationHandler(store, photoSave);
app.delete("/api/devices/:id", async (req, res) => {
  const removed = await store.update((s) => {
    if (!s.devices.some((d) => d.id === req.params.id)) return false;
    s.devices = s.devices.filter((d) => d.id !== req.params.id);
    for (const [key, value] of Object.entries(s.links)) if (value === req.params.id) delete s.links[key];
    for (const [key, value] of Object.entries(s.sessions)) if (value === req.params.id) delete s.sessions[key];
    return true;
  });
  res.status(removed ? 204 : 404).end();
});
app.patch("/api/devices/:id/contact", async (req, res) => {
  const email = req.body.email;
  if (typeof email !== "string" || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    res.status(400).json({ error: "Enter a valid email address or leave it blank." });
    return;
  }
  const updated = await store.update((s) => {
    const d = s.devices.find((d) => d.id === req.params.id);
    if (!d) return false;
    d.email = email.trim();
    return true;
  });
  res.status(updated ? 204 : 404).end();
});
app.patch("/api/devices/:id", async (req, res) => {
  const { model, parts, location } = req.body;
  if (typeof model !== "string" || !model.trim() || model.length > 150 || typeof parts !== "string" || parts.length > 300 || typeof location !== "string" || location.length > 150) {
    res.status(400).json({ error: "Enter a model, comma-separated parts, and a town or campus within the field limits." });
    return;
  }
  const updated = await store.update((s) => {
    const d = s.devices.find((d) => d.id === req.params.id);
    if (!d) return false;
    d.model = model.trim();
    d.parts = [...new Set(parts.split(",").map((p: string) => p.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
    d.location = location.trim();
    d.analysis = "manual";
    return true;
  });
  res.status(updated ? 204 : 404).end();
});
const projectId = process.env.SPECTRUM_PROJECT_ID,
  projectSecret = process.env.SPECTRUM_PROJECT_SECRET;
if (process.env.PHOTON_ENABLED === "true" && projectId && projectSecret)
  void (async () => {
    try {
      const { Spectrum } = await import("spectrum-ts");
      const { imessage } = await import("spectrum-ts/providers/imessage");
      const photon = await Spectrum({
        projectId,
        projectSecret,
        providers: [imessage.config()],
      });
      integration.photon = "live";
      integration.detail =
        "Photon connected. Text your assigned line a device photo or LINK command.";
      for await (const [space, message] of photon.messages) {
        if (message.direction === "outbound") continue;
        console.info("Photon incoming", { type: message.content.type });
        try {
          const session = `photon:${space.id}:${message.sender?.id || "participant"}`;
          let reply = "";
          if (message.content.type === "text")
            reply = await inbound(session, message.id, message.content.text);
          else if (message.content.type === "attachment") {
            if (!allowed.includes(message.content.mimeType)) {
              await message.reply(
                "Please send a device photo: JPEG, PNG, WebP or HEIC.",
              );
              continue;
            }
            if ((message.content.size || 0) > 8 * 1024 * 1024) {
              await message.reply("Please send a photo smaller than 8 MB.");
              continue;
            }
            await message.reply("Photo received. Downloading it for your listing. Send your item description, name, town/campus and optional email next.");
            const bytes = await Promise.race([
              message.content.read(),
              new Promise<never>((_resolve, reject) => { const timer = setTimeout(() => reject(Error("Photo download timed out")), 15000); timer.unref(); }),
            ]);
            if (bytes.length > 8 * 1024 * 1024) {
              await message.reply("Please send a photo smaller than 8 MB.");
              continue;
            }
            reply = await inbound(session, message.id, "", {
              mimeType: message.content.mimeType,
              data: bytes.toString("base64"),
            });
          }
          if (reply) await message.reply(reply);
        } catch {
          await message.reply(
            "I could not save that intake. Please retry in a moment.",
          );
        }
      }
      integration.photon = "error";
      integration.detail = "Photon stream closed. Restart the server.";
    } catch {
      integration.photon = "error";
      integration.detail =
        "Photon connection failed. Check your assigned line and credentials.";
    }
  })();
else {
  integration.photon = "offline";
  integration.detail = "Photon credentials are not configured.";
}
app.use(express.static(path.resolve("dist")));
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(500).json({
      error:
        err.message.startsWith("Photo") || err.message.startsWith("Use a")
          ? err.message
          : "Unable to complete this request. Check server configuration and retry.",
    });
  },
);
app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log("Revival backend ready on localhost"),
);
