export function createMeters(rootEl) {
  rootEl.innerHTML = `
    <div><b>Left</b> <span id="mL">—</span></div>
    <div><b>Right</b> <span id="mR">—</span></div>`;
  const mL = rootEl.querySelector('#mL');
  const mR = rootEl.querySelector('#mR');
  const fmt = (h) => h.present
    ? `fingers:${h.fingers ?? '-'} height:${h.heightNorm.toFixed(2)} dist:${h.distanceNorm.toFixed(2)}`
    : 'not detected';
  return {
    update(signals) {
      mL.textContent = fmt(signals.left);
      mR.textContent = fmt({ ...signals.right, fingers: signals.right.fingers });
    },
  };
}
