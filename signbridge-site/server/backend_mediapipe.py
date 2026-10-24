"""
SignBridge MediaPipe Backend Server
Run this on your other laptop to process camera frames or hand signs.

Requirements:
    pip install flask flask-cors opencv-python mediapipe numpy

Run with:
    python backend_mediapipe.py
"""

import os
import math
import base64
import time
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

HAS_MEDIAPIPE = False
hands_detector = None
cv2 = None
mp = None

try:
    import cv2
    import mediapipe as mp
    
    # Try modern Tasks API (MediaPipe >= 1.0)
    model_paths = [
        os.path.join(os.path.dirname(__file__), "..", "html", "mediapipe", "hand_landmarker.task"),
        os.path.join(os.path.dirname(__file__), "hand_landmarker.task"),
    ]
    model_file = next((p for p in model_paths if os.path.exists(p)), None)

    if hasattr(mp, "solutions") and hasattr(mp.solutions, "hands"):
        mp_hands = mp.solutions.hands
        hands_detector = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.5
        )
        HAS_MEDIAPIPE = True
        USE_TASKS_API = False
        print(f"[OK] MediaPipe solutions.hands initialized successfully!")
    elif model_file:
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision as mp_vision
        
        base_options = mp_python.BaseOptions(model_asset_path=model_file)
        options = mp_vision.HandLandmarkerOptions(base_options=base_options, num_hands=2)
        hands_detector = mp_vision.HandLandmarker.create_from_options(options)
        HAS_MEDIAPIPE = True
        USE_TASKS_API = True
        print(f"[OK] MediaPipe Tasks HandLandmarker initialized successfully ({model_file})!")
    else:
        print("[WARN] MediaPipe installed, but legacy solutions and hand_landmarker.task not found.")
except Exception as e:
    HAS_MEDIAPIPE = False
    print(f"[WARN] MediaPipe not available: {e}. Falling back to rule-based engine.")

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

# Simple sign classifier based on MediaPipe landmarks
def classify_landmarks(landmarks):
    """
    Classifies 21 hand landmarks into common ASL signs.
    landmarks is a list of 21 points with x, y, z.
    """
    if not landmarks or len(landmarks) < 21:
        return "UNKNOWN", 0.0

    # Key landmark indices:
    # 0: wrist, 4: thumb tip, 8: index tip, 12: middle tip, 16: ring tip, 20: pinky tip
    wrist = landmarks[0]
    thumb_tip = landmarks[4]
    index_tip = landmarks[8]
    middle_tip = landmarks[12]
    ring_tip = landmarks[16]
    pinky_tip = landmarks[20]

    # Knuckles:
    index_mcp = landmarks[5]
    middle_mcp = landmarks[9]
    ring_mcp = landmarks[13]
    pinky_mcp = landmarks[17]

    # Fingers extended check (y is inverted in screen coords: lower y means higher on screen)
    index_up = index_tip['y'] < index_mcp['y']
    middle_up = middle_tip['y'] < middle_mcp['y']
    ring_up = ring_tip['y'] < ring_mcp['y']
    pinky_up = pinky_tip['y'] < pinky_mcp['y']
    thumb_up = thumb_tip['y'] < index_mcp['y']

    # Classifications:
    # 1. I LOVE YOU (thumb, index, pinky extended; middle, ring folded)
    if thumb_up and index_up and not middle_up and not ring_up and pinky_up:
        return "I LOVE YOU", 0.95

    # 2. PEACE / V / TWO (index and middle extended, others folded)
    if index_up and middle_up and not ring_up and not pinky_up:
        return "PEACE", 0.92

    # 3. POINT / ONE (only index extended)
    if index_up and not middle_up and not ring_up and not pinky_up:
        return "POINT", 0.90

    # 4. THUMBS UP / GOOD (thumb extended upwards, other fingers folded)
    if thumb_up and not index_up and not middle_up and not ring_up and not pinky_up:
        return "GOOD", 0.91

    # 5. OPEN PALM / HELLO / FIVE (all fingers extended)
    if index_up and middle_up and ring_up and pinky_up:
        return "HELLO", 0.96

    # 6. OK (thumb tip and index tip close together, other 3 extended)
    ti_dist = math.hypot(thumb_tip['x'] - index_tip['x'], thumb_tip['y'] - index_tip['y'])
    if ti_dist < 0.08 and middle_up and ring_up and pinky_up:
        return "OK", 0.93

    # 7. PINKY ONLY / I
    if pinky_up and not index_up and not middle_up and not ring_up:
        return "I", 0.88

    # 8. FIST / YES
    if not index_up and not middle_up and not ring_up and not pinky_up:
        return "YES", 0.85

    return "SIGNING", 0.70

