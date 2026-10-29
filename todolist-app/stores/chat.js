/**
 * @file chat.js
 * @description 全局聊天状态（由 React ChatContext 迁移）。
 *
 * 规范（client-uni）：
 * - 纯 JavaScript + Pinia setup store（无 TypeScript）
 * - WebSocket 使用 uni.connectSocket（非浏览器 WebSocket）
 * - 持久化走 utils/storage（uni.setStorageSync）
 * - H5 专属能力用条件编译（ifdef H5）
 *
 * 职责：WS 连接、消息/未读/最后消息、离线 outbox、前后台与语言切换重连。
 * 服务端负载友好：
 * - 全局 WS 上限 + LRU 驱逐（避免连接只增不减）
 * - 重连指数退避带抖动；前台恢复/切语言错峰重连（削峰）
 *
 * 依赖：i18n、chatTime、chatConnectNotice、uiLanguage、storage
 * 页面：messages、chat、AppTabBar（未读角标）
 */
import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { i18n } from "@/i18n";
import { formatNowMessageTime } from "@/utils/chatTime";
import { isWsConnectWelcomeNotice } from "@/utils/chatConnectNotice";
import { normalizeUiLang } from "@/utils/uiLanguage";
import { getItem, setItem, getToken } from "@/utils/storage";

const CHAT_SYNC_CHANNEL = "chat-meta-sync-v1";
const MAX_MESSAGES = 5000;
const MESSAGE_TRIM_TARGET = 3000;
/** 单客户端同时持有的 WS 上限（当前聊天 + 后台预连 + 余量） */
const MAX_WS_CONNECTIONS = 4;
/** 前台恢复时按 companion 错开重连的基础间隔（ms） */
const RECONNECT_STAGGER_MS = 180;

/** 解析 WebSocket 根地址：优先 VITE_WS_URL；H5 用当前 host；App 由 API_BASE 推导 */
function getWsOrigin() {
  // const explicit = (import.meta.env.VITE_WS_URL || "").trim();
  // if (explicit) return explicit.replace(/\/$/, "");
  // // #ifdef H5
  // try {
  //   const proto = location.protocol === "https:" ? "wss" : "ws";
  //   return `${proto}://${location.host}`;
  // } catch {
  //   /* fallthrough */
  // }
  // // #endif
  // const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  // if (apiBase.startsWith("https://")) return apiBase.replace(/^https:/, "wss:");
  // if (apiBase.startsWith("http://")) return apiBase.replace(/^http:/, "ws:");
  return "wss://www.trandsai.com";
}

/** 组装发往服务端的聊天 payload（含时区） */
function buildChatWsPayload(text, lang, userGender) {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    /* ignore */
  }
  let tz_offset;
  try {
    tz_offset = new Date().getTimezoneOffset();
  } catch {
    /* ignore */
  }
  return { text, lang, user_gender: userGender, tz, tz_offset };
}

/** 去重键：sender + 类型标识 + 文本 */
function messageContentKey(m) {
  const type = m.momentData ? "moment" : "normal";
  return `${m.sender}\0${type}\0${(m.text || "").trim()}`;
}

