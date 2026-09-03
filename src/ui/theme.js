const KEY = 'airfx.theme';
const LIGHT = 'light';
const DARK = 'dark';

// Light is the product default. We deliberately do NOT read prefers-color-scheme:
// the default is a design decision, not a system preference. A stored choice wins.
export function readTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === LIGHT || saved === DARK) return saved;
  } catch {
    /* private mode / blocked storage — fall through to the default */
  }
  return LIGHT;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* not persisting is survivable; the page still renders correctly */
  }
}

// Wires the header toggle. Safe to call before the app starts.
export function createThemeToggle(btn) {
  if (!btn) return { get: readTheme };
  let theme = readTheme();

  function render() {
    const dark = theme === DARK;
    // The button advertises the action, not the state.
    btn.textContent = dark ? 'Light' : 'Dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  }

  btn.addEventListener('click', () => {
    theme = theme === DARK ? LIGHT : DARK;
    applyTheme(theme);
    render();
  });

  applyTheme(theme);
  render();
  return { get: () => theme };
}
