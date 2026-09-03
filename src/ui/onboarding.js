// First-run guided tour. Mirrors the real flow (calibrate -> load -> left hand -> right
// hand -> toggle), one job per step, with a spotlight on the element in question, a
// spotlight on the real control, voice narration, Next/Back/Skip on every step, and a
// phase-jump. Idempotent: only sets `airfx.onboarded`; never touches audio/profile state.

export const STEPS = [
  { phase: 'Welcome', title: '👋 Meet AirFX', body: 'Play the built-in loop (or your own track) and bend its sound with your hands in the air — like conducting effects. About 30 seconds to set up.', say: 'Welcome to AirFX. Play the built in loop, or your own track, and shape its sound with your hands in the air. This quick tour will get you set up.' },

  { phase: 'Calibrate', title: 'First, your reach', body: 'I’ll learn how high and low your hands go, so lifting a hand means “more effect.”', target: '#calibrateBtn', say: "First, let's set your reach, so lifting a hand means more effect." },
  { phase: 'Calibrate', title: 'Calibrate now', body: 'You’ll reach each open hand up, then down. The camera stays visible — watch the line follow your hand.', target: '#calibrateBtn', cta: 'Start calibration', action: 'calibrate', say: 'Tap start calibration. Then move each open hand high, then low, following the guide.' },
  { phase: 'Calibrate', title: 'Range locked in ✓', body: 'Now you only need to reach about three-quarters of the way up for the full effect.', say: 'Great. Your range is set. Now you only need to reach about three quarters of the way up for the full effect.' },

  { phase: 'Track', title: 'Load some music', body: 'Tap Play demo loop — or Upload a track and pick any audio file. Either one loops so you can keep jamming.', target: '.track-actions', say: 'Tap play demo loop, or upload a track of your own. Either one loops, so you can keep jamming.' },
  { phase: 'Track', title: '🎵 Now it’s live', body: 'Everything you hear from here on is shaped by your hands in real time.', target: '.transport', say: 'Nice. Everything you hear now is shaped by your hands, in real time.' },

  { phase: 'Left hand', title: 'Left hand = tone', body: 'Your LEFT hand runs Filter, Reverb and Delay — these three cards on the left.', target: '.col-left', say: 'Your left hand controls filter, reverb, and delay. The three cards on the left.' },
  { phase: 'Left hand', title: 'Lift your left hand', body: 'Open your left hand on the LEFT of the view and slowly raise it.', target: '.stage', say: 'Open your left hand on the left of the view, and slowly raise it.' },
  { phase: 'Left hand', title: 'Hear it open up?', body: 'The arcs fill as you rise and settle as you lower — that’s all you, live.', target: '.col-left', say: 'Hear it open up? The effects swell as you rise, and settle as you lower.' },

  { phase: 'Right hand', title: 'Right hand = tremolo', body: 'Open your RIGHT hand on the right and raise it for a pulsing wobble.', target: '.stage', say: 'Now your right hand. Open it on the right, and raise it for a pulsing tremolo.' },
  { phase: 'Right hand', title: 'That pulse is tremolo', body: 'The higher you go, the faster and deeper it pulses.', target: '.col-right', say: "That's tremolo. The higher you go, the faster and deeper it pulses." },

  { phase: 'Toggle', title: 'Switching effects off', body: 'All five start ON. Tap any effect card to switch it OFF — that is how you drop reverb or delay out of the mix. Tap again to bring it back.', target: '.col-left .fx', say: 'All five effects start on. Tap any effect card to switch it off, and tap again to bring it back. That is how you drop an effect out of the mix.' },

  { phase: 'Modes', title: 'Two ways to play', body: 'Air is what you have been doing: your hand HEIGHT drives every armed effect at once, like conducting. Grab is the fine version — one knob at a time, set exactly where you want it.', target: '.modes', say: 'There are two ways to play. Air is what you have been doing: hand height drives every armed effect at once. Grab is the fine version, one knob at a time.' },
  { phase: 'Modes', title: 'How Grab works', body: 'Tap Grab and a ring appears for each hand, following your index fingertip. Put a ring over a knob, pinch thumb and finger together to take hold, then move to turn it. Release to let go — the knob stays where you left it.', target: '#modeGrab', say: 'Tap grab, and a ring appears for each hand, following your index finger. Put a ring over a knob, pinch your thumb and finger together to take hold, then move to turn it. Release, and the knob stays where you left it.' },
  { phase: 'Modes', title: 'Grab arms as you go', body: 'Grabbing a knob switches that effect on automatically, so you can pull an effect back into the mix just by reaching for it. Tap Air to go back to whole-hand control.', target: '#modeAir', say: 'Grabbing a knob switches that effect on automatically. Tap air to go back to whole hand control.' },

  { phase: 'Presets', title: 'Presets set the ceiling', body: 'Subtle, Lush and Extreme change how FAR the effects can go at full reach — the same gesture goes further on Extreme. Lush is the default.', target: '#preset', say: 'Presets set the ceiling. Subtle, lush and extreme change how far the effects go at full reach. The same gesture goes further on extreme.' },

  { phase: 'Record', title: 'Record a take', body: 'Record captures the processed audio — effects and all, exactly as you hear it. Press it again to stop and the file downloads on its own.', target: '#recordBtn', say: 'Record captures the processed audio, effects and all, exactly as you hear it. Press it again to stop, and the file downloads on its own.' },

  { phase: 'Mute', title: 'Mute is your panic button', body: 'Mute silences the output instantly if a sound gets away from you — a runaway delay, say. It stays lit while muted; press it again to bring the sound back.', target: '#panicBtn', say: 'Mute silences everything instantly if a sound gets away from you. It stays lit while muted. Press it again to bring the sound back.' },
  { phase: 'Mute', title: 'Recalibrate anytime', body: 'Moved your chair, or someone else wants a go? Tap Calibrate to redo your reach — it takes about fifteen seconds.', target: '#calibrateBtn', say: 'Moved your chair, or someone else wants a go? Tap calibrate to redo your reach. It takes about fifteen seconds.' },

  { phase: 'Done', title: 'You’re ready 🎚️', body: 'Tap “Tour” in the header to replay this anytime. Headphones are worth it.', last: true, say: "You're all set. Tap tour in the header to replay this anytime. Headphones are worth it. Have fun." },
];

