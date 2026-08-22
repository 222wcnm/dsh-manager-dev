'use strict';

// DSH Manager — background service worker
//
// 职责（docs/design.md §8.3）：
//   1. 串行化 native 调用：模块级 promise 链，一次只允许一个 connectNative 连接；
//   2. Native Messaging 消息收发：帧格式（4 字节小端长度前缀 + UTF-8 JSON）由
//      Chrome 平台与宿主（native-host/host.js §6.1）两侧实现，扩展只收发
//      JSON 对象，绝不手动编解码帧（Chrome 会自动序列化/反序列化）；
//   3. 本地健康探测（fetch GET /，1.5s 超时，任何 HTTP 响应码都算 up）；
//   4. chrome.alarms 周期刷新图标徽标；
//   5. onInstalled 初始化默认设置。
//
// 注意：MV3 下本文件是经典脚本（无 import/export），全局作用域即 SW 作用域。

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const NATIVE_HOST = 'com.dsh.manager';
const DEFAULT_SETTINGS = {
  port: 3080,
  profile: 'web',
  autoOpen: true,
  badgeInterval: 30, // 秒；chrome.alarms 最小周期 0.5 分钟（30s）
  attention: true,   // M8：徽标提醒「该点回来看看了」（design §8.9）
  theme: 'follow-webui', // M6：与 popup.js 默认值保持一致（防 onInstalled 合并丢弃主题）
};
const PROBE_TIMEOUT_MS = 1500; // 探活超时
const NATIVE_TIMEOUT_MS = 30000; // 等待宿主响应兜底超时（默认）
// 按动作区分兜底超时：宿主内 stop(≤10s)+start(≤30s) 串行执行的 restart 需更长，
// 避免长操作被默认 30s 误判为「宿主无响应」→ NATIVE_ERROR（与 design §6.3 一致）
const ACTION_TIMEOUT_MS = {
  restart: 120000,
  start: 60000,
  stop: 45000,
  adopt: 45000,
};

// ---------------------------------------------------------------------------
// M8 徽标提醒「该点回来看看了」（design §8.9）
// ---------------------------------------------------------------------------
// content script（panel.js）在 dsh Web UI 页面后台时监视会话状态标记：
//   - 一轮工作完成（点阵消失）→ kind:'done' → 琥珀「!」；
//   - 出现等待用户（批准/问答/计划审查）→ kind:'waiting' → 红「?」。
// 页面重新可见时发 clear。SW 侧持久化在 storage（attentionMap），
// 徽标渲染分优先级：waiting > done > 服务态（§8.3）。
// 安全：只接受带 sender.tab 的上报（扩展自身页面无 tab，不可伪造他 tab）；
// 只存 tabId + kind + 时间戳，不存任何页面内容。
const ATTENTION_STORE_KEY = 'attentionMap';
const ATTENTION_TTL_MS = 4 * 3600 * 1000; // 4h 兜底防僵尸键（正常由 clear/onRemoved/onStartup 清理）
const ATTENTION_BADGES = {
  // 色语义分层（design §8.9.1）：徽标=行动信号层——字符为主语义；
  // 「?」用「等你拍板」专用紫（不与状态层错误红 #ec1313 撞色）、「!」用琥珀（完成待办）
  waiting: { text: '?', bg: '#8b5cf6', fg: '#ffffff', title: 'dsh：正在等你（批准 / 问答 / 计划审查）——点回来看' },
  done: { text: '!', bg: '#f59e0b', fg: '#ffffff', title: 'dsh：有一轮工作完成——回来看看' },
};

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (data) => {
      const s = (data && data.settings) || {};
      resolve(Object.assign({}, DEFAULT_SETTINGS, s));
    });
  });
}

// 本地健康探测：GET http://127.0.0.1:<port>/，1.5s 超时；
// 任何 HTTP 响应码都算 up；fetch 抛错 -> false。
async function probePort(port) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch('http://127.0.0.1:' + port + '/', {
      signal: ctrl.signal,
      cache: 'no-store',
    });
    return { up: true };
  } catch (_) {
    return { up: false };
  } finally {
    clearTimeout(timer);
  }
}

// 未安装宿主的标准错误应答
function hostNotInstalled() {
  return {
    ok: false,
    error: {
      code: 'HOST_NOT_INSTALLED',
      message: '未安装宿主，请运行 native-host 目录下的 install.ps1 后重启浏览器',
    },
  };
}

// ---------------------------------------------------------------------------
// M8 徽标提醒状态（storage 为事实源；以下为镜像缓存，onChanged 保持同步）
// ---------------------------------------------------------------------------

