const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

export function createRecorder(stream) {
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  let rec = null;
  let chunks = [];
  return {
    start() {
      chunks = [];
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.start();
    },
    stop() {
      if (!rec || rec.state === 'inactive') {
        return Promise.resolve(new Blob([], { type: mimeType || 'audio/webm' }));
      }
      return new Promise((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
        rec.stop();
      });
    },
    get active() { return !!rec && rec.state === 'recording'; },
  };
}
