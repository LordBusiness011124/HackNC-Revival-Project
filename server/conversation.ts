import { randomUUID } from "node:crypto";
import {
  extract,
  addDevice,
  event,
  candidates,
  type LiveState,
} from "./live.js";
type ConversationStore = {
  read(): Promise<LiveState>;
  update<T>(fn: (s: LiveState) => T): Promise<T>;
};
type Photo = { mimeType: string; data: string };
function missingDetails(d: { owner: string; model: string; parts: string[]; location?: string; email?: string; emailDeclined?: boolean }) {
  const questions = [];
  if (d.owner === "iMessage participant") questions.push("What name should we show? Reply NAME followed by your name.");
  if (!d.location) questions.push("Where is the item? Reply LOCATION followed by your town or campus.");
  if (!d.email && !d.emailDeclined) questions.push("Want people to contact you? Reply EMAIL followed by your email (visible to this network), or EMAIL SKIP.");
  if (d.model === "Unverified device") questions.push("What is the item or exact model? Reply MODEL followed by its name, or send a clear label photo.");
  if (!d.parts.length) questions.push("Which parts do you need or offer? Reply PARTS followed by a comma-separated list.");
  return questions.length ? `\nTo complete your listing:\n${questions.join("\n")}` : "\nYour listing has its contact and part details. Check donor leads on the website.";
}
export function createConversationHandler(
  store: ConversationStore,
  photoSave: (photo?: Photo) => Promise<string | undefined>,
  analyze: typeof extract = extract,
) {
  function log(s: LiveState, session: string, text: string, sender: string) {
    s.messages.push({
      deviceId: s.sessions[session],
      id: randomUUID(),
      session,
      text,
      sender,
      time: new Date().toISOString(),
    });
    s.messages = s.messages.slice(-300);
  }
  return async function inbound(
    session: string,
    id: string,
    text: string,
    photo?: { mimeType: string; data: string },
  ) {
    if ((await store.read()).processed.includes(id)) return "";
    const cmd = text.trim();
    if (/^(DONATE|DONOR)$/i.test(cmd) && !photo)
      return store.update((s) => {
        s.processed.push(id);
        (s.pendingRoles ??= {})[session] = "donor";
        return "What item and parts can you offer, and what condition are they in? Send a description or photo. Then I'll ask for your name, town/campus and optional contact email. No listing has been created yet.";
      });
    if (/^(NAME|EMAIL|MODEL|PARTS)\s+/i.test(cmd) && !photo)
      return store.update((s) => {
        if (s.processed.includes(id)) return "";
        const d = s.devices.find((d) => d.id === s.sessions[session]);
        if (!d) return "First describe your item or LINK a website listing, then add its details.";
        const field = cmd.split(/\s+/)[0].toUpperCase();
        const value = cmd.slice(field.length).trim();
        if (field === "EMAIL" && value.toUpperCase() !== "SKIP" && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return "Please send EMAIL followed by a valid email address, or EMAIL SKIP.";
        s.processed.push(id);
        if (field === "NAME") d.owner = value.slice(0, 80);
        if (field === "MODEL") d.model = value.slice(0, 150);
        if (field === "PARTS") d.parts = value.toLowerCase().split(/,|;|\band\b|&/).map((p) => p.trim()).filter(Boolean).slice(0, 12);
        if (field === "EMAIL") { d.emailDeclined = value.toUpperCase() === "SKIP"; d.email = d.emailDeclined ? "" : value; }
        log(s, session, cmd, "user");
        const reply = `${field === "EMAIL" && d.emailDeclined ? "Email sharing skipped." : "Details saved."}${missingDetails(d)}`;
        log(s, session, reply, "revival");
        return reply;
      });
    if (/^LOCATION\s+/i.test(cmd))
      return store.update((s) => {
        if (s.processed.includes(id)) return "";
        const d = s.devices.find((d) => d.id === s.sessions[session]);
        if (!d) return "First LINK your website intake or send a description of your item, then text LOCATION followed by your town or campus.";
        s.processed.push(id);
        d.location = cmd.replace(/^LOCATION\s+/i, "").trim().slice(0, 150);
        log(s, session, cmd, "user");
        const reply = `Location saved for ${d.id}: ${d.location}.${missingDetails(d)}`;
        log(s, session, reply, "revival");
        return reply;
      });
    if (/^LINK\s+/i.test(cmd))
      return store.update((s) => {
        if (s.processed.includes(id)) return "";
        s.processed.push(id);
        const key = cmd.split(/\s+/)[1];
        const device = s.devices.find((d) => d.id === s.links[key]);
        if (!device)
          return "That link is invalid or already used. If this thread is already connected, text STATUS. Otherwise use the LINK command for a new website intake.";
        device.session = session;
        device.phoneConnected = true;
        s.sessions[session] = device.id;
        delete s.links[key];
        event(s, `${device.id} connected to iMessage.`);
        log(s, session, cmd, "user");
        const reply = `Connected to ${device.id}: ${device.model}. Send a photo or describe the problem.${missingDetails(device)} Text STATUS anytime, or NEW for another item.`;
        log(s, session, reply, "revival");
        return reply;
      });
    if (/^STATUS$/i.test(cmd))
      return store.update((s) => {
        s.processed.push(id);
        const d = s.devices.find((d) => d.id === s.sessions[session]);
        const reply = d
          ? `${d.id}: ${d.model}. ${d.description}\nParts: ${d.parts.join(", ") || "not yet identified"}. ${candidates(s).filter((m) => m.target === d.id || m.donor === d.id).length} candidate connection(s), awaiting compatibility review.`
          : "Send a device photo or describe its model and problem. Use DONATE before a description to offer parts, or LINK followed by your website code.";
        log(s, session, cmd, "user");
        log(s, session, reply, "revival");
        return reply;
      });
    if (/^NEW$/i.test(cmd))
      return store.update((s) => {
        delete s.sessions[session];
        if (s.pendingRoles) delete s.pendingRoles[session];
        s.processed.push(id);
        return "Ready for another device. Send its photo and describe what is broken, or send DONATE followed by what you can offer.";
      });
    const current = await store.read();
    const existing = current.devices.find(
      (d) => d.id === current.sessions[session],
    );
    const saved = await photoSave(photo);
    if (saved) await store.update((s) => {
      let d = s.devices.find((d) => d.id === s.sessions[session]);
      if (!d) d = addDevice(s, {
        owner: "iMessage participant", model: "Unverified device", description: cmd || "Photo received. Details are being analyzed.", parts: [],
        role: /^(DONATE|DONOR)\b/i.test(cmd) || s.pendingRoles?.[session] === "donor" ? "donor" : "repair-target",
        source: "iMessage", session, photo: saved, analysis: "pending",
      });
      d.photo = saved;
      event(s, `${d.id} photo saved through iMessage.`);
    });
    const parsed = await analyze(
      `${existing ? `Previous model: ${existing.model}. Previous notes: ${existing.description}. ` : ""}${cmd}`,
      photo,
    );
    return store.update((s) => {
      if (s.processed.includes(id)) return "";
      s.processed.push(id);
      s.processed = s.processed.slice(-2000);
      log(
        s,
        session,
        photo ? `${cmd || "Device photo"} [photo received]` : cmd,
        "user",
      );
      let d = s.devices.find((d) => d.id === s.sessions[session]);
      if (d) {
        d.analysis = parsed.analysis;
        if (parsed.model !== "Unverified device") d.model = parsed.model;
        d.description = parsed.description;
        d.parts = [...new Set([...d.parts, ...parsed.parts])];
        if (saved) d.photo = saved;
        event(s, `${d.id} updated through iMessage.`);
      } else
        d = addDevice(s, {
          owner: "iMessage participant",
          ...parsed,
          role: /^(DONATE|DONOR)\b/i.test(cmd) || s.pendingRoles?.[session] === "donor" ? "donor" : "repair-target",
          source: "iMessage",
          session,
          photo: saved,
        });
      const userMessage = s.messages.at(-1);
      const name = cmd.match(/\b(?:my\s+)?name\s+is\s+([^.!?\n]+)/i)?.[1]?.trim();
      const location = cmd.match(/\b(?:I['’]m|I am)\s+in\s+([^.!?\n]+)/i)?.[1]?.trim();
      const email = cmd.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
      if (name) d.owner = name.slice(0, 80);
      if (location) d.location = location.slice(0, 150);
      if (email) d.email = email.slice(0, 254);
      if (s.pendingRoles) delete s.pendingRoles[session];
      if (userMessage?.session === session && userMessage.sender === "user" && !userMessage.deviceId) userMessage.deviceId = d.id;
      const reply = `${parsed.analysis === "pending" ? "Photo or notes saved, but Gemini is temporarily unavailable. Please send the exact model and symptoms.\n" : ""}Saved ${d.id}: ${d.model}. ${d.description}\n${d.model === "Unverified device" ? "Please send a clear photo of the model label or type the exact model. " : ""}Parts: ${d.parts.join(", ") || "Tell me which part you need or can offer"}. See your device on the website. Candidate connections require a human compatibility check. Text STATUS or NEW.`;
      const completeReply = reply + missingDetails(d);
      log(s, session, completeReply, "revival");
      return completeReply;
    });
  };
}