let attentionCache = {};   // { [tabId]: {kind:'done'|'waiting', at} }
let lastStateBadge = null; // 最近一次服务态徽标（attention 存在时暂存）；SW 重启后由 refreshBadge 补
let cachedSettings = Object.assign({}, DEFAULT_SETTINGS);

// 启动/唤醒时载入提醒镜像（完成后立即按当前状态渲染一次徽标）
function loadAttentionOnce() {
  chrome.storage.local.get({ [ATTENTION_STORE_KEY]: {} }, (d) => {
    attentionCache = (d && d[ATTENTION_STORE_KEY]) || {};
    applyBadge();
  });
}

// 修剪：只保留两值枚举 kind 与 TTL 内的条目（防僵尸键/脏数据）
function pruneAttention(map) {
  const out = {};
  const now = Date.now();
  for (const key of Object.keys(map || {})) {
    const e = map[key];
    if (!e || (e.kind !== 'done' && e.kind !== 'waiting')) continue;
    if (!Number.isFinite(e.at) || now - e.at > ATTENTION_TTL_MS) continue;
    out[key] = { kind: e.kind, at: e.at };
  }
  return out;
}

// 优先级：waiting > done；同类取最新
function pickAttention() {
  let waiting = null;
  let done = null;
  for (const key of Object.keys(attentionCache)) {
    const e = attentionCache[key];
    if (!e) continue;
    if (e.kind === 'waiting' && (!waiting || e.at > waiting.at)) waiting = e;
    else if (e.kind === 'done' && (!done || e.at > done.at)) done = e;
  }
  return waiting || done;
}

// content script 上报：仅 sender.tab 存在且为 dsh 回环页时接受（页面来源），
// 键 = 真实 tabId；attention 关闭时忽略 set（design §8.9 item 4「关闭后忽略 set」）
async function handleAttention(msg, sender) {
  const tabId = sender && sender.tab && Number.isInteger(sender.tab.id) ? sender.tab.id : null;
  if (!tabId) return;
  // L3 加固：只接受 dsh 页面（127.0.0.1/localhost 回环）来源——扩展/其他页面的 content
  // script 无法伪造（其 tab.url 不在本扩展 host_permissions 内时不填充，同样被拒）
  const tabUrl = sender.tab.url;
  if (typeof tabUrl !== 'string' || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(tabUrl)) return;
  if (msg.op === 'clear') {
    if (!attentionCache[tabId]) return;
    delete attentionCache[tabId];
  } else if (msg.op === 'set') {
    if (cachedSettings.attention === false) return; // 关闭：忽略上报，不写 storage
    attentionCache[tabId] = { kind: msg.kind === 'waiting' ? 'waiting' : 'done', at: Date.now() };
  } else {
    return;
  }
  attentionCache = pruneAttention(attentionCache);
  try {
    await chrome.storage.local.set({ [ATTENTION_STORE_KEY]: attentionCache });
  } catch (_) { /* SW 生命周期竞态：缓存仍正确，下次 onChanged 收敛 */ }
  applyBadge();
}

// ---------------------------------------------------------------------------
// 串行 native 调用
// ---------------------------------------------------------------------------

// 模块级 promise 链：一次只允许一个 connectNative 连接，其余排队。
// 该状态允许 MV3 SW 重启后丢失：SW 被回收时已建立的 Native Messaging port 会随之
// 断开，调用方（popup）侧的消息通道也会关闭并收到 reject，不会永久挂起；
// 重启后新调用重新建立队列，宿主端（host.js）另有全局锁保证串行排他，双保险。
let nativeQueue = Promise.resolve();

