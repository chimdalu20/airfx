// Free, zero-dependency narration via the browser's built-in Web Speech API.
// Picks the most natural English voice the OS/browser exposes (prefers the modern
// "Natural"/neural voices, then Google/Samantha-class, else the default).

const NATURAL = [
  'natural', 'neural', 'aria', 'jenny', 'libby', 'sonia', 'michelle', 'ava', 'jane',
  'google', 'samantha', 'siri', 'serena', 'allison', 'zira',
];

function pickVoice() {
  const all = window.speechSynthesis.getVoices();
  const en = all.filter((v) => /^en\b|^en[-_]/i.test(v.lang));
  const pool = en.length ? en : all;
  if (!pool.length) return null;
  for (const kw of NATURAL) {
    const v = pool.find((x) => x.name.toLowerCase().includes(kw));
    if (v) return v;
  }
  return pool.find((v) => v.default) || pool[0];
}

export function createVoice() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  let enabled = supported && localStorage.getItem('airfx.voice') !== 'off';
  let chosen = null;

  if (supported) {
    chosen = pickVoice();
    // Voices often load asynchronously; re-pick when they arrive.
    if (!chosen) window.speechSynthesis.addEventListener('voiceschanged', () => { chosen = pickVoice(); }, { once: true });
  }

  function speak(text) {
    if (!supported || !enabled || !text) return;
    window.speechSynthesis.cancel(); // never overlap narration
    const u = new SpeechSynthesisUtterance(text);
    if (!chosen) chosen = pickVoice();
    if (chosen) u.voice = chosen;
    u.lang = (chosen && chosen.lang) || 'en-US';
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }
  function cancel() { if (supported) window.speechSynthesis.cancel(); }
  function setEnabled(on) {
    enabled = !!on;
    localStorage.setItem('airfx.voice', on ? 'on' : 'off');
    if (!on) cancel();
  }

  return { supported, speak, cancel, isEnabled: () => enabled, setEnabled };
}
