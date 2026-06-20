const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export function createOverlay(canvas, video) {
  const ctx = canvas.getContext('2d');
  function draw(hands) {
    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const r = Math.max(3, canvas.width / 220);
    ctx.strokeStyle = '#4f7cff';
    ctx.fillStyle = '#9ec1ff';
    ctx.lineWidth = Math.max(2, canvas.width / 320);
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
