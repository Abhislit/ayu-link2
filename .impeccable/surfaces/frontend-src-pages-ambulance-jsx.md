---
version: 1
slug: "frontend-src-pages-ambulance-jsx"
primary_target: "frontend/src/pages/Ambulance.jsx"
related_targets: ["frontend/src/pages/Hospital.jsx","frontend/src/pages/Doctor.jsx","frontend/src/pages/Admin.jsx","frontend/src/components/Shell.jsx","frontend/src/components/CaseMessages.jsx","frontend/src/components/CaseOverview.jsx","frontend/src/components/CaseQueue.jsx","frontend/src/components/StatusPill.jsx","frontend/src/components/VoiceComposer.jsx","frontend/src/pages/Login.jsx","frontend/src/index.css","frontend/index.html"]
---

# Surface

## Scope and visitor mode

The AYU-LINK web app, with the ambulance handoff as its guided presentation path. Operate.

## Audience, job, action, proof, and constraints

Ambulance crews identify a patient, record a crew-reported concern, choose a receiving hospital, send a voice or text update, and see acknowledgement. Hospital staff receive and acknowledge cases; doctors review their hospital's cases read-only; administrators view platform directories and counts. Use authenticated API data and the existing demo seed. Preserve all routes, role gates, RFID behavior, voice messages, case updates, and preparation controls. Do not invent diagnosis, location, travel time, or clinical claims. Concern shortcuts are message drafts, not diagnoses or case-category updates.

## Chosen direction and memorable moment

Hospital Wayfinding is the assigned direction, candidate 3 of 7, `seed:71ed675a91083f8c`. A light, high-contrast clinical workspace uses a deep-teal role rail, humanist sans, concise labeled states, and route-green only for completed handoff stages. Red is reserved for explicit urgency. Keep a conventional app shell and controls. The first view puts patient identity and the next handoff action first, with the communication thread alongside. The memorable move is one route marker advancing when the underlying case state really changes; no movement on load, no geographic map, and no fabricated ETA. Role queues, patient details, and communication keep the same grammar across all four modules.

## Direction contract

THESIS: Hospital wayfinding makes the next handoff step obvious without turning care into a control-room costume.

OWN-WORLD: Warm white work surfaces, a deep-teal navigation rail, jade progress links, and red reserved for explicit risk. Humanist sans carries names and instructions; tabular numerals keep case data scannable.

STORY: The crew identifies a patient, records a reported concern, assigns a hospital, and sends an update. Hospital acknowledgement and ambulance arrival remain distinct states.

FIRST VIEWPORT: A fixed role rail anchors a live status header. The ambulance workspace leads with patient identity and a four-stage handoff path; concern choices and destination occupy the primary column; the communication thread and Send update action sit beside it. No map, distance, or ETA is implied.

FORM: Hospital Wayfinding, candidate 3 of 7; seed:71ed675a91083f8c. The route marker advances only after a real state transition, never on initial render, and collapses under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
