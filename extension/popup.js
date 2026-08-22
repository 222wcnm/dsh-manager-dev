'use strict';

// DSH Manager — popup 逻辑
//
// 行为（docs/design.md §8.2）：
//   1. 打开即调 status，随后每 2s 轮询（popup 关闭自动停止）；
//   2. 所有 native 请求经 SW 中转（chrome.runtime.sendMessage，MV3 返回 Promise）；
//   3. starting 就绪后按 settings.autoOpen 自动打开 Web UI；
//   4. 错误态展示错误码中文文案 + [复制日志]；
//   5. 内嵌设置面板，保存到 chrome.storage.local（key 'settings'）；
//   6. external 状态（§6.6/§6.7）：蓝点 + 接管按钮，可接管后由扩展管理；
//   7. 点击反馈：操作立即乐观更新（按钮禁用+转圈+进度条+阶段文案+耗时），
//      完成后 toast 确认（启动完成/已停止/重启完成/接管成功/失败原因）；
//      操作在途（native ack 前）暂停轮询，避免 SW 串行队列堆积。

const $ = (id) => document.getElementById(id);

// 错误码中文文案（与 docs/design.md §6.2 表一致）
const ERROR_TEXTS = {
  DSH_NOT_FOUND: '未检测到 dsh，请先执行 npm i -g @deepseek-ai/dsh',
  PORT_BUSY: '端口已被其他程序占用，请在设置中更换端口',
  ALREADY_RUNNING: 'dsh web 已在运行（幂等成功）',
  ALREADY_STOPPED: 'dsh web 已停止（幂等成功）',
  START_TIMEOUT: '启动超时：30 秒内端口未就绪，请查看日志',
  STOP_FAILED: '停止失败：无法终止 dsh 进程，请检查权限或手动处理',
  EXTERNAL_UNMANAGED: '未找到可接管的外部实例（可能已退出或变化）；请重新打开面板刷新，或在其原终端停止',
  BUSY: '操作进行中，请稍候再试',
  BAD_REQUEST: '请求参数错误（开发期诊断）',
  INTERNAL: '宿主内部错误，请查看日志',
  HOST_NOT_INSTALLED: '未安装宿主，请运行 native-host 目录下的 install.ps1 后重启浏览器',
  NATIVE_ERROR: '与宿主通信失败，请确认已安装宿主并重启浏览器',
};

const DEFAULT_SETTINGS = { port: 3080, profile: 'web', autoOpen: true, badgeInterval: 30, theme: 'follow-webui', attention: true, attentionDone: true };

// 操作进行中的按钮文案与阶段说明（点击反馈）
const ACTION_LABELS = {
  start: { idle: '启动', busy: '启动中…', progress: { starting: '正在启动：等待端口就绪' } },
  stop: { idle: '停止', busy: '停止中…', progress: { stopping: '正在停止：等待端口关闭' } },
  restart: {
    idle: '重启', busy: '重启中…',
    progress: { stopping: '正在重启：停止旧进程', starting: '正在重启：新进程启动中，等待端口就绪' },
  },
  adopt: { idle: '接管', busy: '接管中…', progress: { starting: '正在接管外部实例' } },
};

let settings = null;
let state = 'unknown'; // stopped | starting | running | stopping | error | external | unknown
let detail = null; // 最近一次 status 的 result
let lastError = null; // { code, message, logTail? }
// pending —— 用户发起、尚未收敛到终态的操作（乐观反馈：按钮转圈 + 进度条 + 阶段文案）
// { action, phase: 'stopping' | 'starting', atMs, ack }；ack=true 表示 native 请求在途
let pending = null;
let startedAtMs = null; // running 起点（用于 mm:ss 时长）
let reqSeq = 0;
let pollTimer = null;
let tickTimer = null;
let toastTimer = null;
let refreshing = false; // 手动刷新在途：btn-refresh 转圈 + 禁用，防止重入
let lastDriftKey = null; // 上次状态漂移提示的键（相同漂移去重）

// M9 会话区（design §8.10）：只读摘要元数据（{available, items}），不读消息内容。
// sessionsData===null 表示尚未拿到数据或请求失败（会话区隐藏）。
let sessionsData = null;

// 会话状态展示层（§8.10 色表，扩展 §8.9.1 紫语义）：
// 琥珀=进行中 / 紫=等你拍板 / 绿=已完成 / 灰=空闲；文字状态词恒有（防颜色混淆硬规则）
const SESSION_STATE_META = {
  working: { cls: 'sdot-working', label: '进行中' },
  waiting: { cls: 'sdot-waiting', label: '等你拍板' },
  completed: { cls: 'sdot-completed', label: '已完成' },
  idle: { cls: 'sdot-idle', label: '空闲' },
};

