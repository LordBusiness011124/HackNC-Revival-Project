import express from "express";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
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
app.get("/api/photos/:id", (req, res) => {
  if (!/^[a-f0-9-]{36}$/.test(req.params.id)) {
    res.sendStatus(404);
    return;
  }
  const type = String(req.query.type);
  res.type(allowed.includes(type) ? type : "application/octet-stream");
  res.set("X-Content-Type-Options", "nosniff");
  res.sendFile(path.resolve("data/uploads", req.params.id));
});
app.get("/api/state", async (_req, res) => {
  const s = await store.read();
  res.json({
    devices: s.devices.map(({ session, ...d }) => d),
    events: s.events,
    messages: s.messages.map(({ session, ...m }) => m),
    matches: await store.matches(),
    metrics: await store.metrics(),
    integration,
  });
});
app.post("/api/intake", async (req, res) => {
  const {
    description = "",
    owner = "You",
    role = "repair-target",
    photo,
    model,
    parts,
  } = req.body;
  if (
    typeof description !== "string" ||
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
            const bytes = await message.content.read();
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
  console.log("Hepha backend ready on localhost"),
);
