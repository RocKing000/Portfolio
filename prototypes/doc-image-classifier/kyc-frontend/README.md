# KYC Document Scanner — Angular 17+ Frontend

A mobile-first Angular application for end-to-end KYC (Know Your Customer) verification.
Connects to the Python Vision Framework FastAPI backend.

## Features

- **Document scanning** — live camera feed with real-time auto-detection and overlay guide
- **Face capture** — oval guide with auto-detect at configurable confidence threshold
- **Liveness verification** — blink/smile/nod challenges sent to backend
- **Face matching** — side-by-side document photo vs selfie with score visualization
- **Result report** — downloadable JSON summary of the full KYC session
- **Responsive** — full-screen on mobile, centered card on desktop
- **Error handling** — toast notifications with user-friendly messages

---

## Getting Started

### Prerequisites

- Node.js 18+
- Angular CLI 17+: `npm install -g @angular/cli`

### Install

```bash
cd kyc-frontend
npm install
```

### Run (development)

```bash
ng serve
# Open http://localhost:4200
```

### Build for production

```bash
ng build --configuration production
# Output in dist/kyc-frontend/
```

---

## Connecting to the Backend

Edit `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',   // FastAPI backend URL
  wsUrl:  'ws://localhost:8000',     // WebSocket URL
  frameInterval: 200,                // ms between auto-scan frames
  maxScanAttempts: 50,               // ~10 seconds of auto-scan
  faceConfidenceThreshold: 0.95,     // face detection confidence to auto-capture
  livenessFrameCount: 10             // frames sent for liveness check
};
```

For production, edit `src/environments/environment.prod.ts` with your deployed API URL.

### Start the FastAPI backend

```bash
cd vision_framework
uvicorn api.fastapi_app:app --host 0.0.0.0 --port 8000 --reload
```

CORS is pre-configured on the backend for `http://localhost:4200`.

---

## Project Structure

```
src/app/
├── core/
│   ├── services/
│   │   ├── kyc-api.service.ts        # All HTTP calls to FastAPI
│   │   ├── camera.service.ts         # Native MediaDevices API wrapper
│   │   ├── frame-sampler.service.ts  # Auto-scan loop with early-exit logic
│   │   ├── websocket.service.ts      # WebSocket /ws/kyc/stream client
│   │   └── toast.service.ts          # Global toast notifications
│   ├── models/                       # TypeScript interfaces matching Python responses
│   ├── guards/                       # Camera permission guard
│   └── interceptors/                 # HTTP error → toast interceptor
│
├── features/
│   ├── kyc-flow/                     # Orchestrator: manages session & step transitions
│   ├── document-scanner/             # Camera + auto-scan + manual capture + result preview
│   ├── face-capture/                 # Position → liveness → match flow
│   ├── kyc-result/                   # Final APPROVED/REJECTED/NEEDS_REVIEW screen
│   └── permission-denied/            # Camera permission help screen
│
└── shared/
    ├── components/
    │   ├── document-overlay/         # Canvas rectangle guide (animated)
    │   ├── face-overlay/             # Canvas oval guide (animated)
    │   ├── progress-stepper/         # Document → Face → Complete indicator
    │   ├── status-indicator/         # Real-time scan stage feedback
    │   ├── camera-view/              # Reusable camera component
    │   └── result-card/              # Extracted document data card
    └── pipes/
        └── mask-number.pipe.ts       # Masks all but last 4 digits
```

---

## Adding a New KYC Step

1. Create a new feature component in `src/app/features/`
2. Add a new `KycStep` value in `core/models/kyc-session.model.ts`
3. Add a case in `kyc-flow.component.html`
4. Handle the output event in `kyc-flow.component.ts`
5. Add the step to `progress-stepper.component.ts`

---

## API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/framework/health` | Backend health check |
| POST | `/api/kyc/scan-document` | Multipart image upload |
| POST | `/api/kyc/scan-document-json` | Base64 JSON image |
| POST | `/api/kyc/capture-face` | Face detection |
| POST | `/api/kyc/verify-liveness` | Liveness frames |
| POST | `/api/kyc/match-face` | Face similarity |
| WS   | `/ws/kyc/stream` | Real-time frame stream |

---

## Mobile Notes

- Camera uses `environment` (rear) facing mode for document scanning
- Camera uses `user` (front) facing mode for face capture
- Front camera feed is mirrored (`scaleX(-1)`) like a selfie app
- `playsinline` and `muted` attributes are required for iOS Safari autoplay
- Camera stops on component destroy to release device resources