/** 排序键：优先用 ts，回退 timestamp */
function timeKey(m) {
  const raw = m.ts || m.timestamp || "";
  const ms = raw ? Date.parse(raw) : 0;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * 全局聊天 Pinia Store
 */
export const useChatStore = defineStore("chat", () => {
  // ——— 对外响应式状态 ———
  const messages = ref([]);
  const unreadCounts = ref({});
  const lastMessages = ref({});
  const isConnected = ref({});
  const typingCompanions = ref({});
  const activeCompanionId = ref(null);
  const ephemeral = ref({});
  const sendingMsgIds = ref(new Set());
  const pendingMsgIds = ref(new Set());

  // ——— 连接与重连内部表（非响应式） ———
  let msgIdCounter = 1000000;
  const connections = {};
  const reconnectTimers = {};
  const reconnectAttempts = {};
  const intentionallyClosed = {};
  /** 希望保持连接的 companion；LRU 驱逐时会剔除 */
  const trackedCompanionIds = new Set();
  /** companionId → 最近活跃时间戳（收发消息 / 进入聊天页） */
  const lastActiveAt = {};
  /** 前台恢复 / 语言切换时的错峰定时器列表 */
  let staggerTimers = [];
  let visibilityReconnectTimer = null;
  let languageReconnectTimer = null;
  const outbox = {};
  const queueNoticeSent = {};
  let persistTimer = null;
  const pendingPersist = {};
  let syncChannel = null;
  let suppressSync = false;

  function nextMsgId() {
    return msgIdCounter++;
  }

  /** 标记 companion 活跃，供 LRU 保留 */
  function touchActive(companionId) {
    if (!companionId) return;
    lastActiveAt[companionId] = Date.now();
  }

  /** 指数退避 + ±30% 抖动，避免大量客户端同步重连 */
  function reconnectDelayMs(attempts) {
    const base = Math.min(1000 * Math.pow(2, attempts), 30000);
    const jitter = 0.7 + Math.random() * 0.6;
    return Math.floor(base * jitter);
  }

  function clearStaggerTimers() {
    for (const t of staggerTimers) clearTimeout(t);
    staggerTimers = [];
  }

  /**
   * 连接数超限时断开最久未活跃的连接（永不踢掉当前聊天页 companion）
   * @param {string} [protectId] 即将连接 / 必须保留的 id
   */
  function evictLruIfNeeded(protectId) {
    const openIds = Object.keys(connections);
    if (openIds.length < MAX_WS_CONNECTIONS) return;

    const protectedIds = new Set();
    if (protectId) protectedIds.add(protectId);
    if (activeCompanionId.value) protectedIds.add(activeCompanionId.value);

    const victims = openIds
      .filter((id) => !protectedIds.has(id))
      .sort((a, b) => (lastActiveAt[a] || 0) - (lastActiveAt[b] || 0));

    const need = openIds.length - MAX_WS_CONNECTIONS + 1;
    for (let i = 0; i < need && i < victims.length; i++) {
      const id = victims[i];
      trackedCompanionIds.delete(id);
      disconnect(id);
    }
  }

  /**
   * 错峰重连一组 companion（前台恢复 / 切语言）
   * @param {Iterable<string>} ids
   * @param {number} [baseDelay=400]
   * @param {{ force?: boolean }} [opts] force=true 时强制拆掉已有连接再连（如切语言）
   */
  function reconnectTrackedStaggered(ids, baseDelay = 400, opts = {}) {
    clearStaggerTimers();
    const force = opts.force === true;
    const list = Array.from(ids);
    list.forEach((cid, idx) => {
      const jitter = Math.floor(Math.random() * 120);
      const t = setTimeout(() => {
        connect(cid, { force });
      }, baseDelay + idx * RECONNECT_STAGGER_MS + jitter);
      staggerTimers.push(t);
    });
  }

  function getLang() {
    return normalizeUiLang(i18n.global.locale.value);
  }

  function getUserGender() {
    try {
      const userInfoStr = getItem("user_info");
      return userInfoStr ? JSON.parse(userInfoStr).gender || "" : "";
    } catch {
      return "";
    }
  }

  function localeForTime() {
    return i18n.global.locale.value || "zh";
  }

  // ——— 消息列表操作 ———
  function appendMessages(newMsgs) {
    if (!newMsgs?.length) return;
    const base = messages.value ?? [];
    const next = [...base, ...newMsgs];
    messages.value =
      next.length > MAX_MESSAGES ? next.slice(-MESSAGE_TRIM_TARGET) : next;
  }

  function dismissMessage(id) {
    messages.value = (messages.value ?? []).filter((m) => m.id !== id);
    const next = { ...ephemeral.value };
    for (const cid of Object.keys(next)) {
      next[cid] = next[cid].filter((m) => m.id !== id);
      if (next[cid].length === 0) delete next[cid];
    }
    ephemeral.value = next;
  }

  function appendEphemeral(msg) {
    ephemeral.value = {
      ...ephemeral.value,
      [msg.companionId]: [...(ephemeral.value[msg.companionId] || []), msg],
    };
  }

  function flushOutboxForCompanion(companionId) {
    const task = connections[companionId];
    if (!task || !isConnected.value[companionId]) return;
    const pending = outbox[companionId];
    if (!pending?.length) return;
    const lang = getLang();
    const userGender = getUserGender();
    for (const queued of pending) {
      try {
        sendingMsgIds.value.add(queued.msgId);
        pendingMsgIds.value.delete(queued.msgId);
        task.send({
          data: JSON.stringify(buildChatWsPayload(queued.text, lang, userGender)),
        });
      } catch (err) {
        console.error("发送队列消息失败:", err);
        sendingMsgIds.value.delete(queued.msgId);
        pendingMsgIds.value.add(queued.msgId);
        break;
      }
    }
    delete outbox[companionId];
  }

  // ——— 未读 / 最后消息持久化 + H5 BroadcastChannel ———
  function flushPersist() {
    if (pendingPersist.unread !== undefined) {
      setItem("chat_unread", JSON.stringify(pendingPersist.unread));
    }
    if (pendingPersist.last !== undefined) {
      setItem("chat_last_messages", JSON.stringify(pendingPersist.last));
    }
    pendingPersist.unread = undefined;
    pendingPersist.last = undefined;
    persistTimer = null;
  }

  function schedulePersist(patch) {
    if (patch.unread !== undefined) pendingPersist.unread = patch.unread;
    if (patch.last !== undefined) pendingPersist.last = patch.last;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(flushPersist, 300);
  }

  function initFromStorage() {
    const saved = getItem("chat_unread");
    if (saved) {
      try {
        unreadCounts.value = JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    const savedLast = getItem("chat_last_messages");
    if (savedLast) {
      try {
        lastMessages.value = JSON.parse(savedLast);
      } catch {
        /* ignore */
      }
    }
  }

  function initBroadcastSync() {
    // #ifdef H5
    if (typeof BroadcastChannel === "undefined") return;
    syncChannel = new BroadcastChannel(CHAT_SYNC_CHANNEL);
    syncChannel.onmessage = (event) => {
      const data = event.data;
      if (!data || data.type !== "meta") return;
      suppressSync = true;
      if (data.unreadCounts) unreadCounts.value = data.unreadCounts;
      if (data.lastMessages) lastMessages.value = data.lastMessages;
      setTimeout(() => {
        suppressSync = false;
      }, 0);
    };
    // #endif
  }

  function postMetaSync() {
    if (suppressSync || !syncChannel) return;
    // BroadcastChannel uses structured clone; Vue Proxies are not cloneable.
    try {
      syncChannel.postMessage({
        type: "meta",
        unreadCounts: JSON.parse(JSON.stringify(unreadCounts.value)),
        lastMessages: JSON.parse(JSON.stringify(lastMessages.value)),
      });
    } catch (err) {
      console.warn("chat meta sync failed:", err);
    }
  }

  // ——— 历史 REST 与内存消息合并 ———
  function mergeHistoryMessages(companionId, incoming, mode) {
    const base = messages.value ?? [];
    const forCompanion = base.filter((m) => m.companionId === companionId);
    const others = base.filter((m) => m.companionId !== companionId);

    if (mode === "initial") {
      const restKeys = new Set(incoming.map(messageContentKey));
      const liveOnly = forCompanion.filter(
        (m) => !restKeys.has(messageContentKey(m))
      );
      const seen = new Set();
      const merged = [];
      for (const m of [...incoming, ...liveOnly]) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          merged.push(m);
        }
      }
      merged.sort((a, b) => timeKey(a) - timeKey(b));
      messages.value = [...others, ...merged];
      return;
    }

    const existingKeys = new Set(forCompanion.map(messageContentKey));
    const older = incoming.filter(
      (m) => !existingKeys.has(messageContentKey(m))
    );
    const merged = [...older, ...forCompanion];
    merged.sort((a, b) => timeKey(a) - timeKey(b));
    messages.value = [...others, ...merged];
  }

  // ——— WebSocket 连接 / 收消息 / 指数退避重连 ———
  /**
   * @param {string} companionId
   * @param {{ force?: boolean }} [opts] force=true 时关掉已有连接再重建（切语言等）
   */
  function connect(companionId, opts = {}) {
    if (!companionId) return;
    trackedCompanionIds.add(companionId);
    touchActive(companionId);
    const force = opts.force === true;
    const existing = connections[companionId];

    // 已连通或握手中：勿 close，否则浏览器会报 “closed before the connection is established”
    if (existing && !force) return;

    if (existing) {
      intentionallyClosed[companionId] = true;
      try {
        existing.close({});
      } catch {
        /* ignore */
      }
      delete connections[companionId];
    }

    if (reconnectTimers[companionId]) {
      clearTimeout(reconnectTimers[companionId]);
      delete reconnectTimers[companionId];
    }

    // 新连接前腾出槽位，避免人均连接膨胀压垮服务端
    evictLruIfNeeded(companionId);

    intentionallyClosed[companionId] = false;

    const lang = getLang();
    const token = getToken() || "";
    const origin = getWsOrigin();
    const wsUrl = `${origin}/ws/chat/${companionId}?lang=${encodeURIComponent(lang)}&token=${encodeURIComponent(token)}`;

    // 必须传 complete/success/fail 之一，才会同步返回 SocketTask（否则是 Promise）
    const task = uni.connectSocket({
      url: wsUrl,
      complete: () => {},
    });
    connections[companionId] = task;

    task.onOpen(() => {
      isConnected.value = { ...isConnected.value, [companionId]: true };
      reconnectAttempts[companionId] = 0;
      queueNoticeSent[companionId] = false;
      touchActive(companionId);
      flushOutboxForCompanion(companionId);
    });

    task.onMessage((event) => {
      try {
        const data = JSON.parse(event.data);
        const locale = localeForTime();
        touchActive(companionId);

        if (data.type === "toast") {
          const text = data.text || "";
          const t = text.trimStart();
          if (t.startsWith("💭")) {
            const thinkId = nextMsgId();
            appendEphemeral({
              id: thinkId,
              companionId,
              sender: "thinking",
              text,
              time: formatNowMessageTime(locale),
              ts: new Date().toISOString(),
            });
            setTimeout(() => dismissMessage(thinkId), 5000);
          }
        } else if (
          data.type === "filler" &&
          typeof data.text === "string" &&
          data.text.trim()
        ) {
          const fillId = nextMsgId();
          appendEphemeral({
            id: fillId,
            companionId,
            sender: "filler",
            text: data.text.trim(),
            time: formatNowMessageTime(locale),
            ts: new Date().toISOString(),
          });
          setTimeout(() => dismissMessage(fillId), 4500);
        } else if (data.type === "system" && data.text) {
          const sysText = String(data.text);
          if (!isWsConnectWelcomeNotice(sysText)) {
            appendMessages([
              {
                id: nextMsgId(),
                companionId,
                sender: "system",
                text: sysText,
                time: formatNowMessageTime(locale),
                ts: new Date().toISOString(),
              },
            ]);
          }
        } else if (data.type === "typing") {
          typingCompanions.value = {
            ...typingCompanions.value,
            [companionId]: true,
          };
          const userMsgs = (messages.value ?? []).filter(
            (m) => m.companionId === companionId && m.sender === "user"
          );
          for (const m of userMsgs) {
            sendingMsgIds.value.delete(m.id);
          }
        } else if (data.type === "message" && data.role === "assistant") {
          const text = data.text || "";
          const time = formatNowMessageTime(locale);
          typingCompanions.value = {
            ...typingCompanions.value,
            [companionId]: false,
          };
          const userMsgs = (messages.value ?? []).filter(
            (m) => m.companionId === companionId && m.sender === "user"
          );
          for (const m of userMsgs) {
            sendingMsgIds.value.delete(m.id);
          }
          lastMessages.value = {
            ...lastMessages.value,
            [companionId]: {
              text,
              time,
              fullTime: new Date().toISOString(),
            },
          };
          appendMessages([
            {
              id: nextMsgId(),
              companionId,
              sender: "ai",
              text,
              time,
              ts: new Date().toISOString(),
            },
          ]);
          if (activeCompanionId.value !== companionId) {
            unreadCounts.value = {
              ...unreadCounts.value,
              [companionId]: (unreadCounts.value[companionId] || 0) + 1,
            };
          }
        } else if (data.type === "message" && data.role === "moment") {
          const time = formatNowMessageTime(locale);
          let text = data.content || "";
          let momentData = null;
          try {
            const parsed = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
            momentData = parsed;
            text = parsed.caption || JSON.stringify(parsed);
          } catch {
            text = data.content || "";
          }
          typingCompanions.value = {
            ...typingCompanions.value,
            [companionId]: false,
          };
          const userMsgs = (messages.value ?? []).filter(
            (m) => m.companionId === companionId && m.sender === "user"
          );
          for (const m of userMsgs) {
            sendingMsgIds.value.delete(m.id);
          }
          lastMessages.value = {
            ...lastMessages.value,
            [companionId]: {
              text,
              time,
              fullTime: new Date().toISOString(),
            },
          };
          appendMessages([
            {
              id: nextMsgId(),
              companionId,
              sender: "user",
              text,
              momentData,
              time,
              ts: new Date().toISOString(),
            },
          ]);
        } else if (data.type === "error") {
          typingCompanions.value = {
            ...typingCompanions.value,
            [companionId]: false,
          };
          const detail =
            typeof data.text === "string" && data.text.trim()
              ? data.text.trim()
              : i18n.global.t("chat.connectionAbnormal");
          appendMessages([
            {
              id: nextMsgId(),
              companionId,
              sender: "ai",
              text: detail,
              time: formatNowMessageTime(locale),
              ts: new Date().toISOString(),
            },
          ]);
        }
      } catch (e) {
        console.error("解析消息失败:", e);
      }
    });

    task.onError(() => {
      isConnected.value = { ...isConnected.value, [companionId]: false };
    });

    task.onClose(() => {
      isConnected.value = { ...isConnected.value, [companionId]: false };
      typingCompanions.value = {
        ...typingCompanions.value,
        [companionId]: false,
      };
      if (connections[companionId] === task) {
        delete connections[companionId];
      }
      if (!intentionallyClosed[companionId]) {
        const attempts = reconnectAttempts[companionId] || 0;
        if (attempts < 12) {
          reconnectAttempts[companionId] = attempts + 1;
          const delay = reconnectDelayMs(attempts);
          reconnectTimers[companionId] = setTimeout(
            () => connect(companionId),
            delay
          );
        }
      }
    });
  }

  function disconnect(companionId) {
    intentionallyClosed[companionId] = true;
    if (reconnectTimers[companionId]) {
      clearTimeout(reconnectTimers[companionId]);
      delete reconnectTimers[companionId];
    }
    const task = connections[companionId];
    if (task) {
      try {
        task.close({});
      } catch {
        /* ignore */
      }
      delete connections[companionId];
    }
    isConnected.value = { ...isConnected.value, [companionId]: false };
  }

  function disconnectAll() {
    clearStaggerTimers();
    for (const cid of Object.keys(connections)) {
      intentionallyClosed[cid] = true;
      if (reconnectTimers[cid]) {
        clearTimeout(reconnectTimers[cid]);
        delete reconnectTimers[cid];
      }
      try {
        connections[cid]?.close({});
      } catch {
        /* ignore */
      }
      delete connections[cid];
    }
    trackedCompanionIds.clear();
    for (const k of Object.keys(lastActiveAt)) delete lastActiveAt[k];
    isConnected.value = {};
    typingCompanions.value = {};
  }

  // ——— 发送（含离线 outbox） ———
  function sendMessage(companionId, text) {
    touchActive(companionId);
    const locale = localeForTime();
    const msgId = nextMsgId();
    appendMessages([
      {
        id: msgId,
        companionId,
        sender: "user",
        text,
        time: formatNowMessageTime(locale),
        ts: new Date().toISOString(),
      },
    ]);
    lastMessages.value = {
      ...lastMessages.value,
      [companionId]: {
        text,
        time: formatNowMessageTime(locale),
        fullTime: new Date().toISOString(),
      },
    };

    const task = connections[companionId];
    const lang = getLang();
    const userGender = getUserGender();

    if (task && isConnected.value[companionId]) {
      flushOutboxForCompanion(companionId);
      try {
        sendingMsgIds.value.add(msgId);
        task.send({
          data: JSON.stringify(buildChatWsPayload(text, lang, userGender)),
        });
        typingCompanions.value = {
          ...typingCompanions.value,
          [companionId]: true,
        };
      } catch (err) {
        console.error("发送消息失败:", err);
        sendingMsgIds.value.delete(msgId);
        pendingMsgIds.value.add(msgId);
        const pending = outbox[companionId] || [];
        pending.push({ text, msgId });
        outbox[companionId] = pending;
        appendMessages([
          {
            id: nextMsgId(),
            companionId,
            sender: "system",
            text: i18n.global.t("chat.messageQueued"),
            time: formatNowMessageTime(locale),
            ts: new Date().toISOString(),
          },
        ]);
      }
    } else {
      pendingMsgIds.value.add(msgId);
      const pending = outbox[companionId] || [];
      pending.push({ text, msgId });
      outbox[companionId] = pending;
      reconnectAttempts[companionId] = 0;
      connect(companionId);
      if (!queueNoticeSent[companionId]) {
        queueNoticeSent[companionId] = true;
        appendMessages([
          {
            id: nextMsgId(),
            companionId,
            sender: "system",
            text: i18n.global.t("chat.messageQueued"),
            time: formatNowMessageTime(locale),
            ts: new Date().toISOString(),
          },
        ]);
      }
    }
  }

  function clearUnread(companionId) {
    const next = { ...unreadCounts.value };
    delete next[companionId];
    unreadCounts.value = next;
  }

  function clearMessages(companionId) {
    const companionMsgs = (messages.value ?? []).filter(
      (m) => m.companionId === companionId
    );
    for (const m of companionMsgs) {
      sendingMsgIds.value.delete(m.id);
      pendingMsgIds.value.delete(m.id);
    }
    messages.value = (messages.value ?? []).filter(
      (m) => m.companionId !== companionId
    );
    const nextLast = { ...lastMessages.value };
    delete nextLast[companionId];
    lastMessages.value = nextLast;
    const nextUnread = { ...unreadCounts.value };
    delete nextUnread[companionId];
    unreadCounts.value = nextUnread;
    delete outbox[companionId];
    queueNoticeSent[companionId] = false;
    const nextEphemeral = { ...ephemeral.value };
    delete nextEphemeral[companionId];
    ephemeral.value = nextEphemeral;
  }

  function getCompanionMessages(companionId) {
    return (messages.value ?? []).filter((m) => m.companionId === companionId);
  }

  function getDisplayMessages(companionId) {
    const base = getCompanionMessages(companionId);
    const extra = ephemeral.value[companionId] || [];
    return extra.length ? [...base, ...extra] : base;
  }

  function setActiveCompanionId(id) {
    activeCompanionId.value = id;
    if (id) touchActive(id);
  }

  // ——— 生命周期 ———
  function onAppShow() {
    if (visibilityReconnectTimer) clearTimeout(visibilityReconnectTimer);
    visibilityReconnectTimer = setTimeout(() => {
      visibilityReconnectTimer = null;
      for (const k of Object.keys(reconnectAttempts)) delete reconnectAttempts[k];
      // 优先当前聊天 + 最近活跃，且只重连上限条数，避免「全部重连再 LRU 踢掉」浪费握手
      const preferred = [];
      if (activeCompanionId.value) preferred.push(activeCompanionId.value);
      const rest = Array.from(trackedCompanionIds)
        .filter((id) => id !== activeCompanionId.value)
        .sort((a, b) => (lastActiveAt[b] || 0) - (lastActiveAt[a] || 0));
      const ordered = [...preferred, ...rest];
      const keep = ordered.slice(0, MAX_WS_CONNECTIONS);
      for (const id of ordered.slice(MAX_WS_CONNECTIONS)) {
        trackedCompanionIds.delete(id);
      }
      reconnectTrackedStaggered(
        keep,
        280 + Math.floor(Math.random() * 200)
      );
    }, 400);
  }

  function onLanguageChanged() {
    if (languageReconnectTimer) clearTimeout(languageReconnectTimer);
    languageReconnectTimer = setTimeout(() => {
      languageReconnectTimer = null;
      for (const k of Object.keys(reconnectAttempts)) delete reconnectAttempts[k];
      const ordered = Array.from(trackedCompanionIds).sort(
        (a, b) => (lastActiveAt[b] || 0) - (lastActiveAt[a] || 0)
      );
      const keep = ordered.slice(0, MAX_WS_CONNECTIONS);
      for (const id of ordered.slice(MAX_WS_CONNECTIONS)) {
        trackedCompanionIds.delete(id);
      }
      reconnectTrackedStaggered(
        keep,
        200 + Math.floor(Math.random() * 160),
        { force: true }
      );
    }, 320);
  }

  function setupLifecycle() {
    initFromStorage();
    initBroadcastSync();
    uni.onAppShow(onAppShow);
  }

  function watchPersistEffects() {
    watch(
      unreadCounts,
      (v) => {
        schedulePersist({ unread: v });
        postMetaSync();
      },
      { deep: true }
    );
    watch(
      lastMessages,
      (v) => {
        schedulePersist({ last: v });
        postMetaSync();
      },
      { deep: true }
    );
  }

  const totalUnread = computed(() =>
    Object.values(unreadCounts.value).reduce((a, b) => a + (b || 0), 0)
  );

  return {
    messages,
    unreadCounts,
    lastMessages,
    isConnected,
    typingCompanions,
    activeCompanionId,
    sendingMsgIds,
    pendingMsgIds,
    totalUnread,
    dismissMessage,
    mergeHistoryMessages,
    getCompanionMessages,
    getDisplayMessages,
    clearMessages,
    connect,
    disconnect,
    disconnectAll,
    sendMessage,
    setActiveCompanionId,
    clearUnread,
    setupLifecycle,
    watchPersistEffects,
    onLanguageChanged,
    onAppShow,
  };
});
