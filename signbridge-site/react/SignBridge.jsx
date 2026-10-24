import { useEffect, useRef, useState } from "react";
import "./signbridge.css";
import Studio from "./Studio";

const PHRASES = [
  "Hello, how are you?",
  "I need some help, please.",
  "Thank you, see you soon.",
];

/**
 * Props
 *  - appHref     where the "Open SignBridge" buttons go (default "/app")
 *  - theme       "light" | "dark" | undefined (undefined follows the device)
 *  - signText    real translated sentence from your sign pipeline (replaces demo phrases)
 *  - captionText real transcript from your speech pipeline (replaces demo captions)
 */
export default function SignBridge({ appHref = "/app", theme, signText, captionText }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [demoCaption, setDemoCaption] = useState("Say something and it appears here.");
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const studioRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [permErr, setPermErr] = useState("");

  const spoken = signText ?? PHRASES[phraseIdx];
  const caption = captionText ?? demoCaption;

  // rotate demo phrases only when no real sign text is supplied
  useEffect(() => {
    if (signText !== undefined) return;
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 4200);
    return () => clearInterval(id);
  }, [signText]);

  // cleanup on unmount
  useEffect(
    () => () => {
      recRef.current?.stop();
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const enable = async () => {
    setPermErr("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermErr("This browser can't reach the camera. Use a modern browser on https or localhost.");
      return;
    }
    try {
      recRef.current?.stop();
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = s;
      setStream(s);
      setTimeout(() => studioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) {
      setPermErr(
        e.name === "NotAllowedError"
          ? "Camera and microphone access was blocked. Allow both in your browser's site settings, then try again."
          : "Could not start the camera or microphone."
      );
    }
  };

  const speak = () => {
    if (!("speechSynthesis" in window)) {
      setStatus("Speech output is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
    setStatus("Speaking the translation aloud.");
  };

  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus("Live captions need a browser with speech recognition, such as Chrome or Safari.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let t = "";
      for (let k = e.resultIndex; k < e.results.length; k++) t += e.results[k][0].transcript;
      setDemoCaption(t);
    };
    rec.onerror = (e) =>
      setStatus(
        e.error === "not-allowed"
          ? "Microphone access was blocked. Allow it in your browser settings."
          : `Captions stopped: ${e.error}.`
      );
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setDemoCaption("Listening…");
    try {
      rec.start();
      setListening(true);
      setStatus("");
    } catch {
      setStatus("Could not start the microphone.");
    }
  };

  return (
    <div className="sb" data-theme={theme}>
      <div className="wrap">
        <nav aria-label="Main">
          <a className="logo" href="#top" aria-label="SignBridge home">
            <svg viewBox="0 0 34 34" aria-hidden="true">
              <path d="M2 24 Q17 4 32 24" fill="none" stroke="var(--sign)" strokeWidth="5" strokeLinecap="round" />
              <path d="M2 24 Q17 14 32 24" fill="none" stroke="var(--speech)" strokeWidth="5" strokeLinecap="round" />
            </svg>
            SignBridge
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#private">Privacy</a>
            <a href="#faq">FAQ</a>
            <a className="btn btn-primary" href={appHref}>Open SignBridge</a>
          </div>
        </nav>

        <header className="hero" id="top">
          <div>
            <h1>
              <span className="a">One phone.</span>
              <span>Two languages.</span>
              <span className="b">Zero silence.</span>
            </h1>
            <p className="lead">
              A real-time, two-way interpreter between sign language and speech. It runs entirely in
              your browser on a single phone. No app to install, no account, no cloud calls for the
              core gesture pipeline.
            </p>
            <div className="cta">
              <button className="btn btn-primary" type="button" onClick={enable}>Allow camera &amp; microphone</button>
              <a className="btn btn-ghost" href="#how">See how it works</a>
            </div>
            <p className="fine">Works on any modern phone browser. Camera and microphone stay on your device.</p>
            {permErr && <p className="perm-err" role="alert">{permErr}</p>}
          </div>

          <div>
            <div className="phone" role="group" aria-label="SignBridge live demo">
              <div className="screen">
                <div className="half sign">
                  <div className="tag"><span className="dot" />Signing detected</div>
                  <div className="hand" aria-hidden="true">
                    <svg viewBox="0 0 150 160">
                      <g className="f"><line x1="75" y1="140" x2="20" y2="90" /><line x1="20" y1="90" x2="8" y2="60" /><circle cx="20" cy="90" r="5" /><circle cx="8" cy="60" r="5" /></g>
                      <g className="f"><line x1="75" y1="140" x2="42" y2="70" /><line x1="42" y1="70" x2="36" y2="26" /><circle cx="42" cy="70" r="5" /><circle cx="36" cy="26" r="5" /></g>
                      <g className="f"><line x1="75" y1="140" x2="68" y2="62" /><line x1="68" y1="62" x2="68" y2="12" /><circle cx="68" cy="62" r="5" /><circle cx="68" cy="12" r="5" /></g>
                      <g className="f"><line x1="75" y1="140" x2="96" y2="68" /><line x1="96" y1="68" x2="102" y2="22" /><circle cx="96" cy="68" r="5" /><circle cx="102" cy="22" r="5" /></g>
                      <g className="f"><line x1="75" y1="140" x2="120" y2="90" /><line x1="120" y1="90" x2="136" y2="62" /><circle cx="120" cy="90" r="5" /><circle cx="136" cy="62" r="5" /></g>
                      <circle cx="75" cy="140" r="8" />
                    </svg>
                  </div>
                  <div className="bubble" aria-live="polite">{spoken}</div>
                </div>
                <div className="half speech">
                  <div className="tag"><span className="dot" />Live captions</div>
                  <div className="caption caret" aria-live="polite">{caption}</div>
                </div>
              </div>
            </div>
            <div className="demo-actions">
              <button className="chip" type="button" onClick={speak}>Hear the sign translated</button>
              <button className="chip" type="button" onClick={toggleMic}>
                {listening ? "Stop captions" : "Try live captions"}
              </button>
            </div>
            <div id="status" role="status">{status}</div>
          </div>
        </header>
      </div>

      {stream && (
        <section className="studio" id="studio" ref={studioRef}>
          <div className="wrap"><Studio stream={stream} /></div>
        </section>
      )}

      <section className="surface" id="how">
        <div className="wrap">
          <div className="sec-head">
            <h2>Both people talk. Neither waits.</h2>
            <p>SignBridge turns one phone into a shared space. Signs become spoken words. Spoken words become captions.</p>
          </div>
          <div className="dirs">
            <div className="dir s">
              <div className="path"><b>Sign</b> to speech</div>
              <p>Point the camera at the person signing. SignBridge reads hand shape and movement, builds the sentence, and says it out loud.</p>
            </div>
            <div className="dir t">
              <div className="path"><b>Speech</b> to captions</div>
              <p>The other person replies out loud. Their words appear as large, live captions for the deaf or mute person to read.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head"><h2>Ready in three steps</h2></div>
          <ol className="steps">
            <li><h3>Open the link</h3><p>No install and no sign-up. It loads in your phone's browser.</p></li>
            <li><h3>Allow camera and mic</h3><p>The camera watches the signer. The microphone listens to the speaker.</p></li>
            <li><h3>Start talking</h3><p>Prop the phone between you. Signs are spoken and replies are captioned as you go.</p></li>
          </ol>
        </div>
      </section>

      <section className="surface" id="private">
        <div className="wrap priv">
          <div>
            <h2>Your conversation stays on your phone</h2>
            <p style={{ marginTop: 20, color: "var(--muted)" }}>
              The gesture model runs locally in the browser. Nothing is uploaded, recorded or stored,
              and there is no account to create.
            </p>
          </div>
          <div className="ledger" role="table" aria-label="What leaves your device">
            <div className="hd" role="row"><span>Data</span><span>Leaves your phone?</span></div>
            <div role="row"><span>Camera video</span><span className="ok">No</span></div>
            <div role="row"><span>Hand and gesture data</span><span className="ok">No</span></div>
            <div role="row"><span>Translated sentences</span><span className="ok">No</span></div>
            <div role="row"><span>Personal account info</span><span className="ok">None collected</span></div>
          </div>
        </div>
      </section>

      <section id="faq">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="sec-head"><h2>Questions</h2></div>
          <details><summary>Do I need to install anything?</summary><p>No. SignBridge runs in your browser. Open the page, allow camera and microphone access, and begin.</p></details>
          <details><summary>Does it work offline?</summary><p>After the first load, the gesture pipeline runs on your device without a server. Speech captions depend on your browser's speech recognition, which on some browsers uses an online service.</p></details>
          <details><summary>Which sign languages are supported?</summary><p>List your supported languages here, for example ASL or ISL, and say which vocabulary is available today.</p></details>
          <details><summary>How should I place the phone?</summary><p>Lean it against something so the signer's hands and upper body are fully in frame, in good light.</p></details>
        </div>
      </section>

      <section id="start" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="final">
            <h2>Make the next conversation easy</h2>
            <p style={{ maxWidth: "44ch" }}>Open SignBridge on a phone and start talking in minutes.</p>
            <a className="btn btn-primary" href={appHref}>Open SignBridge</a>
          </div>
          <footer>
            <span>© 2026 SignBridge</span>
            <span>One phone. Two languages. Zero silence.</span>
          </footer>
        </div>
      </section>
    </div>
  );
}
