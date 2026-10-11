import express from 'express';
import path from 'node:path';
import { processMessage, recordEvent, type RepairState } from './engine.js';
import { createStore } from './store.js';

const app = express();
app.use(express.json({ limit: '32kb' }));
const store = createStore();
console.log(`Storage: ${store.kind === 'tiger' ? 'Tiger Data (Postgres)' : 'local file data/state.json'}`);
const integration = { photon: 'demo' as 'demo' | 'connecting' | 'live' | 'error', gemini: Boolean(process.env.GEMINI_API_KEY), storage: store.kind, detail: 'Simulated messages. No texts are sent.' };
app.get('/api/state', async (_req, res) => {
  const { sessions, processed, ...publicState } = await store.read();
  res.json({ ...publicState, integration });
});
app.post('/api/message', async (req, res) => {
  const { text, role } = req.body;
  if (typeof text !== 'string' || !text.trim() || text.length > 2000 || !['donor', 'repairer'].includes(role)) { res.status(400).json({ error: 'Choose a role and enter a message under 2,000 characters.' }); return; }
  const reply = await store.update(s => processMessage(s, { text, role, session: `demo-${role}`, channel: 'demo' }));
  res.json({ reply });
});
app.post('/api/reset', async (_req, res) => { await store.reset(); res.json({ ok: true }); });
app.get('/api/inventory', async (_req, res) => { res.json({ devices: await store.inventory() }); });
app.post('/api/intake', async (req, res) => {
  const { description } = req.body;
  if (typeof description !== 'string' || !description.trim() || description.length > 2000) { res.status(400).json({ error: 'Describe the device in under 2,000 characters.' }); return; }
  let intake: RepairState['intake'] = { model: 'Unverified device', symptom: description.trim(), source: 'manual' };
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const result = await ai.models.generateContent({ model: process.env.GEMINI_MODEL || 'gemini-3.8-flash', contents: `Extract only the explicitly reported device model and symptoms from this user text. Do not diagnose, invent parts, or claim compatibility. Use "Unverified device" if no model is given. User text: ${JSON.stringify(description)}`, config: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { model: { type: 'STRING' }, symptom: { type: 'STRING' } }, required: ['model', 'symptom'] } } });
      const parsed = JSON.parse(result.text || '{}');
      if (typeof parsed.model !== 'string' || typeof parsed.symptom !== 'string') throw new Error('Invalid extraction');
      intake = { model: parsed.model.slice(0, 150), symptom: parsed.symptom.slice(0, 2000), source: 'gemini' };
    } catch { res.status(502).json({ error: 'Gemini intake failed. Check your key and model, or remove the key to use manual intake.' }); return; }
  }
  await store.update(s => { s.intake = intake; recordEvent(s, `Device submitted: ${intake.model}. Compatibility needs review.`); });
  res.json({ intake });
});

const spectrumProjectId = process.env.SPECTRUM_PROJECT_ID || process.env.PROJECT_ID;
const spectrumProjectSecret = process.env.SPECTRUM_PROJECT_SECRET || process.env.PROJECT_SECRET;
if (process.env.PHOTON_ENABLED === 'true' && spectrumProjectId && spectrumProjectSecret) {
  integration.photon = 'connecting'; integration.detail = 'Connecting to Photon…';
  void (async () => {
    try {
      const { Spectrum } = await import('spectrum-ts');
      const { imessage } = await import('spectrum-ts/providers/imessage');
      const photon = await Spectrum({ projectId: spectrumProjectId, projectSecret: spectrumProjectSecret, providers: [imessage.config()] });
      integration.photon = 'live'; integration.detail = 'Photon connected. Text your assigned line: DONOR or REPAIRER.';
      for await (const [space, message] of photon.messages) {
        if (message.direction === 'outbound' || message.content.type !== 'text') continue;
        const text = message.content.text;
        const reply = await store.update(s => processMessage(s, { text, session: `photon-${space.id}`, channel: 'imessage', messageId: message.id }));
        if (reply) await message.reply(reply);
      }
      integration.photon = 'error'; integration.detail = 'Photon stream closed. Restart the server to reconnect.';
    } catch { integration.photon = 'error'; integration.detail = 'Photon connection failed. Check credentials, line access, and restart the server.'; console.error(integration.detail); }
  })();
}
app.use(express.static(path.resolve('dist')));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(err.message); res.status(500).json({ error: 'The server could not save this change. Try again.' }); });
const port = Number(process.env.PORT || 3001);
app.listen(port, '127.0.0.1', () => console.log(`Lazarus backend: http://127.0.0.1:${port}`));
