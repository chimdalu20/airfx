import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { countOpenFingers, handHeight, handSize } from './landmarks.js';

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
    const items = hands.map((lm, i) => ({
      // Mirrored screen-x: raw-left appears on the RIGHT of the flipped display, so
      // screenX 0 = screen-left. Wrist (landmark 0) is a stable reference point.
      screenX: 1 - lm[0].x,
      obs: {
        height: handHeight(lm),
        size: handSize(lm),
        open: countOpenFingers(lm),
        confidence: handed[i]?.[0]?.score ?? 1,
      },
    }));
    // Assign by SCREEN POSITION, not MediaPipe handedness: position stays stable when
    // hands are close (handedness swaps there) and matches the left/right effect columns.
    if (items.length === 1) {
      if (items[0].screenX < 0.5) frame.left = items[0].obs; else frame.right = items[0].obs;
    } else if (items.length >= 2) {
      items.sort((a, b) => a.screenX - b.screenX);
      frame.left = items[0].obs;
      frame.right = items[items.length - 1].obs;
    }
    return frame;
  }
}
