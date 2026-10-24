# SignBridge Backend Server (For Your Other Laptop)

This backend runs **MediaPipe Hand Tracking & ASL Sign Detection** and connects to the SignBridge frontend running on this or any other computer.

---

## 1. Quick Start on the Other Laptop

### Step 1: Install Dependencies
Open terminal / command prompt on the laptop where your backend runs:
```bash
pip install flask flask-cors opencv-python mediapipe numpy
```

### Step 2: Run the Server
```bash
python backend_mediapipe.py
```
It will display:
```text
🚀 SignBridge MediaPipe Backend Running!
🌐 Listening on all network interfaces: http://0.0.0.0:5000
```

---

## 2. Connect from Frontend

1. Find the other laptop's IP address:
   - Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux).
   - Find IPv4 address (e.g. `192.168.1.45`).
2. In the SignBridge webpage (Camera Section):
   - Enter `http://192.168.1.45:5000` into the **Backend URL** box.
   - Click **⚡ Connect**.
   - Start your camera and sign!

---

## 3. Endpoints Provided

| Endpoint | Method | Purpose | Payload |
|---|---|---|---|
| `/health` | `GET` | Health check & latency ping | None |
| `/predict` | `POST` | Processes camera frame or hand landmarks | `{"image": "data:image/jpeg;base64,..."}` or `{"landmarks": [...]}` |
| `/detect` | `POST` | Alias for `/predict` | Same as `/predict` |
| `/api/compose` | `POST` | Converts sign tokens into polite English | `{"signs": ["HELLO", "YOU", "HOW"]}` |