// 呼吸同步（2026-08-23 用户反馈：呼吸效果整个 popup 同步）：
// 以 popup 打开时刻为全局时钟零点，每个呼吸点（状态卡 running/external + 会话四态）
// 渲染时设置负 animation-delay（--dot-align-delay：out 至伪元素）折算回同一相位——
// CSS 动画从元素插入时刻起算，后渲染的点会晚走一段（不同步），负 delay 则等效于
// 「从 popup 打开（零点）就开始播放」。周期须与 popup.css 的 dsh-dot-breathe /
// dsh-halo-breathe 2.2s 一致。busy 脉冲（1.2s 秒级过渡态）不参与对齐。
const BREATHE_MS = 2200;
const BREATHE_T0 = performance.now();
function alignBreathe(el) {
  const elapsed = (performance.now() - BREATHE_T0) % BREATHE_MS;
  el.style.setProperty('--dot-align-delay', '-' + Math.round(elapsed) + 'ms');
}

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------

async function init() {
  DSHTheme.init(); // M6：尽早应用主题（避免浅色闪烁），并订阅 storage/webuiTheme + matchMedia
  bindEvents();
  await loadSettings();
  renderSettingsForm();
  await refreshStatus();
  refreshSessions(); // M9：会话摘要（只读，失败静默降级）
  pollTimer = setInterval(refreshStatus, 2000);
  tickTimer = setInterval(() => {
    renderUptime();
    renderProgress(); // 每秒刷新操作耗时
  }, 1000);
}

