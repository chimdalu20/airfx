### Task 15: Robustness â€” permissions, secure context, lost-tracking hold, low-FPS, mic verification

> Browser-only hardening.

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add a secure-context + API guard at the top of `start()`**

```js
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera/mic need HTTPS or localhost. Serve over a secure origin.');
    }
```

- [ ] **Step 2: Verify mic constraints actually applied (warn if not)**

After getting `audioStream`, add:

```js
    const ms = audioStream.getAudioTracks()[0].getSettings();
    if (ms.echoCancellation || ms.noiseSuppression || ms.autoGainControl) {
      document.getElementById('warn').textContent =
        'ðŸŽ§ Use headphones. (Browser kept echo/noise processing on â€” headphones still fix it.)';
    }
```

- [ ] **Step 3: Add an FPS counter + graceful note**

In the `camera.start` callback, append:

```js
      // FPS sampling
      window.__airfx_fps = window.__airfx_fps || { last: frame.tMs, n: 0, fps: 0 };
      const F = window.__airfx_fps;
      F.n++;
      if (frame.tMs - F.last > 1000) { F.fps = F.n; F.n = 0; F.last = frame.tMs; if (F.fps < 15) console.warn('Low FPS:', F.fps); }
```

- [ ] **Step 4: Confirm lost-tracking hold already works**

Note (no code change): `makeHandPipeline` keeps `lastNorm` when `obs` is null and the presence hysteresis flips `present` to false after the exit threshold, so a hand leaving frame holds its last continuous values and the effect's `active` flag drops cleanly â€” no snap. Verify by moving a hand out of frame: the knob holds, the effect group dims.

- [ ] **Step 5: Verify (manual)**

- Deny the mic permission â†’ a clear error appears on the Start screen (not a silent failure).
- Serve over a LAN IP via plain HTTP â†’ the secure-context error appears.
- Move a hand out of frame â†’ its effect dims, knob holds, no audio jump.

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat: robustness (secure context, mic verify, lost-tracking hold, FPS)"
```

---

