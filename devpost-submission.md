# Revival

## Project name

Revival

## Elevator pitch

Turn broken electronics into community repair opportunities. Start on the web, text a photo, and connect useful parts with devices that need them.

## AI tools used

Select **OpenAI** and **Gemini**. OpenAI Codex helped build and test the project, and an OpenAI image tool generated the thumbnail; the app uses the Gemini API for device intake. Do not select APIs that are not implemented.

## Did you implement a generative AI model or API?

Yes. Revival uses the Gemini API to turn device descriptions and photos into structured repair intake: the reported or visible model, symptoms, and parts someone needs or can offer. Photos can come from a website upload or directly from an iMessage conversation through Photon. This lets someone start with a picture and a short message instead of filling out a technical inventory form. The app asks for an exact model or a clearer label photo when it cannot identify the device. It preserves submissions if Gemini is temporarily unavailable. AI does not certify compatibility or working condition; candidate connections require a human check.

## Technology feedback

Gemini's image and structured-output support made it practical to turn a device photo and a short description into inventory data. Temporary high-demand errors were the main friction, so I added a retry and a fallback that keeps the submission instead of losing it. Photon let me use iMessage as an intake interface, including photo attachments, without making users install another app. Supporting phone image formats and linking a website intake to the correct conversation took extra care. Tiger Data gave me PostgreSQL for device records and Timescale hypertables for message and event history. I used SQL for candidate matching and time_bucket for hourly activity. The Node connection needed a local CA certificate for verified TLS. GitHub and OpenAI Codex helped me iterate quickly as a solo builder, check changes, run tests, and keep API credentials out of the repository.

## About the project — paste this entire section into Project Story

### Inspiration

A broken screen should not mean throwing away an entire laptop. Someone else might have the part it needs, but those two people may never find each other.

I wanted to build around that gap. We can reach people across the world in seconds, yet useful materials still become waste because we cannot connect the person who needs something with the person who already has it. Wasting usable parts for that reason should be a thing of the past.

Revival starts with electronics. The idea is to make offering a spare part or asking for a repair as easy as sending a message.

### What it does

Revival is a community repair network. You can add a broken device or donor device on the website, then text a one-use LINK command to the project's Photon iMessage line to continue that same intake from your phone.

Take a picture of the device or its model label and send it in the conversation. Gemini extracts visible details and reported symptoms, and the device updates on the website. You can also start directly in iMessage. STATUS returns your device's details, NEW starts another intake, and DONATE lets you offer a donor device and its parts.

The resurrection map shows real submissions and potential connections between devices with the same reported model and overlapping part needs. Every candidate still needs someone to check the exact part number, connector, condition, and suitability before a repair.

### The theme

I used Frutiger Aero's bright blues, glass panels, water, greenery, and glossy buttons to give Revival an optimistic view of technology. That visual style fits the project's purpose: a connected world where people help each other keep useful things in circulation.

The interface starts with an empty network. The people using it create the connections, and their devices become the story on the screen.

### How I built it

I built the frontend with React, TypeScript, and Vite, with an Express backend. Photon receives iMessage text and image attachments. Gemini reads intake descriptions and images into structured fields. Tiger Data stores device inventory and conversation state, while Timescale hypertables preserve message and event history. SQL finds candidate part connections and groups recent message activity into hourly buckets.

OpenAI Codex helped me build, revise, debug, and test the app. I kept API keys and database credentials on the server in an ignored environment file. The current version runs locally, and the source is on GitHub.

### How the tracks connect

**Frutiger Aero:** The blue sky and water palette, translucent panels, greenery, and glossy controls connect the event's visual theme to the project's optimism about technology and reuse.

**Community:** Revival helps people offer donor devices and find parts for broken electronics. It creates a shared inventory of what people need and what others can contribute.

**Gemini:** The app uses Gemini's multimodal API to extract device details from text and photos, including photos received through iMessage.

**Photon:** iMessage is part of the product flow. A website intake can move into a phone conversation, where photos and follow-up messages update the same device.

**Tiger Data:** The app uses a live Tiger Data database for actual inventory and conversation state, SQL candidate matching, Timescale message and event hypertables, and hourly activity queries with time_bucket.

These are the integrations implemented in this version. Track selection and eligibility still depend on the event's form and rules.

