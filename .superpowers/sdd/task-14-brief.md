### Task 14: Recording / export

> Browser-only.

**Files:**
- Create: `src/audio/recorder.js`
- Modify: `src/main.js` (wire Record button)

**Interfaces:**
- Produces: `createRecorder(stream) â†’ { start(), stop()â†’Promise<Blob>, active }`.
- Consumes: `engine.recorderStream` (Task 8).

- [ ] **Step 1: Implement `src/audio/recorder.js`**

```js
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

export function createRecorder(stream) {
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  let rec = null;
  let chunks = [];
  return {
    start() {
      chunks = [];
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.start();
    },
    stop() {
      return new Promise((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
        rec.stop();
      });
    },
    get active() { return !!rec && rec.state === 'recording'; },
  };
}
```

- [ ] **Step 2: Wire it into `src/main.js`**

Add the import:

```js
import { createRecorder } from './audio/recorder.js';
```

In `start()`, after creating the engine, add and wire the button:

```js
    const recorder = createRecorder(engine.recorderStream);
    const recordBtn = document.getElementById('recordBtn');
    recordBtn.addEventListener('click', async () => {
      if (!recorder.active) {
        recorder.start();
        recordBtn.textContent = 'â–  Stop';
        recordBtn.classList.add('danger');
      } else {
        const blob = await recorder.stop();
        recordBtn.textContent = 'â— Record';
        recordBtn.classList.remove('danger');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `airfx-take.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
```

- [ ] **Step 3: Verify (manual)**

Run the app, click **â— Record**, sing with effects, click **â–  Stop**.
Expected: a `.webm` (or `.mp4` on Safari) downloads containing the **processed** voice.

- [ ] **Step 4: Commit**

```bash
git add src/audio/recorder.js src/main.js
git commit -m "feat: record + export processed audio"
```

---

