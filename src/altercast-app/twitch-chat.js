/* ═══════════════════════════════════════════════════════════
   AlterCast — Twitch IRC Anonymous Chat Reader
   Connects to wss://irc-ws.chat.twitch.tv:443 as anonymous user
   (justinfan{random}), joins #channel, parses PRIVMSG → chat events.

   No OAuth required for read-only.
═══════════════════════════════════════════════════════════ */

import { store } from "./store.js";

let ws = null;
let channel = null;
let onMessageCb = null;
let connected = false;

export function connectTwitch(channelName, onMessage) {
  channel = channelName.toLowerCase().replace(/^#/, "");
  onMessageCb = onMessage;
  return new Promise((resolve, reject) => {
    try {
      if (ws) try { ws.close(); } catch (e) {}
      ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    } catch (e) { return reject(e); }

    const nick = "justinfan" + Math.floor(Math.random() * 99999);
    let opened = false;

    ws.onopen = () => {
      opened = true;
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send("PASS SCHMOOPIIE");
      ws.send("NICK " + nick);
      ws.send("USER " + nick + " 8 * :" + nick);
      ws.send("JOIN #" + channel);
      connected = true;
      store.set("twitchChannel", channel);
      resolve({ channel, nick });
    };

    ws.onmessage = (ev) => {
      const text = ev.data;
      /* Multi-line possible */
      const lines = text.split("\r\n");
      for (const line of lines) {
        if (!line) continue;
        /* PING handler */
        if (line.startsWith("PING")) {
          ws.send("PONG :tmi.twitch.tv");
          continue;
        }
        const parsed = parseIRC(line);
        if (parsed && parsed.command === "PRIVMSG") {
          if (onMessageCb) onMessageCb({
            user: parsed.user || "anon",
            text: parsed.message,
            color: parsed.tags?.color || randomColor(parsed.user || ""),
            isMod: parsed.tags?.mod === "1",
            isSub: parsed.tags?.subscriber === "1",
            badges: parsed.tags?.badges || "",
          });
        }
      }
    };

    ws.onerror = (e) => {
      if (!opened) reject(new Error("Twitch IRC connection failed"));
    };
    ws.onclose = () => {
      connected = false;
    };

    setTimeout(() => {
      if (!opened) {
        try { ws.close(); } catch (e) {}
        reject(new Error("Twitch IRC connect timeout"));
      }
    }, 5000);
  });
}

export function disconnectTwitch() {
  if (ws) try { ws.close(); } catch (e) {}
  connected = false;
  ws = null;
}

export function isConnected() { return connected; }
export function getChannel() { return channel; }

function parseIRC(line) {
  /* Format: [@tags ]:nick!user@host COMMAND [params] :message */
  let tags = {};
  let rest = line;
  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ");
    const tagStr = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
    tagStr.split(";").forEach(t => {
      const [k, v] = t.split("=");
      tags[k] = v || "";
    });
  }
  let user = null;
  if (rest.startsWith(":")) {
    const sp = rest.indexOf(" ");
    const prefix = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
    const bang = prefix.indexOf("!");
    user = bang > 0 ? prefix.slice(0, bang) : prefix;
  }
  const sp = rest.indexOf(" ");
  const command = sp > 0 ? rest.slice(0, sp) : rest;
  const params = sp > 0 ? rest.slice(sp + 1) : "";
  let target = "", message = "";
  if (params.includes(" :")) {
    const idx = params.indexOf(" :");
    target = params.slice(0, idx);
    message = params.slice(idx + 2);
  } else if (params.startsWith(":")) {
    message = params.slice(1);
  } else {
    target = params;
  }
  return { tags, user, command, target, message };
}

function randomColor(seed) {
  /* Deterministic from username */
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}