function bindEvents() {
  $('btn-settings').addEventListener('click', () => toggleSettings());
  $('btn-refresh').addEventListener('click', manualRefresh);
  $('btn-save').addEventListener('click', saveSettings);
  $('btn-cancel').addEventListener('click', () => toggleSettings(false));
  $('btn-start').addEventListener('click', () => doAction('start'));
  $('btn-stop').addEventListener('click', () => doAction('stop'));
  $('btn-restart').addEventListener('click', () => doAction('restart'));
  $('btn-adopt').addEventListener('click', () => doAction('adopt'));
  $('btn-open').addEventListener('click', openWebUI);
  $('btn-copy-log').addEventListener('click', copyLog);
  $('btn-logs').addEventListener('click', openLogs);
  // 输入时清除无效反馈
  $('set-port').addEventListener('input', () => clearFieldInvalid('set-port'));
  $('set-badge').addEventListener('input', () => clearFieldInvalid('set-badge'));
  // 外观行（M6）：点选即生效（写入 settings.theme + 即时应用，不弹 toast、不触发 saveSettings）
  document.querySelectorAll('.theme-cube').forEach((btn) => {
    btn.addEventListener('click', () => onThemeSelect(btn.getAttribute('data-theme')));
  });
  // radiogroup 键盘导航（roving tabindex + 方向键/Home/End）
  $('theme-grid').addEventListener('keydown', onThemeGridKeydown);
  // M9 会话区：折叠头（可折叠、默认展开）。会话行为**纯展示**（2026-08-23 修复误导：
  // Web UI 无 URL 会话深链，行点击只能打开实例首页且恢复"上次选中会话"——点某行却进
  // 另一会话，构成误导；导航交互收回给明确语义的「打开 Web UI」按钮；深链见 §8.10 规划）。
  $('sessions-toggle').addEventListener('click', () => {
    const section = $('sessions-section');
    const collapsed = section.classList.toggle('collapsed');
    const btn = $('sessions-toggle');
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });
  window.addEventListener('unload', () => {
    if (pollTimer) clearInterval(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
  });
}

// ---------------------------------------------------------------------------
// 与 SW 通信
// ---------------------------------------------------------------------------

async function nativeRequest(action, payload) {
  const id = 'p' + (++reqSeq) + '-' + Date.now().toString(36);
  const resp = await chrome.runtime.sendMessage({
    type: 'native',
    id,
    action,
    payload: payload || {},
  });
  return resp || { ok: false, error: { code: 'NATIVE_ERROR', message: '宿主无响应' } };
}

// ---------------------------------------------------------------------------
// 状态轮询
// ---------------------------------------------------------------------------

async function refreshStatus() {
  // 操作请求在途时跳过轮询：SW 串行队列会让 status 排在操作之后，白白堆积
  if (pending && pending.ack) return;
  const reqAt = Date.now(); // 快照发出时刻（用于识别"早于操作"的旧快照）
  let resp;
  try {
    resp = await nativeRequest('status', {});
  } catch (_) {
    setError({ code: 'NATIVE_ERROR', message: '无法连接扩展后台，请重新打开面板' });
    return;
  }
  if (!resp.ok) {
    setError(resp.error || { code: 'NATIVE_ERROR', message: '未知错误' });
    return;
  }
  // 快照早于操作发起（请求在途时用户点了操作）：丢弃，等应答后轮询收敛
  if (pending && pending.atMs > reqAt) return;
  clearError();
  applyStatus(resp.result || {});
  if (state === 'running' || state === 'external') refreshSessions(); // M9：随状态轮询刷新会话摘要
}

// 手动刷新：直接拉取一次 status 并应用结果（与 refreshStatus 一致）。
// 有 pending（操作在途/乐观反馈中）时静默忽略，避免破坏乐观反馈。
async function manualRefresh() {
  if (refreshing) return; // 防重入
  if (pending) return; // 操作在途：保持按钮禁用、乐观反馈不被破坏
  refreshing = true;
  const btn = $('btn-refresh');
  btn.classList.add('is-pending');
  btn.disabled = true;
  try {
    const reqAt = Date.now(); // 快照发出时刻（用于识别"早于操作"的旧快照）
    let resp;
    try {
      resp = await nativeRequest('status', {});
    } catch (_) {
      setError({ code: 'NATIVE_ERROR', message: '无法连接扩展后台，请重新打开面板' });
      return;
    }
    if (!resp.ok) {
      setError(resp.error || { code: 'NATIVE_ERROR', message: '未知错误' });
      return;
    }
    if (pending && pending.atMs > reqAt) return; // 快照早于操作发起：丢弃
    clearError();
    applyStatus(resp.result || {});
  } finally {
    refreshing = false;
    btn.classList.remove('is-pending');
    btn.disabled = false;
  }
}

function applyStatus(result) {
  const prev = state;
  state = result.state || 'unknown';
  detail = result;

  // 状态漂移通知（无用户操作时；首次 init 的 prev='unknown' 不触发）
  if (!pending && prev !== 'unknown') {
    notifyDrift(prev, state);
  }

  // ack=true 表示操作请求仍在途：status 快照可能早于操作，不得判定终态
  // （否则 restart 应答前的 stopped 旧快照会误清 pending，见 doAction 312 防御）
  const settled = !pending || !pending.ack;

  if (state === 'running') {
    startedAtMs = result.startedAt || Date.now();
    if (!settled) return render();
    // 我们发起的启动/重启收敛到 running → 完成确认（toast + autoOpen）
    const wasOurStart = !!pending && (pending.action === 'start' || pending.action === 'restart');
    if (wasOurStart) {
      finishPending(pending.action === 'restart'
        ? '重启完成，dsh web 已就绪'
        : '启动完成，dsh web 已就绪', 'success');
    }
    if (wasOurStart && prev !== 'running' && settings && settings.autoOpen) {
      openWebUI();
    }
  } else if (state === 'stopped' || state === 'error' || state === 'external') {
    startedAtMs = null;
    if (settled && pending) {
      if (state === 'stopped' && pending.action === 'stop') {
        finishPending(stopStoppedText(), 'success');
      } else if (state === 'error') {
        finishPending('操作未完成，请查看下方错误信息', 'error');
      } else if (state === 'stopped' && (pending.action === 'start' || pending.action === 'restart')) {
        // start/restart 的合法中间快照：M5.5 时序下新进程端口就绪前无 run 记录、
        // status 报 stopped（或 stop 间隙）——保留 pending，等待下一轮 starting/running
      } else {
        finishPending(null, null); // 罕见：目标态变化（如 external 漂移），静默结束 pending
      }
    }
  }
  render();
}

// 状态漂移提示（仅无 pending；去重：相同的 prev→state 键不重复弹）
function notifyDrift(prev, next) {
  if (prev === next) return;
  let msg = null;
  if (prev === 'stopped' && next === 'external') {
    msg = '检测到外部 dsh web 实例';
  } else if (prev === 'external' && next === 'stopped') {
    msg = '外部实例已退出';
  } else if (prev === 'running' && next === 'stopped') {
    msg = 'dsh web 已停止（非本扩展操作）';
  } else if (prev === 'error' && next !== 'error') {
    msg = '已恢复';
  }
  if (!msg) return;
  const key = prev + '->' + next;
  if (key === lastDriftKey) return;
  lastDriftKey = key;
  showToast(msg, 'info');
}

// stop 完成 toast 文案：按 stopMethod 区分（graceful/force/缺失）
function stopStoppedText() {
  const m = detail && detail.stopMethod;
  if (m === 'graceful') return '已优雅停止';
  if (m === 'force') return '已强制停止（未检测到插件或优雅停止超时）';
  return '已停止';
}

// 结束 pending 并（可选）弹出完成 toast
function finishPending(msg, kind) {
  pending = null;
  if (msg) showToast(msg, kind);
}

// 失败静默：会话区隐藏而非报错（§8.10：不阻断其余功能，除降级提示外不打扰）
async function refreshSessions() {
  let resp;
  try {
    resp = await nativeRequest('sessions', {});
  } catch (_) {
    sessionsData = null;
    applySessions();
    return;
  }
  if (!resp.ok || !resp.result || typeof resp.result !== 'object') {
    sessionsData = null;
    applySessions();
    return;
  }
  sessionsData = {
    available: resp.result.available === true,
    items: Array.isArray(resp.result.items) ? resp.result.items : [],
  };
  applySessions();
}

// 会话区渲染：折叠头计数 + 列表 / 空态 / 降级提示（§8.10）
function applySessions() {
  const section = $('sessions-section');
  if (!section) return;
  const list = $('sessions-list');
  const empty = $('sessions-empty');
  const hint = $('sessions-hint');
  const count = $('sessions-count');

  // 未加载 / 失败 / dsh 未运行 -> 整个会话区隐藏（不报错）；
  // 顺手清空计数与列表残留，避免恢复显示前闪现陈旧行
  if (!sessionsData) {
    section.classList.add('hidden');
    if (count) count.textContent = '';
    return;
  }
  const dshOff = state === 'stopped' || state === 'error' || state === 'unknown';
  if (!sessionsData.available) {
    // 插件未装/未升级：dsh 在运行时给中性提示，未运行时隐藏
    if (dshOff) {
      section.classList.add('hidden');
    } else {
      section.classList.remove('hidden');
      list.classList.add('hidden');
      empty.classList.add('hidden');
      hint.classList.remove('hidden');
      hint.textContent = '安装/升级 dsh 配套插件后可查看会话';
      count.textContent = '';
    }
    return;
  }

  const items = sessionsData.items;
  section.classList.remove('hidden');
  hint.classList.add('hidden');
  count.textContent = items.length > 0 ? String(items.length) : '';

  if (items.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    empty.textContent = '暂无会话';
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');
  list.textContent = '';
  for (const item of items) {
    const meta = SESSION_STATE_META[item.state] || SESSION_STATE_META.idle;
    const title = (typeof item.title === 'string' && item.title)
      ? item.title
      : '会话 #' + String(item.sessionId || '').slice(0, 8);
    const row = document.createElement('div');
    row.className = 'session-row';
    // 纯展示：无 role/tabindex/点击语义（见 bindEvents 注记；深链规划于 §8.10）
    const dot = document.createElement('span');
    dot.className = 'session-dot ' + meta.cls;
    dot.setAttribute('aria-hidden', 'true');
    alignBreathe(dot); // 全 popup 呼吸点同步（折算回 popup 打开时刻）
    const titleEl = document.createElement('span');
    titleEl.className = 'session-title';
    titleEl.textContent = title;
    const stateEl = document.createElement('span');
    stateEl.className = 'session-state';
    stateEl.textContent = meta.label; // 文字状态词恒有（防颜色混淆硬规则）
    row.appendChild(dot);
    row.appendChild(titleEl);
    row.appendChild(stateEl);
    list.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// 操作（启动 / 停止 / 重启 / 接管）
// ---------------------------------------------------------------------------

async function doAction(action) {
  if (pending) return; // 操作进行中（按钮已禁用，双保险）

  // 乐观反馈：立即进入过渡态 —— 按钮禁用+转圈、圆点脉冲、进度条与阶段文案
  pending = {
    action,
    phase: (action === 'stop' || action === 'restart') ? 'stopping' : 'starting',
    atMs: Date.now(),
    ack: true,
  };
  if (action === 'start') state = 'starting';
  else if (action === 'stop' || action === 'restart') state = 'stopping';
  // adopt：保持 external 状态，仅按钮与进度条反馈
  render();

  // adopt 的 payload 来自最近一次 status 的 external 结果（pid+port，design §6.7）
  const payload = action === 'adopt'
    ? { pid: detail ? detail.pid : null, port: detail ? detail.port : null }
    : {
        profile: settings ? settings.profile : DEFAULT_SETTINGS.profile,
        port: settings ? settings.port : DEFAULT_SETTINGS.port,
      };

  let resp;
  try {
    resp = await nativeRequest(action, payload);
  } catch (_) {
    pending = null;
    setError({ code: 'NATIVE_ERROR', message: '无法连接扩展后台，请重新打开面板' });
    showToast('操作失败：无法连接扩展后台', 'error');
    render();
    return;
  }

  if (!resp.ok) {
    const err = resp.error || {};
    if (err.code === 'ALREADY_RUNNING') {
      // 幂等成功：刷新状态；若配置自动打开则打开 UI
      pending = null;
      showToast('dsh web 已在运行（无需操作）', 'success');
      await refreshStatus();
      if (settings && settings.autoOpen && state === 'running') openWebUI();
      return;
    }
    if (err.code === 'ALREADY_STOPPED') {
      pending = null;
      showToast('dsh web 已停止（无需操作）', 'success');
      await refreshStatus();
      return;
    }
    pending = null;
    setError(err);
    showToast('操作失败：' + (ERROR_TEXTS[err.code] || err.message || err.code), 'error');
    return;
  }

  // 应答成功：立即应用返回状态，后续由 2s 轮询继续收敛到终态
  if (action === 'adopt') {
    pending = null; // adopt 应答即终态
    showToast('接管成功，实例已由扩展管理', 'success');
    applyStatus(resp.result || {});
    refreshStatus();
    return;
  }

  // 防御：在途 status 快照的竞态可导致 pending 已被提前收敛（applyStatus 已加守卫，
  // refreshStatus/manualRefresh 已丢弃旧快照，此为兜底）——null 时整体跳过尾处理，
  // 状态由 2s 轮询自愈；绝不在 null 上写字段（Cannot set properties of null）
  if (!pending) return;
  const result = resp.result || {};
  if (action === 'restart' && result.state === 'starting') {
    // 宿主内先 stop 后 start：ack 时旧进程已停、新进程已 spawn
    pending.phase = 'starting';
    showToast('旧进程已停止，新进程启动中…', 'info');
  }
  pending.ack = false;
  applyStatus(result); // 若已 running → finishPending 弹完成 toast
  refreshStatus(); // 立即收敛一次（SW 队列此时空闲）
}

// ---------------------------------------------------------------------------
// 打开 Web UI
// ---------------------------------------------------------------------------

function openWebUI() {
  const port = (detail && detail.port) || (settings ? settings.port : DEFAULT_SETTINGS.port);
  if (!port) return; // M4：动态端口未回填时无 URL 可开
  chrome.tabs.create({ url: 'http://127.0.0.1:' + port + '/' });
}

// 打开日志查看页（扩展页面，M3 日志查看，design §8.4）
function openLogs() {
  chrome.tabs.create({ url: chrome.runtime.getURL('logs.html') });
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

function render() {
  const running = state === 'running';
  const external = state === 'external';
  const stopped = state === 'stopped';
  const isError = state === 'error';
  const locked = !!pending; // 操作在途：所有生命周期按钮锁定，防止并发

  // 状态圆点（dotStateClass 集中映射语义 class：running/z/error/stopped + busy 走 Matrix）
  // className 变更才重设 + alignBreathe：每 2s 轮询 render 不改 delay（className 相同
  // 时 animation 不重启；改 delay 反而会触发动画重算导致跳变）
  const dotEl = $('dot');
  const dotCls = 'dot ' + dotStateClass();
  if (dotEl.className !== dotCls) {
    dotEl.className = dotCls;
    if (/dot-(running|external)/.test(dotCls)) alignBreathe(dotEl); // 呼吸全 popup 同步
  }

  // 按钮随状态启用/禁用：external 可接管 + 打开 Web UI（design §6.6/§6.7）
  // error 态保留「启动」重试入口（修复端口/安装 dsh 后可直接重试，design §8.2.12）
  $('btn-start').disabled = locked || !(stopped || isError);
  $('btn-stop').disabled = locked || !running;
  $('btn-restart').disabled = locked || !running;
  $('btn-adopt').disabled = locked || !external;
  $('btn-open').disabled = !running && !external;

  // 接管按钮仅 external 状态显示（独占一行；打开 Web UI 恒为全宽 ghost）
  $('btn-adopt').classList.toggle('hidden', !external);

  // 进行中文案 + 转圈：pending 命中的按钮显示 spinner（点击即时反馈）
  setBtnLabel('btn-start', 'start');
  setBtnLabel('btn-stop', 'stop');
  setBtnLabel('btn-restart', 'restart');
  setBtnLabel('btn-adopt', 'adopt');

  // 操作进度行
  renderProgress();

  // 状态卡（新三区布局）：状态词 / 端口 / 次级信息行
  renderStatusCard();
  renderLegacyStatus(); // 兼容：继续写入隐藏的 url-text/uptime-text/detail-line（保留 id 契约）

  // M9 会话区：状态变化时按现有 sessionsData 收敛显示（隐藏/提示切换）
  applySessions();

  // 底部提示：M2 契约 —— lifecycle:true 显示优雅停机已启用
  renderHint();
}

// 状态词（#state-word）文本映射（M7 状态卡）
function stateWordText() {
  switch (state) {
    case 'running': return '运行中';
    case 'external': return '外部实例';
    case 'starting': return '正在启动…';
    case 'stopping': return '正在停止…';
    case 'error': return '状态获取失败';
    case 'stopped': return '已停止';
    default: return '—';
  }
}

// dot className 语义映射（M7 从 render() 三元链抽取）：
//   running→dot-running / external→dot-external / busy(starting|stopping)→dot-busy
//   error→dot-error / 其余→dot-stopped
function dotStateClass() {
  if (state === 'running') return 'dot-running';
  if (state === 'external') return 'dot-external';
  if (state === 'starting' || state === 'stopping') return 'dot-busy';
  if (state === 'error') return 'dot-error';
  return 'dot-stopped';
}

// 解析当前端口（外部/运行用 detail.port，否则 settings.port；dynam port 未回填时回落 settings）
function resolvePort() {
  return (detail && detail.port) || (settings ? settings.port : DEFAULT_SETTINGS.port);
}

// uptimeMs → 紧凑「{m}m{s}s」（<60s 只显示「{s}s」；非法值兜底 0s）
function formatCompactUptime(ms) {
  const sec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return s + 's';
  return m + 'm' + s + 's';
}

// 状态卡次级信息（#row2-text）文案（M7）
function row2Text() {
  if (state === 'running') {
    const health = detail && detail.health;
    const parts = [];
    if (health) {
      parts.push('健康');
      if (health.uptimeMs) parts.push('已运行 ' + formatCompactUptime(health.uptimeMs));
    }
    if (detail && detail.pid) parts.push('PID ' + detail.pid);
    if (health && health.nodeVersion) parts.push('node ' + health.nodeVersion);
    return parts.join(' · ');
  }
  if (state === 'external') {
    let t = '外部启动，接管后由扩展管理' + (detail && detail.pid ? ' · PID ' + detail.pid : '');
    if (detail && detail.externalCount > 1) t += ' · 共 ' + detail.externalCount + ' 个外部实例';
    return t;
  }
  if (state === 'starting') {
    let t = '正在启动：等待端口就绪';
    if (detail && detail.requestedPort === 0) t += '，端口自动分配中';
    return t;
  }
  if (state === 'stopping') return '正在停止：等待端口关闭';
  if (state === 'error') {
    const code = lastError && lastError.code;
    const msg = (ERROR_TEXTS[code] || (lastError && lastError.message) || code || '').split('\n')[0];
    return msg || '状态获取失败';
  }
  if (state === 'stopped') return 'dsh web 未在运行';
  return '正在获取状态…';
}

// 状态卡渲染（M7）：卡片 class + 状态词 + 端口 + 次级信息行
function renderStatusCard() {
  const card = $('statuscard');
  if (!card) return;
  const busy = state === 'starting' || state === 'stopping';
  const isError = state === 'error';
  card.className = 'statuscard' + (isError ? ' error' : busy ? ' warn' : '');

  const sw = $('state-word');
  if (sw) sw.textContent = stateWordText();

  const portEl = $('port-text');
  if (!portEl) return;
  if (state === 'running' || state === 'external') {
    const port = resolvePort();
    portEl.textContent = port ? '端口 ' + port : '';
  } else {
    portEl.textContent = '';
  }

  const row2 = $('row2-text');
  if (row2) row2.textContent = row2Text();
}

// 兼容：继续写入隐藏容器的 url-text/uptime-text/detail-line（保留 id 契约，展示以新状态卡为准）
function renderLegacyStatus() {
  const urlText = $('url-text');
  if (urlText) {
    urlText.textContent = (state === 'running' || state === 'external')
      ? 'http://127.0.0.1:' + resolvePort()
      : '';
  }
  renderUptime();
  const detailLine = $('detail-line');
  if (detailLine) detailLine.textContent = '状态：' + state;
}

// 底部提示：lifecycle:true → 优雅停机已启用；否则提示安装插件（宿主未升级字段缺失按 false 兜底）。
// 状态未知（首查未返回/失败前 detail 为空）保持中性文案，避免「安装插件」误导（M7 修补）。
function renderHint() {
  const hint = $('hint');
  if (!hint) return;
  if (!detail) {
    hint.textContent = '正在获取 dsh 状态…';
    return;
  }
  const lifecycle = !!detail.lifecycle;
  hint.textContent = lifecycle
    ? '优雅停机已启用（dsh-lifecycle）'
    : '安装 dsh-lifecycle 插件可优雅停机';
}

// 单个按钮：忙碌（本窗口 pending 命中，或无 pending 时轮询观察到的 starting/stopping）
// → spinner + 「…中」文案，视觉与状态对齐；否则按状态显示 idle 文案
function setBtnLabel(id, action) {
  const btn = $(id);
  const label = btn.querySelector('.btn-label');
  const mine = pending && pending.action === action;
  // 无 pending 的忙碌态（他处发起 / 宿主回填前 starting）：按钮也转圈，与圆点脉冲一致
  const stateBusy = !pending && (
    (state === 'starting' && action === 'start') ||
    (state === 'stopping' && (action === 'stop' || action === 'restart'))
  );
  if (mine || stateBusy) {
    label.textContent = ACTION_LABELS[action].busy;
    btn.classList.add('is-pending');
  } else {
    btn.classList.remove('is-pending');
    label.textContent = ACTION_LABELS[action].idle;
  }
}

// 操作进度行：阶段说明 + 已耗时（tickTimer 每秒刷新一次）
function renderProgress() {
  const prog = $('progress');
  if (!prog) return;
  if (!pending) {
    prog.classList.add('hidden');
    return;
  }
  prog.classList.remove('hidden');
  let text = ACTION_LABELS[pending.action].progress[pending.phase] || ACTION_LABELS[pending.action].busy;
  if (pending.action === 'adopt' && detail && detail.pid) {
    text += '（PID ' + detail.pid + '）';
  }
  const sec = Math.floor((Date.now() - pending.atMs) / 1000);
  $('progress-text').textContent = text + ' · 已耗时 ' + sec + 's';
}

function renderUptime() {
  const el = $('uptime-text');
  if (state !== 'running' || !startedAtMs) {
    el.textContent = '';
    return;
  }
  const sec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  el.textContent = '已运行 ' + mm + ':' + ss;
}

// ---------------------------------------------------------------------------
// 操作结果 toast（点击反馈：完成/失败即时确认，自动消退）
// ---------------------------------------------------------------------------

function showToast(msg, kind) {
  const t = $('toast');
  if (!t) return;
  $('toast-text').textContent = msg;
  t.classList.remove('toast-hidden', 'toast-out', 'toast-success', 'toast-error', 'toast-info');
  t.classList.add('toast-' + (kind || 'info'));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 4000);
}

function hideToast() {
  const t = $('toast');
  if (!t || t.classList.contains('toast-hidden')) return;
  t.classList.add('toast-out');
  toastTimer = setTimeout(() => t.classList.add('toast-hidden'), 200);
}

// ---------------------------------------------------------------------------
// 错误面板
// ---------------------------------------------------------------------------

function setError(err) {
  lastError = err || {};
  state = 'error'; // 与 Web UI 一致：错误态显示红色圆点，下次 status 轮询自动恢复
  const code = lastError.code || 'NATIVE_ERROR';
  const friendly = ERROR_TEXTS[code] || lastError.message || code;
  let text = friendly;
  if (lastError.message && lastError.message !== friendly) {
    text += '\n' + lastError.message;
  }
  $('error-text').textContent = text;
  $('error-panel').classList.remove('hidden');
  $('btn-copy-log').classList.toggle('hidden', !(lastError.logTail || lastError.message));
  render();
}

function clearError() {
  lastError = null;
  $('error-panel').classList.add('hidden');
  $('btn-copy-log').classList.add('hidden');
}

async function copyLog() {
  if (!lastError) return;
  const text = lastError.logTail || lastError.message || '';
  try {
    await navigator.clipboard.writeText(text);
    showToast('日志已复制', 'success');
  } catch (_) {
    // 兜底：execCommand；两条路径都失败才报错 toast
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    if (ok) showToast('日志已复制', 'success');
    else showToast('复制失败，请手动选择复制', 'error');
  }
}

// ---------------------------------------------------------------------------
// 设置面板
// ---------------------------------------------------------------------------

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (data) => {
      settings = Object.assign({}, DEFAULT_SETTINGS, (data && data.settings) || {});
      resolve();
    });
  });
}

