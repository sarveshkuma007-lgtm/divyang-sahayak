<div align="center">

# Divyang Sahayak

### Drishti · Vani · Sparsh

**Accessible experiences through vision, voice, and sensory interaction.**

An accessibility-focused web application bringing together camera-assisted scene understanding, spoken interaction, document assistance, and sensory controls. Divyang Sahayak is an evolving project: some modules are demonstrations or experiments, and should not be treated as validated assistive or safety systems.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-runtime-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-API-4285F4?logo=googlegemini&logoColor=white)](https://ai.google.dev/)

</div>

---

## Contents

- [Vision and problem](#vision-and-problem)
- [Features](#features)
- [Application screenshots](#application-screenshots)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment configuration](#environment-configuration)
- [Development, build, and production](#development-build-and-production)
- [Permissions and browser requirements](#permissions-and-browser-requirements)
- [Troubleshooting](#troubleshooting)
- [Privacy, safety, and known limitations](#privacy-safety-and-known-limitations)
- [Contributing](#contributing)
- [License](#license)

## Vision and problem

Everyday interfaces can be difficult to use when they depend on sight, sound, fine motor control, or complex navigation. Divyang Sahayak explores a single, configurable interface for several accessibility-oriented experiences: spoken feedback, camera-based assistance, readable document summaries, and optional haptic cues.

The project is intended as a learning and development platform for exploring inclusive technology. It is not a clinical product, a certified assistive device, or a substitute for accessible design research with people with disabilities.

## Features

### 🧭 Map and camera-assisted navigation

The navigation module combines an interactive Leaflet map, sample route guidance, spoken directions, haptic/audio cues, and optional camera-based scene analysis. The built-in routes are explicitly demonstrations; camera analysis may describe obstacles and provide rough estimates, not measured distances or validated walking directions.

### 🎧 Immersive sensory experience

The immersive module presents simulated sensory scenes with spoken prompts, directional audio cues, and optional vibration patterns. It is an interactive experience, not a virtual-reality headset integration or a substitute for environmental awareness.

### 💵 Camera-based currency estimate

The currency module can send a camera frame for Gemini analysis and announce a possible denomination using speech and haptics. Sample denominations are separately marked as demos. A model estimate does not verify a banknote's denomination or authenticity.

### 📄 Document scanning

Document images can be sent to the Gemini-backed API for text extraction, a simplified summary, and potential sensitive-content warnings. Treat both extracted text and privacy classifications as fallible.

### 🤟 Sign-language exploration

The sign-language interface includes AI-proposed text-to-gloss assistance and concept illustrations, alongside MediaPipe-based hand-gesture functionality. These outputs are not verified sign-language translations or authoritative instruction. Continuous sign-sequence recognition is experimental: its client service targets `/api/gemini/recognize-sign-sequence`, but that route is not implemented in the current `server.ts`.

### 🗣️ Voice, language, and AI assistance

The interface offers voice-command controls, speech output, and a Gemini-backed assistant. Language selection and speech recognition depend on browser support and locally available voices; they are not guaranteed to work identically across browsers or languages.

### 📞 Calls, messages, and device controls

The project contains a WebRTC calling interface and Express signaling endpoints. Signaling state is held in server memory and is lost when the server restarts. The accompanying messages UI identifies itself as a local demonstration rather than a connected messaging service. The hearing/Bluetooth area provides device-oriented controls, but actual hardware support depends on browser and device capabilities.

### 🎛️ Accessibility and emergency controls

The settings interface includes themes, brightness, contrast, font size, speech speed, language, and optional haptic feedback. An in-app SOS screen can request browser location, but the code does not establish a connection to an emergency response service.

## Application screenshots

The requested screenshot files—`screenshot 2.png` and `screenshot 2026-10-24 105929.png`—were not found in the checked-out repository. The existing `docs/images/` directory is empty, so this README intentionally does not include unverified image links.

To display the immersive sensory interface and currency detector screenshots, add the two PNG files to `docs/images/` (without changing their filenames); then this section can link to the verified relative paths.

## Technology stack

| Technology | Role in this repository |
|---|---|
| React 19 | Component-based browser interface. |
| TypeScript | Types for the UI, services, and Express application. |
| Vite 8 | Frontend development middleware and production asset build. |
| Node.js | Runtime for the Express server and tooling. |
| Express 4 | API endpoints, authentication routes, and frontend serving. |
| Google Gemini API (`@google/genai`) | Server-side assistant, scene, document, and sign-related generation requests. |
| MediaPipe Tasks Vision | Imported by the hand-gesture recognition service. |
| Leaflet | Imported by the interactive map component. |
| Tailwind CSS | Utility styling through the Tailwind Vite plugin. |
| Lucide React | Interface icons. |
| WebRTC browser APIs | Peer connection functionality in the calling interface; signaling is provided by the Express server. |
| ONNX Runtime Web | Present in `package.json`; no import/use was found in `src/` during this inspection. |
| Motion | Present in `package.json`; no import/use was found in `src/` during this inspection. |

## Architecture

```text
Browser
└── React + TypeScript interface
    ├── Feature components and browser APIs
    └── Frontend service modules
        └── same-origin /api/* requests
            └── Express server (server.ts)
                ├── Gemini API calls (GEMINI_API_KEY stays server-side)
                ├── Authentication routes (/api/auth)
                └── In-memory WebRTC signaling (/api/webrtc)

Development: Express mounts Vite in middleware mode.
Production:   Express serves the built dist/ directory when NODE_ENV=production.
```

The frontend service layer centralizes requests to the Gemini endpoints. Express initializes the Google GenAI client from `GEMINI_API_KEY`; the browser should not receive this key. In development, `server.ts` dynamically creates Vite with `middlewareMode: true` and mounts Vite's middleware on the Express app. In production mode, it serves static files from `dist/` and falls back to the SPA entry point.

## Project structure

```text
divyang-sahayak/
├── docs/
│   └── images/                 # Exists; currently contains no screenshots
├── src/
│   ├── components/             # Feature UI modules
│   ├── services/               # Gemini, speech, haptics, auth, and vision helpers
│   ├── App.tsx                 # Main application and module selection
│   ├── index.css               # Global styles
│   ├── main.tsx                # React entry point
│   └── types.ts                # Shared TypeScript types
├── .env.example                # Environment variable template
├── index.html                  # Vite HTML entry
├── metadata.json
├── package.json                # Dependencies and npm scripts
├── server.ts                   # Express API and Vite/static integration
├── server.ts.backup
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Prerequisites

- Git, to clone the repository.
- Node.js and npm versions compatible with the Vite version in `package.json`.
- A Google Gemini API key for Gemini-backed features.
- A modern browser. Camera, microphone, geolocation, speech recognition, vibration, and Web Bluetooth availability varies by browser and device.

## Installation

1. Clone the repository and enter its directory:

   ```bash
   git clone https://github.com/sarveshkuma007-lgtm/divyang-sahayak.git
   cd divyang-sahayak
   ```

2. Install the dependencies declared by the project:

   ```bash
   npm install
   ```

3. Copy the environment template to a local `.env` file (PowerShell):

   ```powershell
   Copy-Item .env.example .env
   ```

   On macOS/Linux, use `cp .env.example .env`.

4. Replace the template values as described in [Environment configuration](#environment-configuration).

5. Start the development server:

   ```bash
   npm run dev
   ```

   The Express server uses port `3000` by default. Open `http://localhost:3000`; set `PORT` to use another port.

## Environment configuration

The checked-in `.env.example` contains these entries:

| Variable | Required? | Purpose and current code usage |
|---|---|---|
| `GEMINI_API_KEY` | Required for Gemini-backed features | Read by `server.ts` and used to initialize the Gemini client. Replace the example placeholder with a key kept only in the server-side `.env` or deployment secret store. |
| `APP_URL` | Not currently read by the inspected application code | The template describes a hosted application URL for links/callbacks, but no usage of `APP_URL` was found in `server.ts` or `src/`. Setting it currently has no observed effect. |

Create `.env` in the project root and set the Gemini key, for example:

```env
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
```

`server.ts` loads environment values through `dotenv/config`. Do not commit `.env`, paste secrets into source files, or expose the Gemini key in frontend code.

The authentication routes also read optional variables that are not included in `.env.example`: `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `APP_LOGIN_EMAIL`, `APP_LOGIN_PASSWORD`, and `APP_ENROLLMENT_TOKEN`. Their defaults/configuration are defined in `src/services/authRoutes.ts`; passkey and account setup should be reviewed before deployment.

## Development, build, and production

| Command | Defined script | What it does |
|---|---|---|
| `npm run dev` | `tsx server.ts` | Runs the Express application with Vite mounted as development middleware. |
| `npm run build` | `vite build` | Builds the frontend assets into `dist/`; it does not compile a separate backend artifact. |
| `npm start` | `node server.ts` | Runs the server entry using Node. `server.ts` serves `dist/` only when `NODE_ENV=production`; otherwise it mounts Vite middleware. The script itself does not set `NODE_ENV`. |
| `npm run preview` | `vite preview` | Previews Vite's built frontend; it does not start the Express API server. |
| `npm run lint` | `tsc --noEmit` | Runs the TypeScript compiler without emitting files; this is not a dedicated test suite. |
| `npm run clean` | `rm -rf dist server.js` | Removes the named build/output paths. This is destructive and uses a Unix-style command; run only if intentional and supported by your shell. |

For a production-mode launch, build first and set `NODE_ENV=production` in the server environment. For example, in PowerShell:

```powershell
npm run build
$env:NODE_ENV = "production"
npm start
```

The declared start script runs `node server.ts` directly and does not define a backend compilation step. Confirm that the chosen Node.js runtime can execute this TypeScript/ESM entry and resolve its imports before relying on it for deployment. The repository does not document a deployment target or URL.

## Permissions and browser requirements

- **Camera:** Navigation, currency, and sign-related camera features need camera permission and browser `getUserMedia` support.
- **Microphone:** Calls and voice input need microphone permission; speech recognition availability is browser-dependent.
- **Location:** The map and SOS interface may request location permission. Location access generally requires HTTPS, except on localhost.
- **Secure context:** Camera and microphone access generally require HTTPS in deployed environments; `http://localhost` is commonly allowed for local development.
- **Haptics:** Vibration is optional and depends on device/browser support.
- **Web Bluetooth:** Browser and hardware support varies; the device interface does not guarantee hearing-aid integration.
- **Network access:** Gemini-backed features require server connectivity and a valid API key. Map tiles, routing, and browser speech services may also rely on external providers.

If permission is denied, use the available on-screen controls where possible; the related feature may remain unavailable.

## Troubleshooting

| Symptom | Checks |
|---|---|
| Gemini request reports a missing key | Confirm `.env` is in the project root, `GEMINI_API_KEY` has a valid value, and restart the server after changing it. Keep the key out of client-side code. |
| Gemini request fails or is rate-limited | Check network access, API key validity, provider access/quota, and the server terminal for the returned error. |
| Camera or microphone does not start | Use localhost or HTTPS, allow the browser permission, check that another application is not holding the device, and verify browser support for the required API. |
| Voice recognition is unavailable | Speech recognition is not implemented consistently across browsers. Try a supported browser or use the on-screen controls. |
| Map tiles or route information do not load | Check internet access and browser console errors. The map depends on external map/routing services. |
| Sign-sequence recognition returns not found | The client service targets `/api/gemini/recognize-sign-sequence`, which currently has no matching route in `server.ts`. |
| Production launch fails | Build the frontend, set `NODE_ENV=production`, check `PORT`, and verify the runtime supports the declared `node server.ts` entry and its imports. |

## Privacy, safety, and known limitations

- Camera images and document content submitted to AI features are sent to the configured backend and Gemini API. Do not submit sensitive material unless you have reviewed applicable provider terms and have permission to process it.
- Keep API keys and authentication secrets server-side. The included authentication and WebRTC signaling state is stored in memory; it is not durable across restarts and is not a production database.
- **AI obstacle descriptions and distance estimates can be inaccurate.** They are not a measured distance, guaranteed hazard detection, or navigation instruction. Never rely on them as the user's only source of real-world safety guidance; use established mobility aids, trusted assistance, and independent judgment.
- Currency analysis is an AI estimate, not a banknote authenticity check. Demo selections are not camera detections.
- AI-generated sign glosses and illustrations are not verified sign-language translations. Do not use them as authoritative sign-language teaching material or as a substitute for fluent signers.
- Sample routes, transit controls, and some device/message interfaces are demonstrations. WebRTC and Bluetooth behavior depends on runtime, network, and supported hardware.
- The SOS interface is not an emergency dispatch service. Contact local emergency services directly when needed.
- This repository does not contain a `LICENSE` file. Reuse and redistribution permissions are therefore not granted by this README; contact the repository owner.

## Contributing

Contributions that improve usability, accessibility, reliability, and documentation are welcome. As this is a shared project, coordinate with the repository owner before making changes that affect shared direction or deployment.

1. Discuss a substantial change with the maintainers before starting.
2. Create a focused branch and keep changes scoped.
3. Avoid committing `.env` files, API keys, personal data, or generated sensitive content.
4. Describe the user impact and any browser/device limitations in your pull request.
5. Run the relevant project checks (the current `lint` script is `tsc --noEmit`) and report what you did and did not verify.
6. For accessibility changes, include keyboard/screen-reader considerations and test with the relevant assistive technology where possible.

## License

No license file was present in the inspected repository. Please contact the repository owner for permission before reusing, modifying, or redistributing this project.

---

<div align="center">

### Building toward more accessible digital experiences.

**Divyang Sahayak · Drishti · Vani · Sparsh**

</div>

