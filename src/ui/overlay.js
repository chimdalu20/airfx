import { HAND_CONNECTIONS as CONNECTIONS } from '../gestures/landmarks.js';

export function createOverlay(canvas, video) {
  const ctx = canvas.getContext('2d');
  function draw(hands) {
    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const r = Math.max(3, canvas.width / 220);
    ctx.strokeStyle = '#f3f3f3';   // chalk bones
    ctx.fillStyle = '#6f6759';     // compass-gold joints
    ctx.lineWidth = Math.max(1, canvas.width / 640);
    ctx.lineJoin = 'round';
    for (const lm of hands) {
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
        ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
        ctx.stroke();
      }
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return { draw };
}
