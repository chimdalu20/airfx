const alpha = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

class LowPass {
  constructor() { this.s = null; this.raw = null; }
  has() { return this.raw !== null; }
  last() { return this.raw; }
  filter(x, a) {
    this.s = this.s === null ? x : a * x + (1 - a) * this.s;
    this.raw = x;
    return this.s;
  }
}

export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.lastTime = null;
  }
  filter(value, timestampMs) {
    let dt = 1 / 30;
    if (this.lastTime !== null && timestampMs > this.lastTime) {
      dt = (timestampMs - this.lastTime) / 1000;
    }
    this.lastTime = timestampMs;
    const prev = this.x.has() ? this.x.last() : value;
    const dValue = (value - prev) / dt;
    const edValue = this.dx.filter(dValue, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edValue);
    return this.x.filter(value, alpha(cutoff, dt));
  }
}
