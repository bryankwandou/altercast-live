/* ═══════════════════════════════════════════════════════════
   AlterCast — OBS WebSocket v5 Client
   Pure browser-side client (no library). Implements minimal
   handshake + identify + RequestBatch for scene/stream control.

   Reference: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
   Default URL: ws://localhost:4455
═══════════════════════════════════════════════════════════ */

import { store } from "./store.js";

let ws = null;
let connected = false;
let pendingRequests = new Map(); // requestId -> {resolve, reject}
let nextReqId = 1;
let helloAuth = null;

export async function connectOBS({ url, password = "" } = {}) {
  url = url || store.get("obsUrl") || "ws://localhost:4455";
  return new Promise((resolve, reject) => {
    if (ws) try { ws.close(); } catch (e) {}
    try {
      ws = new WebSocket(url);
    } catch (e) {
      return reject(e);
    }

    const timeout = setTimeout(() => {
      try { ws.close(); } catch (e) {}
      reject(new Error("OBS connection timeout"));
    }, 5000);

    ws.onopen = () => { /* await Hello */ };

    ws.onmessage = async (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }

      if (msg.op === 0) {
        /* Hello — respond with Identify (op 1) */
        helloAuth = msg.d.authentication;
        let authStr = undefined;
        if (helloAuth && password) {
          authStr = await computeAuth(password, helloAuth.salt, helloAuth.challenge);
        }
        ws.send(JSON.stringify({
          op: 1,
          d: {
            rpcVersion: 1,
            eventSubscriptions: 33, /* General + Scenes + Outputs */
            authentication: authStr,
          },
        }));
      } else if (msg.op === 2) {
        /* Identified */
        clearTimeout(timeout);
        connected = true;
        store.set("isOBSConnected", true);
        resolve({ rpcVersion: msg.d.negotiatedRpcVersion });
      } else if (msg.op === 7) {
        /* RequestResponse */
        const { requestId, requestStatus, responseData } = msg.d;
        const pending = pendingRequests.get(requestId);
        if (pending) {
          pendingRequests.delete(requestId);
          if (requestStatus.result) pending.resolve(responseData);
          else pending.reject(new Error(requestStatus.comment || "OBS error"));
        }
      } else if (msg.op === 5) {
        /* Event */
        // console.log("[OBS event]", msg.d);
      }
    };

    ws.onerror = (e) => {
      clearTimeout(timeout);
      connected = false;
      store.set("isOBSConnected", false);
      reject(new Error("OBS connection error"));
    };

    ws.onclose = () => {
      connected = false;
      store.set("isOBSConnected", false);
      ws = null;
    };
  });
}

export function disconnectOBS() {
  if (ws) try { ws.close(); } catch (e) {}
  connected = false;
  store.set("isOBSConnected", false);
}

export function isConnected() { return connected; }

export function request(requestType, requestData = {}) {
  if (!connected || !ws) return Promise.reject(new Error("OBS not connected"));
  const requestId = String(nextReqId++);
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({
      op: 6,
      d: { requestType, requestId, requestData },
    }));
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("OBS request timeout: " + requestType));
      }
    }, 8000);
  });
}

/* Convenience wrappers */
export const obs = {
  getSceneList: () => request("GetSceneList"),
  setCurrentScene: (sceneName) => request("SetCurrentProgramScene", { sceneName }),
  startStream: () => request("StartStream"),
  stopStream: () => request("StopStream"),
  startRecord: () => request("StartRecord"),
  stopRecord: () => request("StopRecord"),
  getStreamStatus: () => request("GetStreamStatus"),
  triggerHotkey: (hotkeyName) => request("TriggerHotkeyByName", { hotkeyName }),
};

/* SHA256 base64 (auth handshake) */
async function computeAuth(password, salt, challenge) {
  const enc = new TextEncoder();
  const step1 = await crypto.subtle.digest("SHA-256", enc.encode(password + salt));
  const step1b64 = base64FromBuffer(step1);
  const step2 = await crypto.subtle.digest("SHA-256", enc.encode(step1b64 + challenge));
  return base64FromBuffer(step2);
}

function base64FromBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
