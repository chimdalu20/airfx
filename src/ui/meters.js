export function createMeters(rootEl) {
  rootEl.innerHTML = `
    <div class="meter"><b>Left</b> <span id="mL">—</span></div>
    <div class="meter"><b>Right</b> <span id="mR">—</span></div>`;
  const mL = rootEl.querySelector('#mL');
  const mR = rootEl.querySelector('#mR');
  const fmt = (h) => (h.present ? `tracking · intensity ${Math.round(h.heightNorm * 100)}%` : 'not detected');
  return {
    update(signals) {
      mL.textContent = fmt(signals.left);
      mR.textContent = fmt(signals.right);
    },
  };
}
