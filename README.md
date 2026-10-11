# Revival

Revival helps people connect broken electronics with donor devices that may have the parts they need. Start a repair request on the website, continue it through iMessage, and send photos from your phone. The same device record follows the conversation.

## The problem

A laptop with a broken screen can still have a working motherboard, keyboard and other useful components. Another damaged laptop might have the screen it needs. Those parts can sit unused because the people who have them never find the people who need them.

We can contact each other instantly, but finding a repair opportunity still takes scattered messages, technical descriptions and manual searches. Revival makes those contributions easier to collect and find.

## The solution

Revival turns device descriptions and photos into a shared repair inventory. People can submit a device that needs repair or offer a donor device. The website shows those real submissions and suggests possible connections when a needed part overlaps with a donor offer for the same reported model.

For example, someone with a ThinkPad T480 and a cracked screen can submit a repair request. If someone else offers a T480 screen, Revival can surface that connection. A person still checks the exact part number, connector and working condition before using it. The example describes the flow, not a completed repair.

## How Revival specifically solves it

1. **Collect the device.** Add its description and an optional photo on the website, or start directly in iMessage.
2. **Keep the conversation connected.** Text the website's random, one-use `LINK` command to the assigned Photon line. Later messages and photos update that same device instead of creating scattered records.
3. **Organize the details.** Gemini extracts the visible or reported model, symptoms, and parts someone needs or can offer. An unclear model prompts for the exact model or a clearer label photo.
4. **Find a possible connection.** SQL compares actual repair requests and donor offers by reported model and overlapping part names. The repair map displays candidates for human review.
5. **Preserve the history.** Tiger Data stores inventory and conversation state. Timescale message and event history records how intake changes, and hourly queries show activity.

The current app handles intake, conversation continuity and candidate discovery. Verified compatibility, part reservations, repair volunteers, scheduling and completed-repair tracking are next steps. Revival has not measured waste reduction yet.

## Try it locally

Requires Node.js 22 or newer.

```sh
npm install
```

For a fresh checkout, copy `.env.example` to `.env` and configure the server-side credentials. Keep an existing `.env` if you already have one.

```sh
npm run dev
```

Open http://127.0.0.1:5173. The backend runs on localhost port 3001.

### Continue on your phone

1. Add your real device on the website.
2. Copy its `LINK` command and text it to your assigned Photon iMessage line.
3. Take a photo of the device or model label and send it in the same thread.
4. Watch the device update on the website. Text `STATUS` for its details or `NEW` to start another intake.

To offer a donor device, start a new intake and send `DONATE` followed by its model and the parts you can offer. You can also begin directly with a photo or description. Photo intake supports JPEG, PNG, WebP, HEIC and HEIF, up to 8 MB. A temporary Gemini failure preserves the submission with a pending-analysis label.

## Configuration

Credentials stay on the backend in the ignored `.env` file.

| Variable | Purpose |
| --- | --- |
| `SPECTRUM_PROJECT_ID` | Photon project ID |
| `SPECTRUM_PROJECT_SECRET` | Photon project secret |
| `PHOTON_ENABLED` | Set to `true` to receive iMessage intake |
| `GEMINI_API_KEY` | Gemini text and image extraction |
| `GEMINI_MODEL` | Model available to your account; default `gemini-3.8-flash` |
| `DATABASE_URL` | Tiger Data/Postgres connection string |
| `DATABASE_SSL_CA_FILE` | Optional local CA certificate file for verified database TLS |

Photon shared lines may require registering your test recipient in the project dashboard. The server replies to incoming conversations. It does not initiate outreach to donors or create groups.

## Architecture and storage

React, TypeScript and Vite render the website. Express coordinates intake and conversations. Photon receives iMessage text and attachment bytes, and Gemini extracts structured device details. Tiger Data provides PostgreSQL persistence and Timescale activity history.

The current schema uses `hepha_devices` for inventory, `hepha_workspace` for transaction-locked conversation state, and `hepha_messages` / `hepha_events` for append-only history. The table names retain their earlier prefix to preserve existing data after the Revival rename. Timescale uses `time_bucket` for hourly message activity. Plain Postgres uses `date_trunc`.

Photo bytes stay in the ignored local `data/uploads` directory; the database stores their references. Without `DATABASE_URL`, state saves to `data/real-state.json`. Keep the local photo directory and any configured CA certificate when moving the runtime.

## Current limits

This version runs locally with a shared dashboard and no public authentication. A hosted version needs access controls and a photo deletion policy. Candidate matching does not certify hardware compatibility or working condition. The application does not reserve parts, coordinate volunteers, schedule repairs or record completed repairs yet.

## Checks and production build

```sh
npm test
npm run build
npm start
```

After building, `npm start` serves the website and API on http://127.0.0.1:3001.

## Presentation and submission

The [Devpost packet](devpost-submission.md) contains the project story and submission copy. [Presenter notes](presentation/revival-presenter-notes.md) cover a two-minute demo and answers to likely questions. The [Canva presentation](https://canva.link/ck6m02cfxzoooev) uses four main slides, followed by technical and Q&A backup slides after the thank-you slide.

## Hackathon tracks

Revival connects Community repair with Gemini photo/text extraction, Photon iMessage intake and Tiger Data inventory/activity storage. Its blue sky, water, glass and greenery design follows the Frutiger Aero theme. These are implemented features and design choices; prize eligibility depends on the event rules.
