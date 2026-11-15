# Demo reset button on the sign-in page

Date: 2026-11-15
Status: awaiting approval

## Intent

Anyone presenting AYU-LINK should be able to put the demo back to its shipped
state — seeded patients, cards, ambulances, hospitals and users, with no cases
or messages — from the screen they are already on. Today that means deleting
`ayu.db` and restarting the API.

## Goals

- One button on the sign-in page that restores the seed data.
- Works when the frontend and API are both local.
- Cannot wipe a deployed database that was not explicitly configured for it.

## Non-goals

- Selective reset (keep patients/cards, clear only cases). Chosen against:
  "everything" is the ask.
- Undo, audit trail, scheduled resets.
- Password reset / account recovery flows.

## Anti-goals

- An endpoint that any visitor can trigger on a public deployment.
- Silently deleting data with no confirmation step.

## Approaches considered

- **A. Reset key from env (chosen).** `AYU_DEMO_RESET_KEY` on the API,
  `VITE_DEMO_RESET_KEY` in the frontend. Endpoint refuses when the server key is
  unset; the button is not rendered when the frontend key is unset. Safe to
  deploy, one click locally.
- **B. Admin-only endpoint.** Safe by default, but the sign-in page has no
  session, so the button could only redirect to a sign-in.
- **C. Open endpoint behind `AYU_ALLOW_DEMO_RESET=1`.** Fewest lines, but a
  single stray env var in production lets any visitor erase the database.

## Design

**API** — `POST /api/demo/reset`, new `backend/app/routers/demo.py`:

- Requires header `X-Demo-Reset-Key`. Compare with `secrets.compare_digest`
  against `config.DEMO_RESET_KEY`. Missing/empty/unset → 403, no writes.
- Deletes in FK order: `case_events` → `messages` → `emergency_cases` →
  `medical_records` → `rfid_cards` → `patients` → `users` → `ambulances` →
  `hospitals`.
- Re-runs `seed_demo(db)` then `seed_rfid_patients(db)`, commits.
- Returns `{"status": "reset", "patients": n, "users": n}` so the UI can say
  what it did.
- Registered in `main.py` next to the other routers.

**Config** — `backend/app/config.py`: `DEMO_RESET_KEY = os.getenv("AYU_DEMO_RESET_KEY", "")`.

**Frontend** — `frontend/src/pages/Login.jsx`:

- A `Reset demo data` button under the demo account grid, rendered only when
  `import.meta.env.VITE_DEMO_RESET_KEY` is set.
- `window.confirm("Reset the demo? All cases and messages will be deleted.")`
  before calling, then a one-line success or error notice using the existing
  `notice` classes.
- Uses the existing `api()` helper from `api.js` with an explicit header.

**Local setup** — `frontend/.env.local` holds `VITE_DEMO_RESET_KEY`; the API is
started with `AYU_DEMO_RESET_KEY` exported (documented in the firmware-adjacent
README section and the VS Code task env). Both absent in production, so no
button and a 403 endpoint.

**Tests** — `backend/tests/test_demo_reset.py`:

- 403 when the header is missing, 403 when the key differs.
- 200 with the right key, and the row counts match the seed (no cases left).
- Idempotent: a second call still returns 200.

## Left to the builder

- Exact button styling — reuse `btn-ink`/`demo-account` classes.
- Whether the success notice should name the restored patient count.
