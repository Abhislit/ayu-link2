# Running AYU-LINK locally

When asked to run or launch this project, treat it as a full-stack app: the
React frontend needs the FastAPI backend for patient, hospital, message, and
live-update data.

1. Use the repository root as the VS Code workspace and check `README.md`.
   A GitHub URL pasted into Copilot Chat is not a running workspace; open the
   repository in Codespaces or clone/download and open its folder in VS Code.
2. If dependencies are missing, create the root `.venv`, install
   `backend/requirements.txt` into it, and run `npm install` in `frontend/`.
   Use `py -3` and `.venv\Scripts\python.exe` on Windows, or `python3` and
   `.venv/bin/python` on macOS/Linux.
3. Start the `AYU-LINK: Start development servers` VS Code task. It runs the
   API and Vite frontend together. Do not start only Vite, use VS Code Live
   Server, or open `frontend/index.html` directly.
4. Open `http://localhost:5173` in the user's browser. Keep the frontend on
   port 5173; its Vite proxy sends `/api` and `/socket.io` to the backend on
   port 8000. If that port is occupied, identify and stop only the conflicting
   AYU-LINK development server before restarting.
5. Confirm `http://localhost:8000/api/health` returns `{"status":"ok"}` and
   that the frontend loads before reporting the app is running.

The local demo password is `ayu12345`. Demo users and case data live in the
local SQLite database; separate computers do not share their data.
