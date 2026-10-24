import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useSigning, FACE } from "./HandsAvatar";

const SKIN = 0xf1c6a5, SHIRT = 0x2f5bff, INK = 0x10213a, U = 0.01;
const FX = [-0.18, -0.06, 0.06, 0.18], FL = [0.34, 0.38, 0.35, 0.28], BEND = [80, 95, 70], FR = [0.5, 0.3, 0.25];
const rad = (d) => (d * Math.PI) / 180;
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
const F3 = { // facial expressions: brow tilt, brow lift, mouth shape
  neutral: { b: 0, l: 0, m: "line" }, smile: { b: 0, l: 0, m: "smile" }, ask: { b: 0, l: 0.05, m: "o" },
  pain: { b: 0.4, l: 0, m: "frown" }, sad: { b: 0.3, l: 0, m: "frown" },
};

// a finger = base group (spread) + nested joint groups (curl)
function chain(parent, lens, r, skin) {
  const base = new THREE.Group(); parent.add(base);
  const joints = []; let at = base;
  lens.forEach((len) => {
    const j = new THREE.Group(), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), skin);
    m.position.y = len / 2; j.add(m);
    const tip = new THREE.Group(); tip.position.y = len; j.add(tip);
    at.add(j); joints.push(j); at = tip;
  });
  return { base, joints };
}

function makeHand(left, skin) {
  const root = new THREE.Group(); root.scale.setScalar(0.8);
  root.add(new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.6, 0.16, 4, 0.07), skin));
  const fingers = FX.map((x, i) => {
    const holder = new THREE.Group(); holder.position.set(x, 0.26, 0); root.add(holder);
    return chain(holder, FR.map((f) => FL[i] * f), 0.055, skin);
  });
  const th = new THREE.Group(); th.position.set(left ? 0.22 : -0.22, -0.02, 0.02); root.add(th);
  return { root, fingers, thumb: chain(th, [0.2, 0.17], 0.06, skin), left };
}

function applyPose(h, p) {
  h.root.position.set((p.x - 200) * U, (160 - p.y) * U, 0.55);
  h.root.rotation.set(0, 0, -rad(p.r));
  const sp = p.s[5];
  h.fingers.forEach((f, i) => {
    f.base.rotation.z = -rad(((i - 1.5) * sp) / 1.5);
    f.joints.forEach((j, k) => (j.rotation.x = rad(p.s[i + 1] * BEND[k])));
  });
  h.thumb.base.rotation.z = -rad(-50 + p.s[0] * 55) * (h.left ? -1 : 1);
  h.thumb.joints[0].rotation.x = rad(p.s[0] * 40);
  h.thumb.joints[1].rotation.x = rad(p.s[0] * 50);
}

function makeBody(skin) {
  const g = new THREE.Group(), ink = mat(INK);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.9, 6, 16), mat(SHIRT));
  torso.scale.set(1, 1, 0.55); torso.position.y = -0.85;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.35, 16), skin); neck.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 24), skin); head.position.y = 0.9;
  const eyes = [-1, 1].map((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), ink); e.position.set(s * 0.15, 0.95, 0.37); return e; });
  const brows = [-1, 1].map((s) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.035, 0.03, 2, 0.01), ink); b.position.set(s * 0.15, 1.07, 0.38); return b; });
  const mouth = new THREE.Group(); mouth.position.set(0, 0.73, 0.38);
  const shapes = {
    line: new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.03, 0.03, 2, 0.01), ink),
    smile: new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24, Math.PI), ink),
    frown: new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24, Math.PI), ink),
    o: new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), ink),
  };
  shapes.smile.rotation.z = Math.PI; shapes.smile.position.y = 0.05; shapes.frown.position.y = -0.05;
  Object.values(shapes).forEach((m) => mouth.add(m));
  g.add(torso, neck, head, mouth, ...eyes, ...brows);
  return {
    group: g, torso,
    setFace(f, open, blink) {
      brows[0].rotation.z = f.b; brows[1].rotation.z = -f.b;
      brows.forEach((b) => (b.position.y = 1.07 + f.l));
      Object.entries(shapes).forEach(([k, m]) => (m.visible = k === f.m));
      mouth.scale.y = open;
      eyes.forEach((e) => (e.scale.y = blink ? 0.1 : 1));
    },
  };
}

export default function HandsAvatar3D({ names, playKey, onError }) {
  const mount = useRef(null), live = useRef({});
  const { pose, gloss } = useSigning(names, playKey);
  live.current = { pose, gloss };

  useEffect(() => {
    const el = mount.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { onError?.(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.touchAction = "pan-y";
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1.25, 0.1, 50);
    cam.position.set(0, 0.25, 5.2); cam.lookAt(0, 0.1, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2, 3, 4); scene.add(sun);
    const skin = mat(SKIN), body = makeBody(skin), R = makeHand(false, skin), L = makeHand(true, skin);
    const world = new THREE.Group(); world.add(body.group, R.root, L.root); scene.add(world);

    const resize = () => { const w = el.clientWidth || 400; renderer.setSize(w, w / 1.25); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    let drag = null; // drag sideways to look around
    const cv = renderer.domElement;
    cv.onpointerdown = (e) => { drag = e.clientX; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => {
      if (drag === null) return;
      world.rotation.y = Math.max(-0.6, Math.min(0.6, world.rotation.y + (e.clientX - drag) * 0.01));
      drag = e.clientX;
    };
    cv.onpointerup = () => (drag = null);

    const clock = new THREE.Clock();
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime(), { pose: p, gloss: g } = live.current;
      applyPose(R, p.R); applyPose(L, p.L);
      body.setFace(F3[FACE[g] || "neutral"], g ? 1 + 0.35 * Math.sin(t * 14) : 1, t % 3.6 < 0.12);
      body.torso.scale.y = 1 + 0.015 * Math.sin(t * 1.6);
      renderer.render(scene, cam);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => o.geometry?.dispose());
      renderer.dispose(); el.removeChild(cv);
    };
  }, []); // eslint-disable-line

  return (
    <div className="avatar d3">
      {gloss && <div className="gloss">{gloss}</div>}
      <div ref={mount} />
    </div>
  );
}