function renderSettingsForm() {
  $('set-port').value = settings.port;
  $('set-profile').value = settings.profile;
  $('set-autoopen').checked = !!settings.autoOpen;
  $('set-badge').value = settings.badgeInterval;
  $('set-attention').checked = settings.attention !== false; // 缺省视为开（向后兼容）
  $('set-attention-done').checked = settings.attentionDone !== false; // M8.1：完成提醒独立开关（缺省开）
  renderThemeGrid();
}

// 外观行（M6）：点选即生效。白名单校验 → 更新内存 settings → 写 storage（保留其它字段）
// → 调用 DSHTheme.apply() 即时应用（与 webui AppearanceRow 点选即生效一致；不触发
// saveSettings、不弹 toast）。非法值回退默认（normalizeTheme 已处理）。
function onThemeSelect(value) {
  const theme = DSHTheme.normalizeTheme(value);
  if (settings) settings.theme = theme;
  // 写回 storage：settings 是 loadSettings 后的完整对象，直接 set 即保留其余字段
  chrome.storage.local.set({ settings: settings || Object.assign({}, DEFAULT_SETTINGS, { theme }) }, () => {
    renderThemeGrid();
    DSHTheme.apply(); // 立即生效（storage.onChanged 亦会触发，幂等）
  });
}

