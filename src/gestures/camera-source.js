import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { countExtendedFingers, handHeight, handSize } from './landmarks.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

export class CameraGestureSource {
  constructor(videoEl) { this.video = videoEl; this.landmarker = null; this.running = false; }

  async init() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
    this.video.srcObject = stream;
    await this.video.play();
    const vision = await FilesetResolver.forVisionTasks(WASM);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    // Warm up (first inference costs hundreds of ms).
    this.landmarker.detectForVideo(this.video, performance.now());
  }

  start(onFrame) {
    this.running = true;
    const reschedule = (fn) => {
      if ('requestVideoFrameCallback' in this.video) this.video.requestVideoFrameCallback(fn);
      else requestAnimationFrame(fn);
    };
    const loop = () => {
      if (!this.running) return;
      const tMs = performance.now();
      let frame;
      try {
        const res = this.landmarker.detectForVideo(this.video, tMs);
        frame = this._toRawFrame(res, tMs);
      } catch (err) {
        // A thrown frame must NOT kill the loop (it used to). Surface it instead.
        frame = { tMs, left: null, right: null, _landmarks: [], _error: 'detect: ' + (err?.message || err) };
      }
      try { onFrame(frame); } catch (err) { console.error('onFrame error', err); }
      reschedule(loop);
    };
    reschedule(loop);
  }

  stop() {
    this.running = false;
    if (this.landmarker) { this.landmarker.close(); this.landmarker = null; }
    const s = this.video.srcObject;
    if (s) s.getTracks().forEach((t) => t.stop());
  }

  _toRawFrame(res, tMs) {
    const frame = { tMs, left: null, right: null, _landmarks: res.landmarks || [] };
    const hands = res.landmarks || [];
    const handed = res.handedness || [];
    for (let i = 0; i < hands.length; i++) {
      const lm = hands[i];
      // MediaPipe labels handedness assuming a mirrored selfie image, but we feed the
      // raw (un-mirrored) webcam frame, so its Left/Right is inverted relative to the
      // user. Swap it so the label matches the actual hand and the mirrored on-screen view.
      const mp = handed[i]?.[0]?.categoryName || 'Right';
      const label = mp === 'Left' ? 'Right' : 'Left';
      const conf = handed[i]?.[0]?.score ?? 1;
      const obs = { fingers: countExtendedFingers(lm, label), height: handHeight(lm), size: handSize(lm), confidence: conf };
      if (label === 'Left') frame.left = obs; else frame.right = obs;
    }
    return frame;
  }
}
