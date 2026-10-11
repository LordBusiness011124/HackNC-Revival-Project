# Lazarus

A community repair lab that connects a broken device, a donor part, and a repair volunteer. The map updates as people confirm or withdraw their contributions.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

Open the Local URL printed by Vite, usually http://127.0.0.1:5173. The backend runs on port 3001. State saves to the ignored `data/state.json` file.

## Store data in Tiger Data

By default, state saves to `data/state.json`. To use a Tiger Data (TimescaleDB/Postgres) database instead:

1. Create a free service at [console.cloud.timescale.com](https://console.cloud.timescale.com).
2. Copy its connection string into `.env`:

   ```dotenv
   DATABASE_URL=postgres://tsdbadmin:<password>@<host>:<port>/tsdb?sslmode=require
   ```

3. Restart `npm run dev`. The backend logs `Storage: Tiger Data (Postgres)` and creates its tables on first request.

Tables: `repairs`, `chat_sessions`, `processed_messages`, `devices`, `parts`, plus `messages` and `events`, which are TimescaleDB hypertables that keep history beyond what the dashboard shows. Reset clears chat, events, and confirmations but keeps the device inventory. Any plain Postgres database also works; the hypertables are simply skipped.

## Try the demo

1. In the messages panel, choose Maya, the donor.
2. Click **Offer help**, then **Yes, confirm**. The donor edge turns green.
3. Switch to Jamie, the repairer, and confirm their help.
4. The plan becomes ready. Withdraw either contribution to reopen it.
5. Use **Add a device** for text intake. New submissions are shown separately for review; they do not enter the fixed demo match.

The three inventory devices, people, conditions, and compatibility are fictional demo data. No physical repair, scheduling, identity verification, or diagnostic testing is implemented. A confirmed plan does not mean a working laptop.

## Connect Photon iMessage

Put your Spectrum Cloud credentials into `.env`:

```dotenv
SPECTRUM_PROJECT_ID=your-project-id
SPECTRUM_PROJECT_SECRET=your-project-secret
PHOTON_ENABLED=true
```

Restart `npm run dev`. Check the messages panel for the connection status. Text your assigned Photon line **DONOR**, then **YES**; from a second conversation, text **REPAIRER**, then **YES**. **CANCEL** withdraws a contribution. **STATUS** returns the current plan. Messages are tagged “via iMessage” in the dashboard, which polls for updates.

Spectrum shared lines may require adding your test recipients as project users in the Photon dashboard. Follow the [Photon setup guide](https://github.com/photon-hq/spectrum-ts) and [routing notes](https://github.com/photon-hq/skills/blob/main/skills/imessage/references/spectrum.md). The listener replies to incoming messages; it does not cold-message donors or create groups. The in-page chat remains a simulation even while Photon is connected.

This prototype assigns donor/repairer roles per conversation to one demo repair. It does not authenticate participants or enforce contribution ownership. Keep the server on localhost for this demo; authentication and participant authorization are required before opening it to others.

## Connect Gemini

Create a key in [Google AI Studio](https://aistudio.google.com/apikey), add `GEMINI_API_KEY` to `.env`, and restart. Optionally set `GEMINI_MODEL` to a text model available to your account; the default is `gemini-3.8-flash`.

**Add a device** uses Gemini to extract the model and reported symptom. Without a key, intake saves the description manually. Gemini does not establish compatibility or diagnose hardware. API credentials stay on the backend.

## Verify and build

```sh
npm test
npm run build
npm start
```

After building, `npm start` serves the compiled interface and API at http://127.0.0.1:3001. To use a custom backend port during development, also update the Vite proxy in `vite.config.ts`.

Stack: React, Vite, TypeScript, Express, Spectrum, and the Google GenAI SDK. Local JSON persistence is intended for a single process.