// 外观行（M6，design §8.7.5）：按 settings.theme 给选中的 theme-cube 加 .selected + aria-checked
// radiogroup 键盘语义：选中项 tabindex=0（roving），其余 -1；keydown 方向键/Home/End 换选
function renderThemeGrid() {
  const theme = DSHTheme.normalizeTheme(settings.theme);
  const cubes = document.querySelectorAll('.theme-cube');
  cubes.forEach((btn) => {
    const sel = btn.getAttribute('data-theme') === theme;
    btn.classList.toggle('selected', sel);
    btn.setAttribute('aria-checked', sel ? 'true' : 'false');
    btn.setAttribute('tabindex', sel ? '0' : '-1'); // roving tabindex
  });
}

const THEME_ORDER = ['follow-webui', 'follow-system', 'light', 'dark'];

// radiogroup 方向键导航：ArrowRight/Down 下一个、ArrowLeft/Up 上一个、Home/End 首/末
function onThemeGridKeydown(e) {
  const idx = THEME_ORDER.indexOf(e.target.getAttribute('data-theme'));
  if (idx < 0) return; // 焦点不在 cube 上
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % THEME_ORDER.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + THEME_ORDER.length) % THEME_ORDER.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = THEME_ORDER.length - 1;
  else return;
  e.preventDefault();
  const target = document.querySelector('.theme-cube[data-theme="' + THEME_ORDER[next] + '"]');
  if (target) { target.focus(); target.click(); } // 换选并即时生效（click 走 onThemeSelect）
}