function enqueueNativeCall(id, action, payload) {
  const timeoutMs = ACTION_TIMEOUT_MS[action] || NATIVE_TIMEOUT_MS;
  const task = nativeQueue.then(() => runNativeCall(id, action, payload, timeoutMs));
  // 队列吞掉错误，避免后续任务因前一个失败而断链
  nativeQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

// 单次 native 往返：连接 -> postMessage 请求对象 -> 按 id 匹配响应（超时兜底）-> 断开
function runNativeCall(id, action, payload, timeoutMs) {
  return new Promise((resolve) => {
    let port = null;
    let timer = null;
    let settled = false;

    const finish = (resp) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      if (port !== null) {
        try { port.disconnect(); } catch (_) { /* 忽略 */ }
      }
      resolve(resp);
    };

    const isHostMissingError = (msg) =>
      typeof msg === 'string' && /not found|not installed/i.test(msg);

    try {
      port = chrome.runtime.connectNative(NATIVE_HOST);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      finish(isHostMissingError(msg) ? hostNotInstalled()
        : { ok: false, error: { code: 'NATIVE_ERROR', message: msg } });
      return;
    }

    // Chrome Native Messaging 自带 4 字节长度前缀 + JSON 帧（design §6.1），
    // onMessage 直接收到解析后的对象；禁止在此手动编解码帧。
    port.onMessage.addListener((obj) => {
      if (obj && typeof obj === 'object' && obj.id === id) finish(obj);
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      const err = chrome.runtime.lastError;
      const msg = err && err.message ? err.message : '';
      if (isHostMissingError(msg)) {
        finish(hostNotInstalled());
      } else {
        finish({
          ok: false,
          error: {
            code: 'NATIVE_ERROR',
            message: msg || '宿主连接意外断开',
          },
        });
      }
    });

    timer = setTimeout(() => {
      finish({
        ok: false,
        error: { code: 'NATIVE_ERROR', message: '等待宿主响应超时（' + Math.round(timeoutMs / 1000) + ' 秒）' },
      });
    }, timeoutMs);

    try {
      port.postMessage({ id, action, payload });
    } catch (e) {
      finish({
        ok: false,
        error: {
          code: 'NATIVE_ERROR',
          message: (e && e.message) ? e.message : String(e),
        },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// 消息路由（popup -> SW）
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;

  if (msg.type === 'native') {
    const id = (typeof msg.id === 'string' && msg.id) ||
      'sw-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const action = String(msg.action || '');
    const payload = (msg.payload && typeof msg.payload === 'object') ? msg.payload : {};
    enqueueNativeCall(id, action, payload).then((resp) => {
      try { sendResponse(resp); } catch (_) { /* 消息通道已关闭（popup 已关闭/页面刷新），忽略 */ }
    });
    return true; // 异步应答
  }

  if (msg.type === 'probe') {
    const port = Number(msg.port);
    probePort(Number.isFinite(port) ? port : DEFAULT_SETTINGS.port).then((resp) => {
      try { sendResponse(resp); } catch (_) { /* 消息通道已关闭，忽略 */ }
    });
    return true; // 异步应答
  }

  // M8 徽标提醒：content script 上报（页面后台时 工作完成/等待用户）
  if (msg.type === 'attention') {
    handleAttention(msg, sender); // 无需应答；失败静默（panel.js 侧不 await 结果）
    return false;
  }

  return false;
});

// ---------------------------------------------------------------------------
// 徽标（chrome.alarms 刷新 + M8 提醒分层）
// ---------------------------------------------------------------------------

// 服务态徽标。M7 修补（2026-08-22 修订）：Chrome 徽标 text 为空时**整体不渲染**
// （曾误以为「无文字+绿底 = 纯色块」，实机重载后徽标不可见）——改为 text:'●' +
// 绿底 + **文字颜色与底色同色**（隐形文字，视觉纯绿色状态块；此前未设文字色，
// Chrome 自动对比色造成「绿底黑/深色字」混乱）。
const STATE_BADGE_RUNNING = {
  text: '●',
  bg: '#22c55e',
  fg: '#22c55e',
  title: 'dsh web 运行中',
};
const STATE_BADGE_DOWN = {
  text: '',
  bg: '#22c55e',
  fg: '#22c55e',
  title: 'dsh web 未运行',
};

// 刷新服务态徽标（alarm 驱动/启动时；探测不惊动宿主，见 §8.3）
async function refreshBadge() {
  const s = await getSettings();
  cachedSettings = Object.assign({}, DEFAULT_SETTINGS, s);
  // M4：port 0（动态端口）无法本地探活——经 native status 判定（宿主解析日志/记录中的实际端口）
  const rawPort = Number(s.port);
  const port = Number.isFinite(rawPort) && rawPort >= 0 ? rawPort : DEFAULT_SETTINGS.port;
  let stateBadge = STATE_BADGE_DOWN;
  if (port === 0) {
    const resp = await enqueueNativeCall('bg-badge-' + Date.now().toString(36), 'status', {});
    const running = !!(resp && resp.ok && resp.result
      && (resp.result.state === 'running' || resp.result.state === 'external'));
    if (running) {
      const p = resp.result.port;
      stateBadge = { text: STATE_BADGE_RUNNING.text, bg: STATE_BADGE_RUNNING.bg, fg: STATE_BADGE_RUNNING.fg, title: STATE_BADGE_RUNNING.title + (p ? ' (端口 ' + p + ')' : '') };
    }
  } else {
    const { up } = await probePort(port);
    if (up) {
      stateBadge = { text: STATE_BADGE_RUNNING.text, bg: STATE_BADGE_RUNNING.bg, fg: STATE_BADGE_RUNNING.fg, title: STATE_BADGE_RUNNING.title + ' (端口 ' + port + ')' };
    }
  }
  lastStateBadge = stateBadge;
  applyBadge();
}

// 徽标最终渲染：提醒（waiting > done）优先于服务态；服务态快照缺失时补算
function applyBadge() {
  if (cachedSettings.attention !== false) {
    const e = pickAttention();
    if (e) {
      const b = ATTENTION_BADGES[e.kind] || ATTENTION_BADGES.done;
      chrome.action.setBadgeText({ text: b.text });
      chrome.action.setBadgeBackgroundColor({ color: b.bg });
      chrome.action.setBadgeTextColor({ color: b.fg });
      chrome.action.setTitle({ title: b.title });
      return;
    }
  }
  if (lastStateBadge) {
    chrome.action.setBadgeText({ text: lastStateBadge.text });
    chrome.action.setBadgeBackgroundColor({ color: lastStateBadge.bg });
    chrome.action.setBadgeTextColor({ color: lastStateBadge.fg });
    chrome.action.setTitle({ title: lastStateBadge.title });
  } else {
    refreshBadge(); // 服务态快照尚无（SW 刚醒/提醒先到）：补算一次
  }
}

// 按设置重建徽标告警（默认 badgeInterval=30 -> periodInMinutes=0.5；Chrome 最小周期 30s）
function ensureBadgeAlarm() {
  getSettings().then((s) => {
    const sec = Math.max(30, Number(s.badgeInterval) || DEFAULT_SETTINGS.badgeInterval);
    chrome.alarms.create('badge', { periodInMinutes: sec / 60 });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === 'badge') refreshBadge();
});

// 设置变更（popup 保存）后立即重建徽标周期；提醒/设置变动同步镜像缓存并重渲染徽标
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    const wasOn = cachedSettings.attention !== false;
    cachedSettings = Object.assign({}, DEFAULT_SETTINGS, changes.settings.newValue || {});
    // H1：关闭的瞬间清空已累积条目——重开时以当前页面实时状态为准，不冒陈旧提醒
    if (wasOn && cachedSettings.attention === false && Object.keys(attentionCache).length) {
      attentionCache = {};
      chrome.storage.local.set({ [ATTENTION_STORE_KEY]: {} });
    }
    ensureBadgeAlarm();
    applyBadge();
  }
  if (changes[ATTENTION_STORE_KEY]) {
    attentionCache = changes[ATTENTION_STORE_KEY].newValue || {};
    applyBadge();
  }
});

// ---------------------------------------------------------------------------
// 安装/启动初始化
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  // 初始化默认设置（不覆盖用户已有值）
  chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (data) => {
    const merged = Object.assign({}, DEFAULT_SETTINGS, (data && data.settings) || {});
    chrome.storage.local.set({ settings: merged });
  });
  // M8：扩展重载/更新后旧 content script 成为孤儿（无法再发 clear），清空旧提醒
  attentionCache = {};
  chrome.storage.local.set({ [ATTENTION_STORE_KEY]: {} });
  ensureBadgeAlarm();
  refreshBadge();
});

