/* ═══════════════════════════════════════════════════════════
   AlterCast — Face Tracking via MediaPipe FaceLandmarker
   Loaded from CDN, runs in browser, no install.
   Maps webcam face landmarks → avatar head/eyes/mouth/blink.
   Gracefully degrades if MediaPipe / webcam unavailable.
═══════════════════════════════════════════════════════════ */

import { store } from "./store.js";

const MP_TASKS_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";
const MP_WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MP_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarker = null;
let stream = null;
let videoEl = null;
let running = false;
let onFrameCb = null;

export async function initFaceTracker(onFrame) {
  onFrameCb = onFrame;
  /* dynamic import so this is optional + lazy */
  try {
    const { FilesetResolver, FaceLandmarker } = await import(MP_TASKS_URL);
    const filesetResolver = await FilesetResolver.forVisionTasks(MP_WASM_URL);
    landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: MP_MODEL_URL, delegate: "GPU" },
      outputFaceBlendshapes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    return true;
  } catch (e) {
    console.warn("[FaceTracker] MediaPipe failed to load:", e.message);
    landmarker = null;
    return false;
  }
}

export async function startCamera() {
  if (running) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
  } catch (e) {
    console.warn("[FaceTracker] Camera permission denied:", e.message);
    return false;
  }
  videoEl = document.createElement("video");
  /* Kamera tetap jalan untuk face tracking, tapi tidak ditampilkan di layar */
  videoEl.style.cssText = "position:fixed;width:1px;height:1px;bottom:0;left:0;opacity:0;pointer-events:none;z-index:-1;";
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.muted = true;
  videoEl.srcObject = stream;
  document.body.appendChild(videoEl);
  await new Promise(r => videoEl.onloadeddata = r);
  running = true;
  loop();
  return true;
}

export function stopCamera() {
  running = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (videoEl) {
    videoEl.remove();
    videoEl = null;
  }
  store.set("mouthOpen", 0);
}

function loop() {
  if (!running || !videoEl) return;
  requestAnimationFrame(loop);

  if (!landmarker || videoEl.readyState < 2) return;

  const t = performance.now();
  let result;
  try {
    result = landmarker.detectForVideo(videoEl, t);
  } catch (e) {
    return;
  }

  if (!result.faceLandmarks?.length) return;
  const lm = result.faceLandmarks[0];

  /* Compute head pose from key landmarks */
  /* Approximation: nose (1) vs face center (152 chin) and forehead (10) */
  const nose = lm[1];
  const chin = lm[152];
  const fore = lm[10];
  const leftEar = lm[234];
  const rightEar = lm[454];

  /* Pitch: nose Y vs chin/forehead → up-down */
  const pitch = (nose.y - 0.5) * 1.2;
  /* Yaw: nose X vs ear midpoint → left-right */
  const earMidX = (leftEar.x + rightEar.x) / 2;
  const yaw = (earMidX - nose.x) * 2.2;

  store.set("headLook", { x: -pitch * 0.6, y: yaw * 1.4 });

  /* Eye gaze from iris landmarks (468-477 if iris model on, else use eye corners) */
  const leftEyeOuter = lm[33];
  const leftEyeInner = lm[133];
  const rightEyeOuter = lm[362];
  const rightEyeInner = lm[263];
  const eyeMidX = (leftEyeOuter.x + leftEyeInner.x + rightEyeOuter.x + rightEyeInner.x) / 4;
  const eyeOffsetX = (eyeMidX - nose.x) * 3;
  store.set("eyeLook", { x: eyeOffsetX, y: -pitch * 0.6 });

  /* Blendshapes (mouth, blink, smile) */
  const bs = result.faceBlendshapes?.[0]?.categories;
  if (bs) {
    const find = (name) => bs.find(b => b.categoryName === name)?.score || 0;
    const jawOpen = find("jawOpen");
    const mouthFunnel = find("mouthFunnel");
    const mouthPucker = find("mouthPucker");
    const mouthOpen = Math.max(jawOpen, mouthFunnel * 0.5);

    const eyeBlinkL = find("eyeBlinkLeft");
    const eyeBlinkR = find("eyeBlinkRight");
    const blink = (eyeBlinkL + eyeBlinkR) / 2;

    const smileL = find("mouthSmileLeft");
    const smileR = find("mouthSmileRight");
    const smile = (smileL + smileR) / 2;

    /* Drive avatar */
    store.set("mouthOpen", Math.min(1, mouthOpen * 1.4));

    /* Auto-switch emotion if smiling big */
    if (smile > 0.7 && store.get("emotion") === "idle") {
      store.set("emotion", "happy");
      clearTimeout(loop._reset);
      loop._reset = setTimeout(() => store.set("emotion", "idle"), 1500);
    }
  }

  if (onFrameCb) onFrameCb(lm, result.faceBlendshapes);
}

export function isAvailable() { return !!landmarker; }
export function isRunning() { return running; }
