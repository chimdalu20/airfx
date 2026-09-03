### Task 11: Live meters + landmark overlay

> Browser-only; verified visually.

**Files:**
- Create: `src/ui/meters.js`, `src/ui/overlay.js`

**Interfaces:**
- Produces:
  - `createMeters(rootEl) â†’ { update(signals) }` â€” shows per-hand present/fingers/height/distance.
  - `createOverlay(canvasEl, videoEl) â†’ { draw(landmarksArray) }` â€” draws hand points over the (mirrored) video.

- [ ] **Step 1: Implement `src/ui/meters.js`**

```js
export function createMeters(rootEl) {
  rootEl.innerHTML = `
    <div><b>Left</b> <span id="mL">â€”</span></div>
    <div><b>Right</b> <span id="mR">â€”</span></div>`;
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
```

- [ ] **Step 2: Implement `src/ui/overlay.js`**

```js
const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export function createOverlay(canvas, video) {
  const ctx = canvas.getContext('2d');
  function draw(hands) {
    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#4f7cff';
    ctx.fillStyle = '#8fb0ff';
    ctx.lineWidth = 2;
    for (const lm of hands) {
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
        ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
        ctx.stroke();
      }
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return { draw };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/meters.js src/ui/overlay.js
git commit -m "feat: live meters + landmark overlay"
```

---

