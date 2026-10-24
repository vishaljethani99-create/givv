import { useEffect, useRef, useState } from "react";
import { SIGNS, REST } from "./signLibrary";

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), r: lerp(a.r, b.r, t), s: a.s.map((v, i) => lerp(v, b.s[i], t)) });
const SKIN = "#F1C6A5", EDGE = "#B97F5C";
const BASE = [[-18, 34], [-6, 38], [6, 35], [18, 28]];

function chain(x, y, ang, curl, segs, bends) {
  const pts = [[x, y]], a = (ang * Math.PI) / 180;
  let cum = 0;
  segs.forEach((len, k) => {
    cum += curl * bends[k];
    const c = Math.cos((cum * Math.PI) / 180);
    x += Math.sin(a) * len * c;
    y -= Math.cos(a) * len * c;
    pts.push([x, y]);
  });
  return pts.map((q) => q.join(",")).join(" ");
}

function Hand({ p, left }) {
  const sp = p.s[5];
  const lines = p.s.slice(1, 5).map((c, i) =>
    chain(BASE[i][0], -26, ((i - 1.5) * sp) / 1.5, c, [BASE[i][1] * 0.5, BASE[i][1] * 0.3, BASE[i][1] * 0.25], [80, 95, 70])
  );
  lines.push(chain(-22, 12, -50 + p.s[0] * 55, p.s[0], [20, 17], [40, 50]));
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${p.r})${left ? " scale(-1 1)" : ""}`} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="-26" y="-28" width="52" height="60" rx="18" fill={SKIN} stroke={EDGE} strokeWidth="3" />
      {[[EDGE, 19], [SKIN, 14]].map(([c, w]) => (
        <g key={c} stroke={c} strokeWidth={w}>{lines.map((pts, i) => <polyline key={i} points={pts} />)}</g>
      ))}
    </g>
  );
}

export const FACE = { HURT: "pain", SWELL: "pain", BACK: "pain", NECK: "pain", HOW: "ask", YOU: "ask", HELLO: "smile", FINE: "smile", "THANK-YOU": "smile", SUICIDE: "sad", KILL: "sad", SELF: "sad" };
const FACES = {
  neutral: { l: "M174 54 Q185 50 196 54", r: "M204 54 Q215 50 226 54", m: "M188 86 L212 86" },
  smile: { l: "M174 54 Q185 50 196 54", r: "M204 54 Q215 50 226 54", m: "M186 83 Q200 99 214 83" },
  ask: { l: "M174 48 Q185 42 196 48", r: "M204 48 Q215 42 226 48", m: "M193 86 Q200 92 207 86" },
  pain: { l: "M174 58 L196 49", r: "M204 49 L226 58", m: "M188 91 Q200 80 212 91" },
  sad: { l: "M174 56 L196 50", r: "M204 50 L226 56", m: "M188 92 Q200 82 212 92" },
};

// shared timeline: turns sign names into smoothly animated poses (used by the 2D and 3D avatars)
export function useSigning(names, playKey) {
  const poseRef = useRef(REST);
  const [pose, setPose] = useState(REST);
  const [gloss, setGloss] = useState("");

  useEffect(() => {
    const steps = [];
    names.forEach((n) => SIGNS[n]?.steps.forEach((s, i) => steps.push({ ...s, n, first: i === 0 })));
    if (!steps.length) return;
    steps.push({ ms: 500, R: REST.R, L: REST.L, n: "" });
    let i = 0, t0 = null, from = poseRef.current, raf;
    const tick = (now) => {
      const s = steps[i];
      if (t0 === null) { t0 = now; if (s.first || !s.n) setGloss(s.n); }
      const k = Math.min(1, (now - t0) / s.ms), e = ease(k);
      const p = { R: mix(from.R, s.R, e), L: mix(from.L, s.L, e) };
      poseRef.current = p; setPose(p);
      if (k >= 1) { from = p; i++; t0 = null; if (i >= steps.length) return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playKey]); // eslint-disable-line
  return { pose, gloss };
}

export default function HandsAvatar({ names, playKey }) {
  const { pose, gloss } = useSigning(names, playKey);

  const f = FACES[FACE[gloss] || "neutral"];
  return (
    <div className="avatar">
      {gloss && <div className="gloss">{gloss}</div>}
      <svg viewBox="0 0 400 320" role="img" aria-label="Animated signing hands">
        <path d="M40 320 Q50 150 200 140 Q350 150 360 320Z" fill="var(--sign)" opacity=".85" />
        <rect x="184" y="100" width="32" height="46" rx="12" fill={SKIN} />
        <circle cx="200" cy="70" r="40" fill={SKIN} stroke={EDGE} strokeWidth="3" />
        <circle cx="185" cy="66" r="4" fill="#10213A" /><circle cx="215" cy="66" r="4" fill="#10213A" />
        {[f.l, f.r, f.m].map((d) => <path key={d} d={d} stroke="#10213A" strokeWidth="3" fill="none" strokeLinecap="round" />)}
        <Hand p={pose.R} />
        <Hand p={pose.L} left />
      </svg>
    </div>
  );
}
