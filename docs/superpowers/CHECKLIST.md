# AirFX – On-Hardware Verification Checklist

Run before calling a release done (desktop Chrome/Edge, headphones on):

- [ ] Start gate: click Start → camera + mic prompts → app shows, voice passes through clean (no howl).
- [ ] Latency feels like an expressive sweep, not a tight trigger (expected; ~80–200 ms gesture→sound).
- [ ] Left 1 finger → reverb engages + knob lights/moves. 2 fingers → delay engages too.
- [ ] Left hand height sweeps the Filter cutoff knob audibly (bright↔dark).
- [ ] Left hand distance changes reverb amount (further = wetter).
- [ ] Right hand present → tremolo; height = rate, distance = depth; wobble audible.
- [ ] Calibrate flow improves reach; persists across reload.
- [ ] Record → Stop downloads the processed take; it plays back with effects.
- [ ] Mute (panic) silences instantly.
- [ ] Hand leaves frame → effect dims, knob holds, no audio jump.
- [ ] Lighting: works in bright even light; degrades gracefully in dim light (no crash).
- [ ] Low-end laptop: FPS ≥ ~20, audio stays glitch-free; console shows no errors.
- [ ] Production: served over HTTPS; MediaPipe model + WASM self-hosted; version pinned to 0.10.35.
