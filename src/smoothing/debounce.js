export class Debounced {
  constructor(framesToConfirm = 4, initial = null) {
    this.n = framesToConfirm;
    this.committed = initial;
    this.candidate = initial;
    this.count = 0;
  }
  push(value) {
    if (value === this.candidate) {
      this.count++;
    } else {
      this.candidate = value;
      this.count = 1;
    }
    if (this.count >= this.n) this.committed = this.candidate;
    return this.committed;
  }
}

export class Hysteresis {
  constructor(enter, exit, initial = false) {
    if (exit > enter) throw new Error('Hysteresis: exit must be <= enter');
    this.enter = enter;
    this.exit = exit;
    this.state = initial;
  }
  update(x) {
    if (this.state) {
      if (x <= this.exit) this.state = false;
    } else if (x >= this.enter) {
      this.state = true;
    }
    return this.state;
  }
}