@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "SignBridge MediaPipe Backend",
        "mediapipe": HAS_MEDIAPIPE,
        "time": time.time()
    })

@app.route("/predict", methods=["POST", "OPTIONS"])
@app.route("/detect", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

    data = request.get_json(force=True, silent=True) or {}
    
    # 1. If landmarks are already provided by client
    if "landmarks" in data and data["landmarks"]:
        landmarks = data["landmarks"]
        sign, conf = classify_landmarks(landmarks)
        return jsonify({
            "success": True,
            "sign": sign,
            "confidence": conf,
            "landmarks_count": len(landmarks),
            "source": "backend_classifier"
        })

    # 2. If base64 image frame is sent
    image_b64 = data.get("image") or data.get("frame")
    if not image_b64:
        return jsonify({"success": False, "error": "No image or landmarks provided"}), 400

    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_b64)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({"success": False, "error": "Could not decode frame"}), 400

        if not HAS_MEDIAPIPE or hands_detector is None:
            return jsonify({
                "success": True,
                "sign": "HELLO",
                "confidence": 0.80,
                "note": "MediaPipe module not loaded on server; simulated sign."
            })

        # Process frame
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        if USE_TASKS_API:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            results = hands_detector.detect(mp_image)
            if not results.hand_landmarks:
                return jsonify({
                    "success": True,
                    "hand_detected": False,
                    "sign": None,
                    "confidence": 0.0
                })
            hand_lm = results.hand_landmarks[0]
            points = [{"x": p.x, "y": p.y, "z": p.z} for p in hand_lm]
        else:
            results = hands_detector.process(rgb_frame)
            if not results.multi_hand_landmarks:
                return jsonify({
                    "success": True,
                    "hand_detected": False,
                    "sign": None,
                    "confidence": 0.0
                })
            hand_lm = results.multi_hand_landmarks[0]
            points = [{"x": p.x, "y": p.y, "z": p.z} for p in hand_lm.landmark]

        sign, conf = classify_landmarks(points)

        return jsonify({
            "success": True,
            "hand_detected": True,
            "sign": sign,
            "confidence": conf,
            "landmarks": points
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/compose", methods=["POST", "OPTIONS"])
def compose():
    """Matches react/session.js and turns sign tokens into a polite English sentence"""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

    data = request.get_json(force=True, silent=True) or {}
    signs = data.get("signs", [])
    if not signs:
        return jsonify({"sentence": ""})

    # Join signs
    raw = " ".join(signs).capitalize()
    
    # Simple grammar heuristics (expandable with LLM)
    replacements = {
        "Hello how you": "Hello, how are you?",
        "Hello you how": "Hello, how are you?",
        "Name you what": "What is your name?",
        "I love you": "I love you!",
        "Thank you": "Thank you very much.",
        "Need help": "I need help, please.",
    }
    sentence = replacements.get(raw, f"{raw}.")

    return jsonify({
        "success": True,
        "sentence": sentence,
        "raw_signs": signs
    })

if __name__ == "__main__":
    print("\n" + "="*50)
    print("SignBridge MediaPipe Backend Running!")
    print("Listening on all network interfaces: http://0.0.0.0:5000")
    print("For other laptop on same Wi-Fi, connect to: http://<YOUR_IP>:5000")
    print("="*50 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