### Challenges I ran into

The biggest challenge was moving from a convincing mockup to a real intake flow. Website submissions, phone photos, and follow-up messages needed to refer to the same device. I added one-use link codes, conversation-specific state, and duplicate-message checks.

Gemini also returned temporary high-demand errors during testing. I added a retry and made sure an unavailable model would not erase someone's submission. Another challenge was keeping the matching honest: a photo can help identify a device, but it cannot prove that an internal part works or that two components fit.

### Accomplishments I'm proud of

I replaced the fictional demo inventory with real submissions, connected Photon and Gemini, and verified the live Tiger Data connection and Timescale hypertables. The build and six automated tests passed. I also tested photo upload, image serving, and intake persistence in an isolated environment so test records would not clutter the live network.

### What I learned

The difficult part of a repair network is keeping the device, its owner, its messages, and its possible parts connected as information arrives. A message interface makes intake easier, but the data behind it still needs clear ownership and reliable persistence.

I also learned to separate AI extraction from hardware verification. Revival can organize an offer; a person still needs to check the part.

### What's next for Revival

Next I want to add verified part numbers, repair volunteers, reservations, and scheduling. After that, I want to record completed repairs and measure the devices and materials kept in use. Those features are future work; this version handles intake, conversation continuity, and candidate discovery.

## Built with

React, TypeScript, Vite, Node.js, Express.js, Gemini API, Photon, iMessage, Tiger Data, PostgreSQL, TimescaleDB, OpenAI Codex, GitHub

## Thumbnail

Upload submission-assets/revival-thumbnail.png. Generated with the built-in OpenAI image tool; the prompt is saved beside it.

## Public repository

https://github.com/LordBusiness011124/HackNC-Revival-Project

## Public demo

Not hosted. Local demo: http://127.0.0.1:5173. This localhost address is not a public link for judges. Use the repository's setup instructions and provide a demo video.

## Demo video

TODO: Record and upload your demo; paste its public video URL into Devpost. Suggested recording is under two minutes, but confirm the actual event requirement in the form.

- 0:00–0:15: Show the blue Revival interface and explain the broken-screen / spare-part problem.
- 0:15–0:35: Add your real device on the website; show the generated LINK command.
- 0:35–1:05: Text the LINK command to the Photon line and send a photo from your phone. Show the response and updated website device.
- 1:05–1:25: Show a real donor offer if you have one. Explain that a candidate needs compatibility review; do not invent a match for the recording.
- 1:25–1:45: Show Tiger Data's active dashboard status, explain Gemini extraction and Timescale activity, and point out the Frutiger Aero theme.
- 1:45–1:55: State that reservations, volunteers, and completed-repair tracking are next.

## Screenshot shot list

1. Revival's blue Frutiger Aero interface.
2. The actual device intake form and uploaded photo.
3. Your phone's Photon conversation and the same updated device on the website. Crop phone numbers and private notifications.
4. A real candidate connection or Tiger Data activity after the phone test.

## Testing instructions

Clone the public repo, install dependencies, configure server-side credentials using .env.example, and run npm run dev. Open localhost:5173, add a device, text its LINK code to your assigned Photon line, send a photo, and confirm that the same device updates. Text STATUS, then NEW to try another intake. npm test and npm run build verify the automated checks and production build.

## Submission readiness notes

This packet is a draft; nothing has been sent to Devpost. The supplied form fields are covered above. The Devpost connector returned service errors, so account registration, exact category rules, deadline, and event-specific deliverables could not be verified through it. Check those on the form you are using. No guided workflow state was created and no rules acknowledgment was invented.

Remaining user actions: run the actual phone-to-Photon test, record/upload the video if the form requires it, upload the thumbnail, add any requested screenshots, choose the relevant offered tracks, and finish the Devpost form. If the phone test is completed successfully, replace the explicitly pending-test sentence in the story with the result you observed.

## Known limitations

Local-only deployment; shared local activity view; no public authentication; photos stored on the local machine; matching based on reported model and part names; no compatibility approval, reservations, volunteer coordination, repair scheduling, or measured waste reduction yet.

## TODO Official Form Fields

Any additional required questions or track checkboxes visible in the actual form. The account and event-specific requirements could not be fetched by the connector. No confirmed Codex session ID was requested in the fields provided.
