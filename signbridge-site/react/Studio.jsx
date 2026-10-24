import { useEffect, useRef, useState } from "react";
import HandsAvatar from "./HandsAvatar";
import HandsAvatar3D from "./HandsAvatar3D";
import { interpret } from "./signLibrary";
import { createRecognizer } from "./recognizer";
import { createSession } from "./session";

const TRY = ["Hi, how are you?", "The dog is running", "My back hurts and neck is swelling", "Suicide"];

export default function Studio({ stream }) {
  const vid = useRef(null), meter = useRef(null), recRef = useRef(null), ov = useRef(null), reco = useRef(null), seen = useRef(false);
  const [chat, setChat] = useState([]);
  const [seq, setSeq] = useState({ names: [], key: 0 });
  const [care, setCare] = useState(false);
  const [heard, setHeard] = useState("");
  const [signed, setSigned] = useState([]);
  const [text, setText] = useState("");
  const [sentence, setSentence] = useState("");
  const [vision, setVision] = useState("loading");
  const [mode, setMode] = useState("3d");
  const [hand, setHand] = useState(false);
  const [visionErr, setVisionErr] = useState("");
  const [label, setLabel] = useState("");
  const [taught, setTaught] = useState(0);
  const [hint, setHint] = useState("");

  const handle = (raw) => {
    const t = raw.trim();
    if (!t) return;
    const r = interpret(t);
    setChat((c) => [...c.slice(-5), { who: "you", text: t }, { who: "bridge", text: r.reply }]);
    setSeq({ names: r.signs, key: Date.now() });
    setCare(!!r.care);
  };

  useEffect(() => { vid.current.srcObject = stream; }, [stream]);

  // microphone level meter
  useEffect(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !stream.getAudioTracks().length) return;
    const ctx = new AC(), an = ctx.createAnalyser();
    an.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    let raf;
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let m = 0; buf.forEach((v) => (m = Math.max(m, Math.abs(v - 128))));
      if (meter.current) meter.current.style.width = Math.min(100, m * 1.6) + "%";
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); ctx.close(); };
  }, [stream]);

  // speech -> hands (restarts itself when the browser ends a session)
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    let on = true;
    const start = () => {
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = navigator.language || "en-US";
      r.onresult = (e) => {
        let live = "";
        for (let k = e.resultIndex; k < e.results.length; k++) {
          const res = e.results[k];
          live += res[0].transcript;
          if (res.isFinal) { if (!window.speechSynthesis?.speaking) handle(res[0].transcript); live = ""; }
        }
        setHeard(live);
      };
      r.onend = () => on && setTimeout(start, 300);
      r.onerror = () => {};
      recRef.current = r;
      try { r.start(); } catch { /* already started */ }
    };
    start();
    return () => { on = false; recRef.current?.stop(); };
  }, []); // eslint-disable-line

  // camera -> sign labels (all on-device) -> text-only /api/compose -> spoken sentence
  useEffect(() => {
    let rec, dead = false;
    const session = createSession({
      onSigns: setSigned,
      onSentence: (t) => { setSentence(t); window.speechSynthesis?.speak(new SpeechSynthesisUtterance(t)); },
    });
    const draw = (hands) => {
      const c = ov.current, v = vid.current;
      if (!c || !v.videoWidth) return;
      if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
      const g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = "#FFB020";
      hands?.forEach((h) => h.forEach((p) => { g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 5, 0, 7); g.fill(); }));
      if (!!hands !== seen.current) { seen.current = !!hands; setHand(!!hands); }
    };
    createRecognizer({ video: vid.current, onSign: (s) => session.push(s), onHands: draw })
      .then((r) => { if (dead) r.stop(); else { rec = r; reco.current = r; setVision("on"); } })
      .catch((e) => { setVisionErr(e.message || String(e)); setVision("error"); });
    return () => { dead = true; rec?.stop(); session.reset(); };
  }, []);

  return (
    <>
      <div className="sec-head">
        <h2>Your interpreter is live</h2>
        <p>Say “hi, how are you?”, sign into the camera, or tap an example.</p>
      </div>
      <div className="studio-grid">
        <div className="studio-col">
          <div className="cam"><video ref={vid} autoPlay playsInline muted /><canvas ref={ov} /><div className="hand-status">{vision !== "on" ? "Starting hand tracking…" : hand ? "Hand detected" : "No hand in view"}</div><div className="mic"><i ref={meter} /></div></div>
          <h3>You signed</h3>
          <div className="out" aria-live="polite">
            {signed.length ? signed.join(" · ") : (
              <span className="dim">
                {vision === "error" ? `Hand tracking could not start: ${visionErr}. Check the MediaPipe files in public/ (see README).` : vision === "on" ? "Show a sign to the camera…" : "Loading on-device hand tracking…"}
              </span>
            )}
          </div>
          {sentence && <div className="msg bridge">{sentence}</div>}
          <form className="ask" onSubmit={(e) => {
            e.preventDefault();
            const ok = reco.current?.capture(label.trim().toUpperCase());
            setHint(ok ? `Captured. Hold the same sign a few more times for better accuracy.` : "Show your hand to the camera and type a label first.");
            if (ok) setTaught((n) => n + 1);
          }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Teach a sign, e.g. HELP" aria-label="Sign label" />
            <button className="btn btn-ghost" type="submit">Capture</button>
          </form>
          <div className="tryrow">
            <button type="button" className="chip" disabled={!taught} onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([JSON.stringify(reco.current.exportPack())], { type: "application/json" }));
              a.download = "default.json"; a.click();
            }}>Download pack ({taught})</button>
            {hint && <span className="dim">{hint}</span>}
          </div>
        </div>
        <div className="studio-col">
          {mode === "3d"
            ? <HandsAvatar3D names={seq.names} playKey={seq.key} onError={() => setMode("2d")} />
            : <HandsAvatar names={seq.names} playKey={seq.key} />}
          <button type="button" className="chip" onClick={() => setMode(mode === "3d" ? "2d" : "3d")}>
            {mode === "3d" ? "Switch to 2D" : "Switch to 3D"}
          </button>
          <div className="out heard">{heard || <span className="dim">Listening… say “hi, how are you?”</span>}</div>
          <div className="chat" aria-live="polite">
            {chat.map((m, i) => <div key={i} className={`msg ${m.who}`}>{m.text}</div>)}
          </div>
          {care && (
            <div className="care" role="note">
              <b>You’re not alone.</b> If you or someone near you is thinking about suicide, please reach out now. In India, Tele-MANAS is free and open 24/7:
              call <a href="tel:14416">14416</a> or <a href="tel:18008914416">1-800-891-4416</a>. If someone is in immediate danger, call 112.
            </div>
          )}
          <div className="tryrow">{TRY.map((t) => <button key={t} type="button" className="chip" onClick={() => handle(t)}>{t}</button>)}</div>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); handle(text); setText(""); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type a phrase…" aria-label="Type a phrase" />
            <button className="btn btn-primary" type="submit">Sign it</button>
          </form>
        </div>
      </div>
    </>
  );
}
