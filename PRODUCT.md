# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Ambulance drivers and authorized ambulance staff identify patients and coordinate
their transport to a selected hospital. Hospital staff receive emergency updates,
listen to voice notes, reply, acknowledge communications, and update preparation
status. Doctors review cases for their hospital. Administrators review and
update any emergency case and view platform directories and aggregate counts.

## Product Purpose

AYU-LINK coordinates an emergency handoff from ambulance to hospital. Success
means the crew can identify a patient, share a case update, and receive
acknowledgement while the hospital prepares.

## Positioning

Patient identification, ambulance-to-hospital voice communication, and case
acknowledgement are linked in one role-scoped emergency workflow.

## Operating Context

The ambulance interface is used on a mobile browser during transport. A crew
member scans a patient's RFID UID; the backend resolves the UID to authorized
records, creates or reopens a case, and the crew selects a receiving hospital.
Hospital staff follow incoming cases from their dashboard. RFID cards contain
only identifiers; patient data stays in the backend.

## Capabilities and Constraints

- This is a presentation prototype with seeded demonstration accounts and data.
- Ambulance scans can be simulated in the dashboard; the backend scan endpoint
  remains compatible with an authenticated RFID device.
- Only authenticated ambulance roles can use the Emergency Assistant and send
  ambulance communications. Hospital staff and doctors are limited to their
  hospital's assigned cases. Doctors can close an acknowledged case after the
  ambulance is marked arrived; administrators can review and update any case
  and override those closure prerequisites. Administrator access does not
  reveal password hashes or device keys.
- Voice communication uses browser microphone permission, preview, upload, and
  authenticated playback. Hospital acknowledgement and preparation updates are
  recorded against the case.
- The Emergency Assistant is not a diagnostic tool and must defer to clinical
  judgment.
- Backend: FastAPI, SQLAlchemy, SQLite for the prototype, and Socket.IO.
  Frontend: React, Vite, Tailwind CSS, and Socket.IO client.
- Production deployment, clinical validation, and operational use are out of
  scope.

## Brand Commitments

The product name is AYU-LINK. Preserve the existing Admin, Ambulance, Hospital,
and Doctor modules.

## Evidence on Hand

Seeded demo accounts and local fixtures are provided by `backend/app/seed.py`.
No production patient data, hospital integrations, clinical claims, or
deployment evidence are provided.

## Product Principles

- Keep the emergency handoff quick to scan and operate on a phone.
- Scope patient and case information to authenticated, authorized roles.
- Make message delivery and hospital acknowledgement visible.
- Keep clinical decisions with qualified professionals.
