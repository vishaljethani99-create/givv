// Handshape = [thumb, index, middle, ring, pinky] curl (0 open .. 1 closed) + finger spread (deg)
const SH = {
  B: [0.3, 0, 0, 0, 0, 3], FIST: [0.7, 1, 1, 1, 1, 0], A: [0, 1, 1, 1, 1, 0],
  POINT: [0.8, 0, 1, 1, 1, 0], FIVE: [0, 0, 0, 0, 0, 18], L: [0, 0, 1, 1, 1, 0],
  BENTL: [0, 0.5, 1, 1, 1, 0], RELAX: [0.4, 0.4, 0.4, 0.4, 0.4, 4],
};
// pose: shape, x, y (0-400 / 0-320 canvas), rotation in degrees. Signer's RIGHT hand is on the viewer's left.
const P = (s, x, y, r = 0) => ({ s: SH[s], x, y, r });
export const REST = { R: P("RELAX", 105, 292, 8), L: P("RELAX", 295, 292, -8) };
const st = (ms, R, L) => ({ ms, R: R || REST.R, L: L || REST.L });

const KILL = [
  st(400, P("POINT", 232, 208, 80), P("B", 268, 190, -88)),
  st(350, P("POINT", 188, 200, 80), P("B", 268, 190, -88)),
];
const SELF = [st(350, P("A", 178, 182)), st(200, P("A", 178, 176)), st(200, P("A", 178, 182))];

// "info" notes where each sign description came from. Have a Deaf signer review before you ship.
export const SIGNS = {
  HELLO: { info: "Flat hand salutes outward from the forehead", steps: [st(450, P("B", 128, 52, 25)), st(450, P("B", 84, 42, 60))] },
  HOW: { info: "Fists back to back, roll forward to open palms up", steps: [st(450, P("FIST", 172, 205, 25), P("FIST", 228, 205, -25)), st(550, P("FIVE", 150, 222, -35), P("FIVE", 250, 222, 35))] },
  YOU: { info: "Point at the other person", steps: [st(350, P("POINT", 150, 215)), st(300, P("POINT", 150, 190))] },
  FINE: { info: "Open hand, thumb touches the chest", steps: [st(450, P("FIVE", 172, 185, 15)), st(250, P("FIVE", 178, 178, 15))] },
  "THANK-YOU": { info: "Flat hand moves from the chin outward", steps: [st(400, P("B", 192, 115, 10)), st(450, P("B", 160, 160, -15))] },
  DOG: { info: "Pat the thigh, then snap", steps: [st(350, P("B", 128, 262)), st(200, P("B", 128, 246)), st(200, P("B", 128, 262)), st(300, P("A", 128, 240, 15))] },
  RUN: {
    info: "Bent-L hands hooked (index over the other thumb) move forward, index flicking",
    steps: [0, 1, 0, 1].map((u) => st(300, P("BENTL", 238, u ? 195 : 215, -70), P("BENTL", 262, u ? 185 : 205, -8))),
  },
  BACK: { info: "Point over the shoulder to the back", steps: [st(500, P("POINT", 86, 150, -50)), st(300, P("POINT", 70, 172, -60))] },
  HURT: {
    info: "Two index fingers jab toward each other, made at the sore spot",
    steps: [150, 165, 150, 165].map((x) => st(220, P("POINT", x, 200, 75), P("POINT", 400 - x, 200, -75))),
  },
  NECK: { info: "Tap the neck with the index finger", steps: [st(400, P("POINT", 182, 125, 35)), st(200, P("POINT", 182, 131, 35)), st(200, P("POINT", 182, 125, 35))] },
  SWELL: { info: "Closed hands open outward (approximation, verify with a signer)", steps: [st(450, P("FIST", 172, 132, 20), P("FIST", 228, 132, -20)), st(600, P("FIVE", 130, 128, -30), P("FIVE", 270, 128, 30))] },
  KILL: { info: "Index finger slices under the flat hand", steps: KILL },
  SELF: { info: "Thumb-up fist taps the chest", steps: SELF },
  SUICIDE: { info: "Signed as KILL + SELF by Deaf signers; regional variation exists", steps: [...KILL, ...SELF] },
};

const LEX = {
  hi: "HELLO", hello: "HELLO", hey: "HELLO", how: "HOW", you: "YOU", fine: "FINE", thanks: "THANK-YOU", thank: "THANK-YOU",
  dog: "DOG", run: "RUN", runs: "RUN", running: "RUN", suicide: "SUICIDE", back: "BACK",
  hurt: "HURT", hurts: "HURT", pain: "HURT", neck: "NECK", swelling: "SWELL", swollen: "SWELL", swell: "SWELL",
};

// speech/text in -> { signs: [names], reply: text, care?: true }
export function interpret(text) {
  const t = text.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/how (are|r) (you|u)/.test(t))
    return { signs: ["HELLO", "FINE", "THANK-YOU", "YOU"], reply: "Hello! I'm fine, thank you. And you?" };
  const signs = t.split(" ").map((w) => LEX[w]).filter(Boolean).filter((s, i, a) => s !== a[i - 1]);
  if (!signs.length)
    return { signs: [], reply: "I don't know those signs yet. Try “the dog is running” or “my back hurts and neck is swelling”." };
  return { signs, care: signs.includes("SUICIDE"), reply: signs.join(" · ") };
}
