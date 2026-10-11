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
export function createConversationHandler(
  store: ConversationStore,
  photoSave: (photo?: Photo) => Promise<string | undefined>,
  analyze: typeof extract = extract,
) {
  function log(s: LiveState, session: string, text: string, sender: string) {
    s.messages.push({
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
        const reply = `Connected to ${device.id}: ${device.model}. Send a photo of the model label or describe the problem. Text STATUS anytime, or NEW to add another device.`;
        log(s, session, reply, "hepha");
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
        log(s, session, reply, "hepha");
        return reply;
      });
    if (/^NEW$/i.test(cmd))
      return store.update((s) => {
        delete s.sessions[session];
        s.processed.push(id);
        return "Ready for another device. Send its photo and describe what is broken, or send DONATE followed by what you can offer.";
      });
    const current = await store.read();
    const existing = current.devices.find(
      (d) => d.id === current.sessions[session],
    );
    const parsed = await analyze(
      `${existing ? `Previous model: ${existing.model}. Previous notes: ${existing.description}. ` : ""}${cmd}`,
      photo,
    );
    const saved = await photoSave(photo);
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
          role: /^(DONATE|DONOR)\b/i.test(cmd) ? "donor" : "repair-target",
          source: "iMessage",
          session,
          photo: saved,
        });
      const reply = `${parsed.analysis === "pending" ? "Photo or notes saved, but Gemini is temporarily unavailable. Please send the exact model and symptoms.\n" : ""}Saved ${d.id}: ${d.model}. ${d.description}\n${d.model === "Unverified device" ? "Please send a clear photo of the model label or type the exact model. " : ""}Parts: ${d.parts.join(", ") || "Tell me which part you need or can offer"}. See your device on the website. Candidate connections require a human compatibility check. Text STATUS or NEW.`;
      log(s, session, reply, "hepha");
      return reply;
    });
  };
}