chrome.runtime.onStartup.addListener(() => {
  // M8：浏览器重启后的旧提醒无意义（标签恢复后 content script 会按新状态重新判定）
  attentionCache = {};
  chrome.storage.local.set({ [ATTENTION_STORE_KEY]: {} });
  ensureBadgeAlarm();
  refreshBadge();
});

// M8：dsh 标签页被关闭 → 其提醒条目随之删除；同标签导航离开 dsh（tab 未关闭，
// content script 已随页面卸载）→ 由 SW 按 URL 兜底清理（M2 反残留）
chrome.tabs.onRemoved.addListener((tabId) => {
  if (!attentionCache[tabId]) return;
  delete attentionCache[tabId];
  chrome.storage.local.set({ [ATTENTION_STORE_KEY]: attentionCache });
  applyBadge();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return; // 仅 URL 变化时判定（标题/图标等变化与归属无关）
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(changeInfo.url)) return; // 仍在 dsh 回环页
  if (!attentionCache[tabId]) return;
  delete attentionCache[tabId];
  chrome.storage.local.set({ [ATTENTION_STORE_KEY]: attentionCache });
  applyBadge();
});

// SW 被唤醒（如用户重新加载扩展）时立即刷新一次徽标
loadAttentionOnce(); // M8：先载入提醒镜像（回调内 applyBadge），再补服务态
refreshBadge();