function toggleSettings(force) {
  const panel = $('settings-panel');
  const show = (force !== undefined) ? force : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !show);
  if (show) {
    renderSettingsForm();
    $('settings-error').classList.add('hidden');
  }
}

function saveSettings() {
  const port = parseInt($('set-port').value, 10);
  const badge = parseInt($('set-badge').value, 10);
  const profile = $('set-profile').value.trim();
  const errEl = $('settings-error');

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    errEl.textContent = '端口必须是 0-65535 的整数（0 = 自动分配动态端口）';
    errEl.classList.remove('hidden');
    markFieldInvalid('set-port');
    return;
  }
  if (!Number.isInteger(badge) || badge < 30 || badge > 3600) {
    errEl.textContent = '徽标刷新间隔必须是 30-3600 秒的整数（Chrome 最小周期 30 秒）';
    errEl.classList.remove('hidden');
    markFieldInvalid('set-badge');
    return;
  }

  const next = {
    port,
    profile: profile || 'web',
    autoOpen: $('set-autoopen').checked,
    badgeInterval: badge,
    theme: settings ? settings.theme : DEFAULT_SETTINGS.theme, // 保留主题选择（M6）
    attention: $('set-attention').checked, // M8 徽标提醒开关（design §8.9）
    attentionDone: $('set-attention-done').checked, // M8.1 完成提醒「琥珀!」独立开关
  };

  chrome.storage.local.set({ settings: next }, () => {
    settings = next; // 立即重读生效
    errEl.classList.add('hidden');
    toggleSettings(false);
    showToast('设置已保存', 'success');
    refreshStatus();
  });
}

// 校验失败：红边框 + 抖动一次（0.3s）+ 聚焦到出错输入框
function markFieldInvalid(id) {
  const input = $(id);
  clearFieldInvalid(id, true);
  input.classList.add('field-invalid');
  input.classList.remove('field-shake');
  // 强制重排以重启动画（连续两次同一错误也会抖动）
  void input.offsetWidth;
  input.classList.add('field-shake');
  input.focus();
}

// 输入时清除无效反馈；skipShake 用于抖动重排前不动 shake 类
function clearFieldInvalid(id, skipShake) {
  const input = $(id);
  input.classList.remove('field-invalid');
  if (!skipShake) input.classList.remove('field-shake');
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
