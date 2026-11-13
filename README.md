# AYU-LINK

AYU-LINK is a presentation prototype for emergency coordination between an
ambulance crew and a receiving hospital. The demo connects RFID patient
identification, a mobile-first ambulance dashboard, voice and text handoff,
hospital playback and acknowledgement, and role-specific Admin, Hospital, and
Doctor dashboards.

This prototype is for demonstration only. It is not a clinically validated or
production-ready patient-care system.

## Architecture

See the [system architecture and handoff sequence](./docs/architecture.md), or
use the [one-page workflow diagram](./docs/ayu-link-emergency-flow.svg) in a
presentation.

## Run locally

Download and extract the ZIP, then open the extracted **`ayu-link2` project
folder** in VS Code (not the ZIP file and not the `frontend` subfolder). This
app needs both its API server and its frontend; opening `index.html` directly
or starting only the frontend leaves the patient and hospital data unavailable.

### First-time setup

Install Python 3.11+ and Node.js 20.19+ or 22.12+, then open a VS Code terminal
in the project root.

**Windows PowerShell:**

```bash
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
cd frontend
npm install
```

**macOS / Linux:**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm install
```

### Start both servers

In VS Code, choose **Terminal → Run Task… → AYU-LINK: Start development
servers**. It starts the API and frontend in separate terminals. Alternatively,
run these commands in two VS Code terminals from the project root:

**Windows PowerShell, API:**

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload
```

**macOS / Linux, API:**

```bash
.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload
```

**All platforms, frontend (second terminal):**

```bash
cd frontend
npm run dev
```

If starting the project with Copilot Chat, ask: **“Read the repository
instructions and README, install any missing dependencies, then run the
AYU-LINK development servers.”** The checked-in `.github/copilot-instructions.md`
and VS Code task describe the correct full-stack launch.

Wait until both terminals report that their server is ready, then open
**http://localhost:5173**. The frontend proxies API and live-update connections
to the local backend on port 8000. The backend defaults to demo mode and seeds
demo accounts on startup. Password for each account is `ayu12345`:

| Role | Email |
|---|---|
| Ambulance driver | `driver@ayu.test` |
| Ambulance staff | `staff@ayu.test` |
| Hospital staff | `hospital@ayu.test` |
| Doctor (read-only) | `doctor@ayu.test` |
| Administrator | `admin@ayu.test` |

## Firmware demo reader

The ESP32 sketch in [`firmware/rfid_esp32/rfid_esp32.ino`](./firmware/rfid_esp32/rfid_esp32.ino)
reads an MFRC522 card, converts the UID to uppercase hexadecimal with no
separators, and posts it to `POST /api/rfid/scans` with the ambulance
`X-Device-Key` header. The firmware also exposes a `UID_OVERRIDE` constant: when
it is non-empty, the board sends that literal string instead of the scanned UID.
This makes the seeded demo patient reachable without creating a fake UID-to-card
mapping in the firmware or database.

For the demo environment, set `DEVICE_KEY` to `dev-device-key-1` and `API_BASE`
to the backend URL reachable from the ESP32, such as `http://192.168.1.50:8000`.
Flash the board, open the serial monitor, and watch for `Card UID ...` plus the
HTTP response body. See [firmware/rfid_esp32/README.md](./firmware/rfid_esp32/README.md)
for the wiring, flashing, and serial-monitor instructions.

## Demonstrate the emergency handoff

1. Sign in as `driver@ayu.test`.
2. On the Ambulance dashboard, enter `CARD-1001` and select **Simulate RFID
   scan**. The demo resolves Ravi Kumar's patient details and creates or opens a
   case. Set an emergency category if known.
3. Select **City General** as the receiving hospital.
4. Record a voice note, preview it, then send it. Or send a short text update.
   The browser will request microphone permission when recording begins.
5. In another browser session, sign in as `hospital@ayu.test`. The case and
   new communication arrive in the Hospital dashboard; staff can play the
   recording, reply, acknowledge the emergency, and update preparation status.
   The ambulance crew can mark the vehicle as arrived; its movement status is
   shown separately from case acknowledgement.
6. Sign in as `doctor@ayu.test` to review the same hospital cases without
   write controls.

The browser recorder requires localhost or HTTPS and microphone permission.
The authenticated simulation endpoint is enabled only in `AYU_ENV=dev` or
`AYU_ENV=test`; the hardware-compatible `POST /api/rfid/scans` endpoint remains
available to an ESP32 using its `X-Device-Key`. RFID cards should contain only
UIDs, never patient data.

### If the page is empty or data does not load

- Check that **both** the API and frontend terminals are still running.
- Open `http://localhost:8000/api/health`; it should show `{"status":"ok"}`.
- Keep Vite on port 5173. If the task reports that port 5173 is already in use,
  stop the other development server and restart AYU-LINK rather than letting
  Vite silently move to another port.
- Do not use VS Code Live Server or open the HTML file directly; the Vite
  development server supplies the API proxy the app needs.
- Demo logins and patient cases are local to the API's SQLite database. Another
  computer running its own copy has its own separate demo data.

## Prototype configuration

- SQLite database: `AYU_DATABASE_URL` (defaults to `sqlite:///./ayu.db`).
- Audio storage: `AYU_STORAGE_DIR` (defaults to `backend/storage`, outside the
  frontend's public directory).
- JWT secret: `AYU_SECRET`; required outside `AYU_ENV=dev`.
- Frontend CORS origin: `AYU_CORS_ORIGIN` (defaults to localhost and
  127.0.0.1 on port 5173; comma-separated origins are supported).
- Frontend API base: `VITE_API_BASE` (leave unset to use the Vite development
  proxy).

Before any real-world use, replace demo credentials and local storage, deploy
behind HTTPS, configure production secrets and origins, and complete security,
privacy, clinical, operational, and accessibility reviews.

## Test

Backend:

```bash
cd backend
PYTHONPATH=. pytest -q
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```
