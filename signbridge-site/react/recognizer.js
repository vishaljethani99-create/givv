// On-device sign recognition. Video never leaves the phone; only RecognizedSign objects come out.
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

// 21 joints -> 63 numbers: wrist at origin, scaled by wrist-to-middle-knuckle length
const normalize = (lm) => {
  const w = lm[0], s = Math.hypot(lm[9].x - w.x, lm[9].y - w.y, lm[9].z - w.z) || 1;
  return lm.flatMap((p) => [(p.x - w.x) / s, (p.y - w.y) / s, (p.z - w.z) / s]);
};
const dist = (a, b) => Math.sqrt(a.reduce((t, v, i) => t + (v - b[i]) ** 2, 0) / a.length);

// Assumed pack shape: { maxDistance, signs: [{ label, templates: [[63 or 126 numbers], ...] }] }
export async function createRecognizer({
  video, onSign, onHands, packUrl = "/packs/default.json", wasmPath = "/mediapipe/wasm",
  modelPath = "/models/hand_landmarker.task", minConfidence = 0.7, stableFrames = 6,
}) {
  // a missing pack is fine: tracking still works and you can capture signs yourself
  const pack = await fetch(packUrl).then((r) => r.json()).catch(() => ({ maxDistance: 0.5, signs: [] }));
  pack.signs = pack.signs || [];
  let current = null;
  const landmarker = await HandLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(wasmPath), {
    baseOptions: { modelAssetPath: modelPath }, runningMode: "VIDEO", numHands: 2,
  });
  let raf, last = "", streak = 0, lastEmit = "", lastAt = 0, lastTime = -1;

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    const res = landmarker.detectForVideo(video, performance.now());
    onHands?.(res.landmarks.length ? res.landmarks : null);
    if (!res.landmarks.length) { streak = 0; last = ""; current = null; return; }
    const hands = [...res.landmarks].sort((a, b) => a[0].x - b[0].x).map(normalize);
    const both = [...hands[0], ...(hands[1] || new Array(63).fill(0))];
    current = res.landmarks.length > 1 ? both : hands[0];
    let best = { label: "", d: Infinity };
    for (const s of pack.signs) for (const t of s.templates) {
      const d = dist(t.length === 63 ? hands[0] : both, t);
      if (d < best.d) best = { label: s.label, d };
    }
    const confidence = Math.max(0, 1 - best.d / (pack.maxDistance || 1));
    if (!best.label || confidence < minConfidence) { streak = 0; last = ""; return; }
    streak = best.label === last ? streak + 1 : 1;
    last = best.label;
    const now = Date.now();
    if (streak === stableFrames && (best.label !== lastEmit || now - lastAt > 1500)) {
      lastEmit = best.label; lastAt = now;
      onSign({ label: best.label, confidence: +confidence.toFixed(2), at: Math.floor(now / 1000) });
    }
  };
  loop();
  return {
    stop() { cancelAnimationFrame(raf); landmarker.close(); },
    // save the pose currently in view as a template for `label`
    capture(label) {
      if (!current || !label) return false;
      let s = pack.signs.find((x) => x.label === label);
      if (!s) pack.signs.push((s = { label, templates: [] }));
      s.templates.push([...current]);
      return true;
    },
    exportPack: () => ({ maxDistance: pack.maxDistance || 0.5, signs: pack.signs }),
  };
}
