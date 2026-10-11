# Hepha

A community repair network named for Hephaestus. Start with a real device on the website, link it to an iMessage conversation, and send photos from your phone. Gemini extracts the visible model and condition. The map shows real submissions and potential donor-part connections.

## Run

Requires Node.js 22+.

```sh
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. Existing local credentials stay in `.env`; do not overwrite them. The backend binds to localhost and keeps photos and fallback state in ignored `data/` files.

## Test with your phone

1. Add your device with its model, symptoms and an optional photo.
2. Copy its `LINK` command and text it to your assigned Photon line.
3. Take a photo of the device or model label and send it in that same iMessage thread.
4. The device updates on the website. Text `STATUS` for details or `NEW` to submit another device.

You can also start directly in iMessage: send a photo or a description. To offer a donor device, send `DONATE` followed by its model and the parts you can offer. Photo attachments support JPEG, PNG, WebP, HEIC and HEIF, up to 8 MB. Unknown models prompt for a label photo or exact model. Temporary Gemini failures preserve intake with an explicit pending-analysis label.

Configure `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, `PHOTON_ENABLED=true`, and `GEMINI_API_KEY` on the server. The default Gemini model is `gemini-3.8-flash`; set `GEMINI_MODEL` to another model available to your account if needed. Photon shared lines may require registering your test recipient in the Photon project dashboard. Replies go to inbound conversations; no cold messages are sent.

## Tiger Data

Set `DATABASE_URL` to your Tiger Cloud Postgres connection string, including its SSL settings, and restart the server. The dashboard reports the actual storage backend. If the service uses a private CA, set `DATABASE_SSL_CA_FILE` to its CA certificate file; the connection verifies both the certificate and hostname. Keep the CA file available on the machine running the backend.

The new schema preserves the earlier prototype tables and creates:

- `hepha_devices`: actual inventory, parts, photo references and intake source.
- `hepha_messages` and `hepha_events`: append-only activity, automatically converted to Timescale hypertables when the extension is installed.
- `hepha_workspace`: transaction-locked conversation state, one-time link codes and message deduplication.

The dashboard queries inventory counts and hourly message activity from SQL. Timescale uses `time_bucket` for the last 24 hours; ordinary Postgres uses `date_trunc`. Photos remain local files; only their references are stored in the database. Without `DATABASE_URL`, the app uses `data/real-state.json`. The original fictional demo state is preserved but no longer displayed.

## Scope

Matching requires the same reported model and overlapping part names. Every connection still needs a human check of exact part number, connector, condition and suitability. The current app handles intake, conversation continuity and candidate discovery; volunteer scheduling, part reservation, compatibility approval and completed repairs are not implemented. This localhost prototype shares activity with anyone using that local dashboard; add authentication before hosting it publicly.

## Checks

```sh
npm test
npm run build
npm start
```

After building, `npm start` serves the UI and API on http://127.0.0.1:3001.
