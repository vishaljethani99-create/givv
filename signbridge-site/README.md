# SignBridge site

signbridge-site/
  html/signbridge.html      standalone page (open in a browser, no build)
  react/SignBridge.jsx      the same page as a React component
  react/signbridge.css      its styles, scoped under .sb so they won't touch your app

## Add it to your React app (Vite)
1. Copy SignBridge.jsx and signbridge.css into src/components/ (keep them side by side).
2. Use it in src/App.jsx:

   import SignBridge from "./components/SignBridge";
   export default function App() { return <SignBridge appHref="/app" />; }

3. Run:  npm run dev

## With routes (landing page at "/", interpreter at "/app")
   npm i react-router-dom

   // src/main.jsx
   import { BrowserRouter } from "react-router-dom";
   ReactDOM.createRoot(document.getElementById("root")).render(
     <BrowserRouter><App /></BrowserRouter>
   );

   // src/App.jsx
   import { Routes, Route } from "react-router-dom";
   import SignBridge from "./components/SignBridge";
   import Interpreter from "./pages/Interpreter"; // your existing app screen
   export default function App() {
     return (
       <Routes>
         <Route path="/" element={<SignBridge appHref="/app" />} />
         <Route path="/app" element={<Interpreter />} />
       </Routes>
     );
   }

## Connect your real pipeline
The component takes two optional props. When you pass them, the demo animation text is replaced:
   <SignBridge signText={translatedSentence} captionText={transcript} />
Reuse the same pieces in your Interpreter page:
   - sign -> speech: window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
   - speech -> captions: window.SpeechRecognition || window.webkitSpeechRecognition
   - camera: navigator.mediaDevices.getUserMedia({ video: true, audio: true }) (needs https or localhost)

## Notes
- Create React App works the same; put the files in src/components/.
- The fonts load from Google Fonts through an @import at the top of signbridge.css.
- Add <meta name="viewport" content="width=device-width, initial-scale=1"> in index.html if it is missing.

## Update: camera/mic studio
New files in react/: Studio.jsx, HandsAvatar.jsx, signLibrary.js, recognizer.js, session.js (copy all of react/ into src/components/).
- "Allow camera & microphone" asks for permission, scrolls to a rounded camera cutout, and shows two animated hands.
- Speech (or typed text) -> hands: edit signLibrary.js to add signs (poses + handshapes).
- Sign -> text runs on the device (recognizer.js). Only sign labels go to /api/compose (session.js).
- Sign descriptions are ASL, taken from public references; SWELL and DOG are approximations. Have a Deaf signer review them.

## On-device recognition setup (camera never leaves the phone)
1. npm i @mediapipe/tasks-vision
2. Copy node_modules/@mediapipe/tasks-vision/wasm to public/mediapipe/wasm, and put hand_landmarker.task in public/models/
3. Put your sign pack at public/packs/default.json. recognizer.js ASSUMES this shape, so adjust it to Section 5 of your spec:
   { "maxDistance": 1.0, "signs": [ { "label": "HELP", "templates": [[63 or 126 numbers]] } ] }
4. Backend contract: POST /api/compose { signs, scenario, lang, history } -> { sentence }. History is [{signs, sentence}] here, change to your spec's shape.
5. Rename recognizer.js / session.js to .ts if your app is TypeScript.
Spoken sentences pause speech-to-hands while text-to-speech is playing, so the phone does not sign its own voice.
Note: signLibrary.js (the signing avatar) is ASL so far, not ISL.

## 3D avatar
npm i three   (HandsAvatar3D.jsx uses three.js; no model files needed, the body and hands are built in code)
- Drag the avatar sideways to look around. "Switch to 2D" is a fallback, and it is used automatically if WebGL is unavailable.
- It reads the same signLibrary.js poses as the 2D avatar, so new signs show up in both.

## Troubleshooting: "no hand pose detected"
- The hero phone with the stick hand is only a looping demo. Real tracking runs in the studio, which opens after you click "Allow camera & microphone". If that button is missing, you are not running the React files.
- In your project root, run:
  npm i @mediapipe/tasks-vision three
  mkdir -p public/models public/mediapipe
  cp -r node_modules/@mediapipe/tasks-vision/wasm public/mediapipe/
  curl -L -o public/models/hand_landmarker.task https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- Restart the dev server. Yellow dots should now follow your hand on the camera, with a "Hand detected" label.
- Signs are only recognized once a pack exists. Type a label (e.g. HELP), hold the sign, press Capture a few times, then Download pack and save it as public/packs/default.json.
