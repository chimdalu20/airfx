export function createMeters(rootEl) {
  rootEl.innerHTML = `
    <div><b>◀ Left</b> <span id="mL">—</span></div>
    <div><b>Right ▶</b> <span id="mR">—</span></div>`;
  const mL = rootEl.querySelector('#mL');
  const mR = rootEl.querySelector('#mR');
  const fmt = (h) => !h.present
    ? 'not detected'
    : `${h.engaged ? 'OPEN ✋' : 'closed ✊'} · intensity ${Math.round(h.heightNorm * 100)}%`;
  return {
    update(signals) {
      mL.textContent = fmt(signals.left);
      mR.textContent = fmt(signals.right);
    },
  };
}
