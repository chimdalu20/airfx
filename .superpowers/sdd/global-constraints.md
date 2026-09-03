## Global Constraints

Every task implicitly includes these (values copied from the spec):

- **No build step / no framework.** Plain ES modules loaded via `<script type="module">` and an importmap. Dependencies via CDN in dev; self-host MediaPipe model + WASM for production.
- **Library versions (pin exactly):** `@mediapipe/tasks-vision@0.10.35`. Avoid deprecated `@mediapipe/hands` and the stale TF.js hand-pose wrapper.
- **Hand tracking config:** `HandLandmarker`, `delegate: 'GPU'`, `runningMode: 'VIDEO'`, `numHands: 2`.
- **Audio:** native Web Audio nodes only (no AudioWorklet, no `ScriptProcessorNode`). Apply every parameter change via `AudioParam.setTargetAtTime` (never assign `.value` per frame).
- **Mic constraints:** request `{ echoCancellation:false, noiseSuppression:false, autoGainControl:false }` and verify with `track.getSettings()`.
- **Safety:** master limiter (DynamicsCompressor) + panic-mute; headphone-use warning; clamp delay feedback < 0.9.
- **Platform:** desktop-first (Chrome/Edge primary). Window-resize-safe; not phone-tuned. Secure context required (`localhost` for dev, HTTPS for prod).
- **UX model:** every gesture mapping is a continuous *sweep*, not a tight trigger (latency ~40â€“100 ms audio, ~80â€“200 ms gestureâ†’sound).
- **Tooling:** Node 18+ (for `node --test`). Run tests with `npm test`. Run the app with `npm run serve` then open `http://localhost:8000`.
- **Commits:** end every commit message with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (omitted from the short commands below for brevity â€” add it).

