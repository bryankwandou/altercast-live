/* ═══════════════════════════════════════════════════════════
   AlterCast — Chat Panel Controller
   • Live mock chat stream
   • AI response queue with thinking indicator
   • Donation alerts
   • Manual user input → avatar speak
═══════════════════════════════════════════════════════════ */

import { store, MOCK_CHAT_INITIAL, MOCK_CHAT_LIVE } from "./store.js";
import { t, pickRandom } from "./i18n.js";
import { speak } from "./tts.js";

let nextId = 100;
let chatLoop = null;
let chatContainer = null;
let inputEl = null;
let onAIRespondCb = null;

export function initChat(containerEl, inputElement, sendBtn, onAIRespond) {
  chatContainer = containerEl;
  inputEl = inputElement;
  onAIRespondCb = onAIRespond;
  store.set("chatMessages", [...MOCK_CHAT_INITIAL]);
  render();

  sendBtn?.addEventListener("click", () => sendUserMessage());
  inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage();
    }
  });

  store.subscribe("chatMessages", render);
  store.subscribe("viewerCount", () => {/* updated externally */});
}

function sendUserMessage() {
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  appendChat({ id: nextId++, user: "kamu", color: "#00D4FF", text, isUser: true });
  /* avatar respond */
  setTimeout(() => {
    if (onAIRespondCb) onAIRespondCb(text);
  }, 200);
}

export function appendChat(msg) {
  const list = store.get("chatMessages");
  store.set("chatMessages", [...list, msg].slice(-50));
}

function render() {
  if (!chatContainer) return;
  const list = store.get("chatMessages");
  chatContainer.innerHTML = "";
  for (const m of list) {
    const row = document.createElement("div");
    row.className = "chat-row" + (m.isUser ? " me" : "") + (m.isDonation ? " donation" : "") + (m.isAI ? " ai" : "");
    row.innerHTML = `
      <div class="chat-av" style="background:${m.color}33;border-color:${m.color}66;color:${m.color}">${m.user.charAt(0).toUpperCase()}</div>
      <div class="chat-body">
        <div class="chat-meta"><span class="chat-user" style="color:${m.color}">${m.user}</span>${m.time ? `<span class="chat-time">${m.time}</span>` : ""}</div>
        <div class="chat-text">${escapeHtml(m.text)}</div>
      </div>
      ${m.amount ? `<div class="chat-amount">Rp ${m.amount.toLocaleString("id-ID")}</div>` : ""}
    `;
    chatContainer.appendChild(row);
  }
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

export function startLiveChat() {
  if (chatLoop) return;
  let idx = 0;
  chatLoop = setInterval(() => {
    if (!store.get("isLive")) return;
    const m = MOCK_CHAT_LIVE[idx % MOCK_CHAT_LIVE.length];
    idx++;
    appendChat({ ...m, id: nextId++ });
    /* random donation */
    if (Math.random() < 0.12) {
      appendChat({
        id: nextId++,
        user: m.user,
        color: m.color,
        text: "donasi! semangat!",
        amount: [5000, 10000, 25000, 50000, 100000][Math.floor(Math.random() * 5)],
        isDonation: true,
      });
    }
    /* AI auto-respond when in AFK mode */
    if (store.get("isAFKMode") && store.get("isAIActive") && Math.random() < 0.35) {
      setTimeout(() => onAIRespondCb && onAIRespondCb(m.text), 800);
    }
    /* viewer count growth */
    store.set("viewerCount", store.get("viewerCount") + Math.floor(Math.random() * 3));
  }, 2400);
}

export function stopLiveChat() {
  if (chatLoop) clearInterval(chatLoop);
  chatLoop = null;
}