const FLAG = 'airfx.onboarded';
const NOVOICE = { speak() {}, cancel() {}, isEnabled: () => false, setEnabled() {}, supported: false };

export function createOnboarding({ onCalibrate, voice = NOVOICE } = {}) {
  let root = null;
  let i = 0;
  const phases = [...new Set(STEPS.map((s) => s.phase))];
  const firstIndexOf = (phase) => STEPS.findIndex((s) => s.phase === phase);

  function build() {
    root = document.createElement('div');
    root.className = 'ob-root';
    root.innerHTML = `
      <div class="ob-spot"></div>
      <div class="ob-card">
        <button class="ob-voice" title="Narration on/off"></button>
        <div class="ob-dots"></div>
        <h3 class="ob-title"></h3>
        <p class="ob-body"></p>
        <div class="ob-cta"></div>
        <div class="ob-nav">
          <button class="ob-back ghost">Back</button>
          <button class="ob-next">Next</button>
        </div>
        <button class="ob-exit ghost">Skip tour</button>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.ob-back').addEventListener('click', () => go(i - 1));
    root.querySelector('.ob-next').addEventListener('click', () => (STEPS[i].last ? finish() : go(i + 1)));
    root.querySelector('.ob-exit').addEventListener('click', finish);
    root.querySelector('.ob-voice').addEventListener('click', () => {
      voice.setEnabled(!voice.isEnabled());
      renderVoiceBtn();
      if (voice.isEnabled()) voice.speak(STEPS[i].say || STEPS[i].body);
      else voice.cancel();
    });
    const dots = root.querySelector('.ob-dots');
    phases.forEach((p) => {
      const d = document.createElement('button');
      d.className = 'ob-dot';
      d.title = p;
      d.addEventListener('click', () => go(firstIndexOf(p)));
      dots.appendChild(d);
    });
    window.addEventListener('resize', reposition);
  }

  function renderVoiceBtn() {
    const b = root.querySelector('.ob-voice');
    if (!voice.supported) { b.hidden = true; return; }
    b.textContent = voice.isEnabled() ? '🔊' : '🔇';
  }

  function spotlight(rect) {
    const spot = root.querySelector('.ob-spot');
    if (!rect) { spot.style.cssText = 'left:50%;top:50%;width:0;height:0;'; return; }
    const pad = 8;
    spot.style.cssText = `left:${rect.left - pad}px;top:${rect.top - pad}px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px;`;
  }

  function placeCard(rect) {
    const card = root.querySelector('.ob-card');
    if (!rect) { card.style.left = '50%'; card.style.top = '50%'; card.style.transform = 'translate(-50%,-50%)'; return; }
    card.style.transform = 'none';
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const m = 12;
    let top = rect.bottom + m;
    if (top + ch > window.innerHeight - m) top = rect.top - ch - m; // flip above the target
    top = Math.max(m, Math.min(top, window.innerHeight - ch - m));
    let left = rect.left + rect.width / 2 - cw / 2;
    left = Math.max(m, Math.min(left, window.innerWidth - cw - m));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function render() {
    const s = STEPS[i];
    root.querySelector('.ob-title').textContent = s.title;
    root.querySelector('.ob-body').textContent = s.body;
    root.querySelector('.ob-back').disabled = i === 0;
    root.querySelector('.ob-next').textContent = s.last ? 'Finish' : 'Next';
    root.querySelectorAll('.ob-dot').forEach((d, n) => d.classList.toggle('on', phases[n] === s.phase));
    renderVoiceBtn();

    const cta = root.querySelector('.ob-cta');
    cta.innerHTML = '';
    if (s.cta) {
      const b = document.createElement('button');
      b.className = 'ob-ctabtn';
      b.textContent = s.cta;
      b.addEventListener('click', () => runAction(s));
      cta.appendChild(b);
    }
    reposition();
    voice.speak(s.say || s.body);
  }

  function reposition() {
    if (!root) return;
    const s = STEPS[i];
    const el = s.target ? document.querySelector(s.target) : null;
    const rect = el ? el.getBoundingClientRect() : null;
    spotlight(rect);
    placeCard(rect);
  }

  async function runAction(s) {
    if (s.action === 'calibrate' && onCalibrate) {
      voice.cancel();
      root.style.display = 'none'; // step aside so the calibration overlay is unobstructed
      try { await onCalibrate(); } finally { root.style.display = ''; }
      go(i + 1);
    }
  }

  function go(n) {
    i = Math.max(0, Math.min(STEPS.length - 1, n));
    render();
  }

  function finish() {
    voice.cancel();
    localStorage.setItem(FLAG, '1');
    if (root) { window.removeEventListener('resize', reposition); root.remove(); root = null; }
  }

  function start() {
    if (root) finish();
    build();
    go(0);
  }

  return { start, isFirstRun: () => !localStorage.getItem(FLAG) };
}
