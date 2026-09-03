### Task 13: Calibration UI + persistence

> Browser-only.

**Files:**
- Create: `src/calibration/calibration-ui.js`
- Modify: `src/main.js` (load saved profile on start; wire Calibrate button)

**Interfaces:**
- Produces:
  - `loadProfile() â†’ profile|null`, `saveProfile(profile)` (localStorage key `airfx.calibration`).
  - `runCalibration({ getLatestRaw }) â†’ Promise<profile>` â€” guided 4-step capture (near/far size, low/high height) per hand using the latest raw observation.
- Consumes: `DEFAULT_PROFILE` (Task 5).

- [ ] **Step 1: Implement `src/calibration/calibration-ui.js`**

```js
import { DEFAULT_PROFILE } from './profile.js';

const KEY = 'airfx.calibration';

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveProfile(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

// getLatestRaw() must return the most recent RawFrame.
export async function runCalibration({ getLatestRaw }) {
  const profile = structuredClone(DEFAULT_PROFILE);
  const steps = [
    ['Hold your LEFT hand CLOSE, then click OK', 'left', 'size', 'sizeNear'],
    ['Hold your LEFT hand FAR, then click OK', 'left', 'size', 'sizeFar'],
    ['Raise your LEFT hand HIGH, then click OK', 'left', 'height', 'heightHigh'],
    ['Lower your LEFT hand LOW, then click OK', 'left', 'height', 'heightLow'],
    ['Hold your RIGHT hand CLOSE, then click OK', 'right', 'size', 'sizeNear'],
    ['Hold your RIGHT hand FAR, then click OK', 'right', 'size', 'sizeFar'],
    ['Raise your RIGHT hand HIGH, then click OK', 'right', 'height', 'heightHigh'],
    ['Lower your RIGHT hand LOW, then click OK', 'right', 'height', 'heightLow'],
  ];
  for (const [prompt, side, field, target] of steps) {
    // eslint-disable-next-line no-alert
    window.alert(prompt);
    const raw = getLatestRaw();
    const obs = raw?.[side];
    if (obs) profile[side][target] = obs[field];
  }
  saveProfile(profile);
  return profile;
}
```

- [ ] **Step 2: Wire it into `src/main.js`**

Add the import at the top:

```js
import { loadProfile, saveProfile, runCalibration } from './calibration/calibration-ui.js';
```

In `start()`, after `await camera.init();`, load any saved profile and track the latest frame:

```js
    const saved = loadProfile();
    if (saved) profile = saved;
    let latestRaw = null;
```

Inside the `camera.start((frame) => { ... })` callback, set `latestRaw = frame;` as the first line. Then after wiring the panic button, add:

```js
    document.getElementById('calibrateBtn').addEventListener('click', async () => {
      profile = await runCalibration({ getLatestRaw: () => latestRaw });
    });
```

- [ ] **Step 3: Verify (manual)**

Run the app, click **Calibrate**, follow the 8 prompts moving your hands as instructed.
Expected: after calibration, distance/height controls use your personal range (reach full reverb at your "far", full filter at your "high"). Reload the page â†’ calibration persists (no re-calibration needed).

- [ ] **Step 4: Commit**

```bash
git add src/calibration/calibration-ui.js src/main.js
git commit -m "feat: guided calibration + localStorage persistence"
```

---

