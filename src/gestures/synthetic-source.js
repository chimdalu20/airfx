export class SyntheticGestureSource {
  constructor(fn) { this.fn = fn; this.timer = null; }
  sample(tMs) { return this.fn(tMs); }
  start(onFrame, intervalMs = 33) {
    let t = 0;
    this.timer = setInterval(() => { t += intervalMs; onFrame(this.fn(t)); }, intervalMs);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
