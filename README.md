# ZENITH + FSOC Virtual Testbed

This is a **single React + Vite application** containing the ZENITH landing/mode-selection experience and the FSOC Virtual Testbed. They are served from the **same localhost server and same origin**.

## Communication flow

- `/` — ZENITH landing page
- `/mode-select` — choose Ground→Ground, Ground→Space, or Space→Space
- `/dashboard` — routing bridge that sends the selected mode into the real simulator
- `/d1` — Dashboard 1: Ground-to-Ground FSOC, PAT & adaptive routing
- `/d2` — Dashboard 2: Ground/Space and Space/Space simulation
- `/d3` — Dashboard 3: intelligence, diagnosis, prediction and mitigation
- `/overview`, `/runs`, `/testcases`, `/architecture`, `/settings` — FSOC testbed pages

### Intended mode routing

```text
ZENITH
  ↓
SELECT COMMUNICATION MODE
  ├── Ground → Ground  → /d1
  ├── Ground → Space   → /d2
  └── Space → Space    → /d2
```

The FSOC simulation keeps injected disturbance ground truth separate from the intelligence layer. D3 works from observable telemetry rather than being directly handed the injected disturbance label.

## Run locally

Open a terminal **inside the `zenith` folder** and run:

```bash
npm install
npm run dev
```

Then open the localhost URL printed by Vite (normally `http://localhost:5173/`).

## If an older Vite server is already running

Stop the old server with `Ctrl+C` first. Then, from this project's `zenith` folder:

```bash
rmdir /s /q node_modules 2>nul
npm install
npm run dev
```

On PowerShell, the equivalent cleanup is:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install
npm run dev
```

Do not open `index.html` directly with `file://`; this is a Vite application and must be started with `npm run dev`.

## Production build

```bash
npm run build
npm run preview
```
