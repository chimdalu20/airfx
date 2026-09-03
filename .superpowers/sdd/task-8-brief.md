### Task 8: App shell, Start gate, mic passthrough + limiter

> Browser task â€” verified by running the app (Web Audio cannot be unit-tested in Node). Use **headphones**.

**Files:**
- Create: `index.html`, `styles.css`, `src/audio/reverb-ir.js`, `src/audio/audio-engine.js`, `src/main.js`

**Interfaces:**
- Produces:
  - `generateImpulseResponse(ctx, {seconds, decay}) â†’ AudioBuffer`.
  - `createAudioEngine(ctx, stream) â†’ { apply(snapshot), recorderStream, panic(), unmute(), monitorStream }`.
- Consumes: `PARAM` (Task 6 config). `apply` consumes a `Snapshot` (Task 6).

- [ ] **Step 1: Create `src/audio/reverb-ir.js`**

```js
export function generateImpulseResponse(ctx, { seconds = 2.0, decay = 2.5 } = {}) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const ir = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return ir;
}
```

- [ ] **Step 2: Create `src/audio/audio-engine.js`**

```js
import { PARAM } from '../config.js';
import { generateImpulseResponse } from './reverb-ir.js';

export function createAudioEngine(ctx, stream) {
  const source = ctx.createMediaStreamSource(stream);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 12000;
  filter.Q.value = 1.0;

  // Tremolo: LFO -> depthGain -> tremGain.gain; base gain centers the swing.
  const tremGain = ctx.createGain();
  tremGain.gain.value = 1.0;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 5;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(tremGain.gain);
  lfo.start();

  // Delay with feedback.
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0;

  // Reverb (fixed IR; wet gain is the live control).
  const convolver = ctx.createConvolver();
  convolver.buffer = generateImpulseResponse(ctx, { seconds: 2.0, decay: 2.5 });
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;

  const dry = ctx.createGain();
  dry.gain.value = 1.0;

  const master = ctx.createGain();
  master.gain.value = 1.0;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  const dest = ctx.createMediaStreamDestination();

  // Routing: source -> filter -> tremGain -> {dry, delay, reverb} -> master -> limiter -> out + recorder
  source.connect(filter);
  filter.connect(tremGain);
  tremGain.connect(dry).connect(master);
  tremGain.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(delayWet).connect(master);
  tremGain.connect(convolver).connect(reverbWet).connect(master);
  master.connect(limiter);
  limiter.connect(ctx.destination);
  limiter.connect(dest);

  const tc = PARAM.timeConstant;

  function apply(snap) {
    const t = ctx.currentTime;
    filter.frequency.setTargetAtTime(snap.filter.cutoff, t, tc);
    filter.Q.setTargetAtTime(snap.filter.q, t, tc);
    reverbWet.gain.setTargetAtTime(snap.reverb.active ? snap.reverb.wet : 0, t, tc);
    delay.delayTime.setTargetAtTime(snap.delay.time, t, tc);
    delayWet.gain.setTargetAtTime(snap.delay.active ? snap.delay.mix : 0, t, tc);
    feedback.gain.setTargetAtTime(snap.delay.active ? Math.min(snap.delay.feedback, 0.89) : 0, t, tc);
    lfo.frequency.setTargetAtTime(snap.tremolo.rate, t, tc);
    const depth = snap.tremolo.active ? snap.tremolo.depth : 0;
    lfoDepth.gain.setTargetAtTime(depth / 2, t, tc);
    tremGain.gain.setTargetAtTime(1 - depth / 2, t, tc);
  }

  function panic() { master.gain.setTargetAtTime(0, ctx.currentTime, 0.01); }
  function unmute() { master.gain.setTargetAtTime(1, ctx.currentTime, 0.05); }

  return { apply, panic, unmute, recorderStream: dest.stream };
}
```

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AirFX â€” Hand-Gesture Voice Effects</title>
  <link rel="stylesheet" href="styles.css" />
  <script type="importmap">
  { "imports": { "@mediapipe/tasks-vision": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs" } }
  </script>
</head>
<body>
  <header>
    <h1>AirFX</h1>
    <div id="warn" class="warn">ðŸŽ§ Use headphones â€” speakers cause feedback howl.</div>
  </header>

  <div id="startScreen" class="overlay">
    <button id="startBtn">Start (allow camera + mic)</button>
    <p id="startError" class="error" hidden></p>
  </div>

  <main id="app" hidden>
    <section class="stage">
      <video id="video" playsinline muted></video>
      <canvas id="overlay"></canvas>
    </section>
    <aside class="side">
      <div id="meters"></div>
      <div id="rack"></div>
      <div class="actions">
        <button id="calibrateBtn">Calibrate</button>
        <button id="recordBtn">â— Record</button>
        <button id="panicBtn" class="danger">Mute</button>
      </div>
    </aside>
  </main>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `styles.css`**

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #14151a; color: #e8e8ea; }
header { display: flex; gap: 1rem; align-items: center; padding: .6rem 1rem; flex-wrap: wrap; }
h1 { font-size: 1.1rem; margin: 0; }
.warn { background: #5a4500; color: #ffe08a; padding: .3rem .6rem; border-radius: 6px; font-size: .85rem; }
.overlay { position: fixed; inset: 0; display: grid; place-content: center; background: #14151a; z-index: 10; }
#startBtn { font-size: 1.1rem; padding: .8rem 1.4rem; border: 0; border-radius: 10px; background: #4f7cff; color: #fff; cursor: pointer; }
.error { color: #ff8a8a; }
main { display: flex; gap: 1rem; padding: 1rem; flex-wrap: wrap; }
.stage { position: relative; flex: 1 1 480px; min-width: 0; }
video, #overlay { width: 100%; height: auto; border-radius: 10px; transform: scaleX(-1); display: block; }
#overlay { position: absolute; inset: 0; }
.side { flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
#rack { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: .8rem; }
.fx { background: #1e2027; border-radius: 10px; padding: .8rem; opacity: .45; transition: opacity .15s; }
.fx.active { opacity: 1; outline: 1px solid #4f7cff; }
.fx h3 { margin: 0 0 .5rem; font-size: .9rem; }
.knobs { display: flex; gap: .8rem; flex-wrap: wrap; }
.knob { text-align: center; font-size: .7rem; }
.dial { width: 52px; height: 52px; border-radius: 50%; background: #2b2e38; position: relative; margin: 0 auto .25rem; }
.dial::after { content: ""; position: absolute; left: 50%; top: 6px; width: 3px; height: 18px; background: #8fb0ff; transform-origin: 50% 20px; transform: translateX(-50%) rotate(0deg); }
.actions { display: flex; gap: .5rem; flex-wrap: wrap; }
button { background: #2b2e38; color: #e8e8ea; border: 0; border-radius: 8px; padding: .5rem .8rem; cursor: pointer; }
button.danger { background: #6a2330; }
#meters { font-size: .8rem; line-height: 1.5; background: #1e2027; border-radius: 10px; padding: .6rem; }
```

- [ ] **Step 5: Create `src/main.js` (Start gate + mic passthrough only for now)**

```js
import { createAudioEngine } from './audio/audio-engine.js';

const startBtn = document.getElementById('startBtn');
const startError = document.getElementById('startError');

async function start() {
  startError.hidden = true;
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    await ctx.resume();
    const engine = createAudioEngine(ctx, audioStream);
    // Idle passthrough: filter open, no effects.
    engine.apply({
      filter: { cutoff: 12000, q: 1 },
      reverb: { wet: 0, active: false },
      delay: { mix: 0, time: 0.28, feedback: 0, active: false },
      tremolo: { rate: 5, depth: 0, active: false },
    });
    document.getElementById('startScreen').hidden = true;
    document.getElementById('app').hidden = false;
    window.__airfx = { ctx, engine }; // dev handle for next tasks
    const settings = audioStream.getAudioTracks()[0].getSettings();
    console.log('mic settings (verify AEC/NS/AGC off):', settings);
  } catch (e) {
    startError.hidden = false;
    startError.textContent = `Could not start: ${e.name} â€” ${e.message}`;
  }
}

startBtn.addEventListener('click', start);
```

- [ ] **Step 6: Run the app and verify (manual)**

Run: `npm run serve` then open `http://localhost:8000` in Chrome **with headphones on**.
Expected:
- Click **Start** â†’ browser prompts for microphone.
- After allowing, you hear your own voice through the headphones (passthrough), no howl.
- Console logs `mic settings` with `echoCancellation:false` (or a note if the platform refused).
- No console errors.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css src/audio/reverb-ir.js src/audio/audio-engine.js src/main.js
git commit -m "feat: app shell, Start gate, mic passthrough with limiter"
```

---

