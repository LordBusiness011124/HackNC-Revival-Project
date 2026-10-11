# Revival presenter notes

Canva presentation: https://canva.link/ck6m02cfxzoooev

Main slides: problem, demo example, solution, thank you/questions. Slides 5–12 are optional backup material.

Two minutes of presentation, then two minutes for questions. Present slides 1–4 only. Stay on slide 4 during Q&A and jump to the relevant backup slide when asked.

## Slide 1: The repair gap — 0:00–0:30

“Revival starts with a broken laptop screen. The rest of the laptop may still be useful, and someone else may already have the part it needs. But those two people may never find each other. We can contact people across the world instantly. Useful things should not become waste because we could not make that connection. I built Revival to make a repair request or a donor offer as easy as sending a message.”

## Slide 2: A cracked laptop screen — 0:30–1:35

“This example is a laptop with a cracked screen. I start by adding it on the website. Revival gives me a one-use LINK command. I text that to the project's Photon line, then send a photo of the laptop or its model label. Gemini reads the visible details and reported symptoms. The same device updates here, so the website and phone conversation stay connected. A donor can offer a device through the same flow. When the reported model and parts overlap, Revival shows a candidate connection for a person to check.”

Switch to the live app. Show the intake, LINK command, phone thread and resulting website record. Keep the actual device model you show consistent with the narration. The ThinkPad T480 in the slide is an illustrative scenario, not a claim about your own device.

## Slide 3: A shared repair network — 1:35–1:55

“Revival turns these conversations into a shared inventory of broken devices and donor parts. It helps people discover a possible repair. A person still checks the exact part and working condition before using it. The bright blue Frutiger Aero design reflects the idea that connected technology can help us keep useful things in circulation.”

## Slide 4: Thank you — 1:55–2:00

“Thank you. I'm happy to take questions.”

## Q&A slide map and short answers

### 5 — How does it work technically?

React and Vite display the network. Express handles intake and state. Photon receives iMessage text and attachments. Gemini extracts device details. Tiger Data persists the inventory and activity, and SQL finds candidate connections. The website polls for updates.

### 6 — How do you know the part fits? Can AI make a dangerous recommendation?

The current match is a candidate based on the same reported model and overlapping part names. AI does not approve hardware compatibility. A person checks exact part number, connector and condition. Verified part numbers and approval are next.

### 7 — Why Tiger Data rather than just saving a JSON file?

The actual database stores inventory and conversation state. SQL performs candidate matching. Timescale hypertables keep append-only message and event history, and time_bucket queries show hourly activity. Transactions serialize state changes. This supports both the current inventory and the history of how it changes.

### 8 — What about privacy and security?

Credentials stay on the backend. Random one-use LINK codes bind website intake to a phone session. Photos remain on the local machine. This is currently a localhost prototype with a shared dashboard. A public version needs authentication, access controls and a deletion policy.

### 9 — What if Gemini or Photon fails?

Gemini retries and then saves a pending-analysis intake if extraction is unavailable. An unclear model prompts for an exact model or label photo. Duplicate incoming IDs do not create another intake. Website intake remains an alternative interface. If the Photon stream closes, the current server needs a restart.

### 10 — What works now, and what is still planned?

Current work covers website intake, iMessage attachment handling and conversation linking, Gemini extraction, real inventory, candidate matching and activity history. Verified parts, reservations, repair volunteers, scheduling and completed-repair tracking are future work.

### 11 — Who would use it? How would you get people to participate? How much waste has it saved?

I would start with one campus repair club or repair café, where people already have repair skills and donor devices. Messaging makes contributions easy. I have not measured waste savings. Next I would track completed repairs and devices kept in use before estimating material impact.

### 12 — How did you use the hackathon tracks?

Frutiger Aero shapes the blue sky, water, glass and greenery visual design. Community shapes the shared repair inventory. Gemini handles image/text extraction. Photon supplies the iMessage interface. Tiger Data handles SQL inventory and Timescale activity history. Official category eligibility depends on event rules.

## Before presenting

- Keep the app running and open beside Canva.
- Confirm your assigned Photon line and finish a phone-to-Photon test before presenting the message flow live.
- Use a real device and a clear photo. Copy its LINK code in advance.
- Hide environment files, credentials, private phone numbers and notifications.
- If using a screenshot or recording instead of live transport, label it honestly and describe what it shows.
- If the model is slow, show the preserved intake and continue. Do not spend the remaining minute waiting for a response.
- Keep a real submitted device visible as a fallback. Do not seed fictional people or claim a repair happened.
