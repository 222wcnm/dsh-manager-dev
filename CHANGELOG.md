# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布] - M4 跨平台/跨浏览器（进行中）

### Changed
- **M8.1 徽标语义重构（2026-08-22 用户决策，design §8.9/§8.9.1）**：原「实例运行状态」与
  「会话提醒」挤在同一徽标字符且互斥覆盖（显示「?」看不到实例状态；实例停止后紫?/琥珀!
  仍挂 4h TTL）。重构为**双载体分层**：① 实例状态层 → **图标角标**（setIcon 预生成变体：
  绿点=运行中 #22c55e / 红点=错误·未装宿主 #ec1313 / 无点=停止，tool _gen-icons.js 三态
  16/48/128）；② 徽标 → **会话状态层**（字符为主语义）：紫「?」=等你拍板、琥珀「!」=
  工作完成（事件）、**蓝 n**=n 个会话工作中（#5686fe，与 webui `--dsh-state-ongoing`
  同源——用户实测当前 webui 工作中为蓝色「Deep diving…」状态标签，非点阵）。
  优先级 waiting > done > working，n≥10 显示「9+」；多 tab 全局聚合（working 求和）。
  ③ **死提醒联动**：面板上报带 `port`（tab.url 解析），refreshBadge 判定实例未运行/异常
  即清对应端口会话信号。④ 检测协议升级（panel.js）：扫描改**计数**（querySelectorAll
  .length）+ 隐藏页内计数签名变化即上报（蓝 n 常驻数据源），仍只读语义属性、不读内容；
  ⑤ `settings.attentionDone` 独立开关（popup「界面」新增「徽标：工作完成提醒（琥珀!）」），
  done 可单独关，waiting/working 不受影响；总开关 attention 关闭则整个会话层停显
  （徽标空、角标照常）。自定义语义（预设档位/字符映射）列为后续可选项（用户暂缓）。
  verify-cdp 徽标段更新（角标断言 icon/title、done>working 优先级、蓝 n/9+、清空恢复），
  **M8.1 盲审修补（子代理独立审查后修复）**：① `attentionDone` 关闭瞬间未剔除既有 done
  条目 → 重开开关冒陈旧「工作完成」（H1 同类缺陷），补对称清理（剔除 done，idle/working/
  waiting 不受影响）；② 顺带修复 onChanged 时序竞态——单次 set 同时改 settings+attentionMap
  时，settings 清理分支先于 attentionMap 分支执行、快照中的条目尚未进内存导致清理扑空
  （原始 H1 的总开关清空亦受此竞态影响）；清理改为以本次变化的权威值为基 + purged 防
  newValue 旧快照恢复；③ 新增 1 条防回归断言，全量 **PASS 75 / FAIL 0**。
- **外观行改 icon-only（2026-08-22 用户决策）**：popup 设置「外观」四个 theme-cube 由
  「图标 + 文字」2×2 网格改为一行 4 列、仅图标（16×16）+ hover 原生 `title` 提示
  （文字移入 `title`/`aria-label`，读屏语义保留）；按钮 `height: 32px; padding: 0`，
  选中态/点选即生效/roving tabindex 键盘导航不变，省约 40px 垂直空间。
  为有意偏离 webui AppearanceRow 原文案版，design §8.7.5 已同步（含偏离注记）；
  verify-cdp 外观行 2 条断言基于 `data-theme`/`tabindex`/类名，不依赖文字节点，
  预期不受影响（截图存档待重拍）。
- **popup 启动按钮 UX 与状态对齐（2026-08-22）**：① `error` 态保留「启动」重试入口
  （此前错误面板引导换端口/装 dsh 后主按钮反而被禁用，需等轮询恢复）；明细行 error
  文案追加「修复后点击启动重试」；② 忙碌态视觉对齐状态：无 pending 的
  `starting`/`stopping`（他处发起/宿主回填前）对应按钮显示 spinner + 「…中」文案，
  与圆点琥珀脉冲一致（此前只变文案无转圈）；③ pending 只有被点按钮转圈，其余按钮
  回到 idle 文案（此前点重启时「停止」也显示「停止中…」却无 spinner）；④ 忙碌中的
  按钮不被 `disabled` 灰化（`.btn.is-pending:disabled` / `.icon-btn.is-pending:disabled`
  `opacity:1`），spinner 全程全亮；design §8.2 行为规范新增第 12 条按钮状态矩阵。

### Fixed
- **M6 盲审修复（2026-08-22 独立审查后）**：① 浅色主题 `.theme-cube.selected`
  选中背景改用 `--dsw-alias-bg-module-platform` 但浅色 `:root` 未定义该变量 → 浅色下
  选中态无背景（回退 transparent），`:root` 补浅色定义（bluish-60，webui 同值）；
  ② 面板 `syncThemeMirror` 未复用既有 `contextAlive()` 模式——扩展重载后孤儿脚本的
  MutationObserver 会访问失效上下文，补前置检查 + 失效即 `disconnect()`；
  ③ 外观行补 radiogroup 规范键盘语义（roving tabindex + Arrow/Home/End 换选，换选即生效）；
  ④ popup/logs `:root` 定义 `--dsw-shadow-lv1/2`（此前仅 var() 调用无定义，恒走 fallback，
  中央化意图落空）；verify-cdp 新增 2 条防回归断言（浅色选中态背景渲染、
  键盘导航），全量 **PASS 50 / FAIL 0**。design §8.7.2/§8.7.4/§8.7.5 同步修订
  （镜像保留语义、面板「换肤零逻辑」措辞、外观行实际数值 + ARIA 规范）。
- **popup 操作竞态：`Cannot set properties of null (setting 'ack')`（2026-08-22 实机报错
  修复）**——点「重启」等操作后偶发崩溃：① init 首查/手动刷新/保存设置发起的 status
  请求在**操作发起前**在途，其应答（操作前快照，如 `stopped`——M5.5 时序下新进程端口
  就绪前无 run 记录正报 stopped）晚于操作应答返回时，被 `applyStatus` 的
  `finishPending(null,null)` 静默收敛清空 `pending`；② 宿主 start/restart 应答返回后
  `pending.ack=false` 写在 null 上 → TypeError。修复三层：status/manual 应答若快照
  早于操作发起（`pending.atMs > reqAt`）直接丢弃；`applyStatus` 终态判定仅在操作已应答
  （ack=false）后执行，且 `stopped` 对 start/restart 视为合法中间态、保留 pending 等
  starting/running；`doAction` 应答处理前加 null 防御（极端竞态下弃用本次应答，状态由
  2s 轮询自愈，不再抛错）。逻辑回归 78/78（按钮矩阵 + 7 个竞态场景：旧快照不误清/
  收敛期 stopped 保留/ack 前不误完成/stop 正常完成/starting 收敛链/null 防御）。
  design §8.2 行为规范新增第 13 条。

### Removed
- **「显示 dsh 控制台窗口」设置项与协议字段 `windowsHide` 已移除**（2026-08-15 实测核验）：
  Node `detached:true` 在 Windows 下由 libuv 无条件加 `DETACHED_PROCESS`（子进程既不继承
  也不新建控制台），`windowsHide` 不产生任何实际差异——勾选与取消勾选均无常驻控制台窗口、
  命令执行均闪现临时终端窗口（上游受限令牌限制，`CREATE_NO_WINDOW` 不可用，见
  `@deepseek-ai/dsh-sandbox-windows-acl` README）。popup 设置面板改为灰字如实说明；design
  §6.3 第 5 步同步修订；原 smoke 场景 27 与相关断言移除（场景 27 号复用于 M5.5 载体链路测试）。

### Added
- **M8 徽标提醒「该点回来看看了」（design §8.9，2026-08-22）**：解决「用户不长时间驻守
  dsh 标签」——内容脚本只读扫描 webui 会话状态的**语义标记**（`svg[data-state="ongoing"]`
  工作中点阵 / `[data-state="warning"]` 等待用户，取自 StateDot data-state 契约，非 CSS
  哈希类名），页面隐藏（`document.hidden`）时跟踪「工作→空闲（稳定 1.2s）」与「等待出现」，
  经 SW（`attentionMap` storage 持久化，`sender.tab.id` 为事实键，`tabs.onRemoved`/
  启动清理 + 4h TTL 兜底）分层渲染徽标：一轮完成 → 琥珀「!」（#f59e0b）；等待拍板
  （批准/问答/计划审查）→ **紫「?」（#8b5cf6，方案 A：原红「?」与状态层错误红撞色，
  2026-08-22 用户决策——红色全域只留给错误，紫=「等你拍板」专用色；§8.9.1 三层语义
  分层表）**，优先级覆盖完成；页面切回可见/标签关闭即自动清除、恢复服务态绿点/空白。
  popup 设置「界面」分组新增「徽标提醒（回来看看）」开关（默认开；关闭后 SW 忽略上报
  并清空累积条目）。verify-cdp 新增 8 条 M8 记录（7 断言 + 1 e2e 异常兜底记录：
  SW 分层 done→「!」/ waiting→「?」且覆盖/清空恢复 + e2e 前置隐藏断言/等待标记→「?」/
  切回自动清除/工作→完成 done 链路（基线存在真实工作中会话时如实记录）/结束恢复），
  全量 **PASS 71 / FAIL 0**（2026-08-22 实跑）。
  **M8 修补（2026-08-22，子代理盲审后修订）**：① H1 关闭时忽略 set（`handleAttention`
  set 分支前置判断 + 开关变 off 瞬间清空 attentionMap，防重开开关冒陈旧提醒）；② M2
  同标签导航离开 dsh 清残留（panel `pagehide` clear + SW `tabs.onUpdated` URL 判定兜底）；
  ③ M1 补 done 路径真实链路 e2e（注入 `svg[data-state=ongoing]`→移除→「!」，以 storage
  attentionMap 条目为链路证据）；④ L3 `sender.tab.url` 回环白名单；⑤ L4 background
  DEFAULT_SETTINGS 补 `theme`（防 onInstalled 合并丢弃）；⑥ L2 fg 白字断言；e2e 轮询
  替代固定 sleep。
- **M7 popup 排版优化（方案 A：应用栏 + 状态卡 + 分组设置，design §8.8，2026-08-22）**：
  解决 §8.2 现行排版「平铺朴实感」——信息无分区、重量均等、按钮不突出。① **三区结构**：
  应用栏（20px 鲸鱼 + 「DSH Manager」15/600 + 「dsh web」胶囊标签 + 右侧 28px 圆形刷新/设置）、
  状态卡（焦点区：`bg-module-platform` 底 + border-l1 + 圆角 12；左状态词 13/500 + 右端口 12/500
  业务蓝 + 次级行 11.5px caption tabular-nums）、操作区（主操作 h32 primary/danger/outline +
  「打开 Web UI」全宽 ghost）、底栏（border-top-l1 + 11px 提示 + 「查看日志」link）。全部走
  `--dsw-*` 令牌，零新增硬编码色；深色随 §8.7 令牌自动适配。② **状态变体**：running 绿点常规 /
  stopped 灰点 label-secondary / external 蓝点端口 / starting·stopping 琥珀 warn + **Matrix 点阵动效** /
  error **红调卡**（border rgba(236,19,19,.25) + 状态词 error 红，错误详情仍走既有 error 面板）；
  「端口 0 自动分配」等次级行文案迁移进卡片。③ **§8.8.1 Matrix 动效**（webui 会话侧栏「正在工作」
  点阵原样复刻）：SVG 10×10 viewBox 3×3 外圈 8 个 2×2 rect、`shape-rendering=crispEdges`、
  `fill=currentColor`、`animation-delay -1000ms…-125ms`（125ms 步进）；
  `@keyframes dot-chase` 关键帧逐字（0%,12.4%→1 / 12.5%,24.9%→.6 / 25%,37.4%→.35 / 37.5%,to→.15；
  1s 循环）；**popup 状态卡 / 页内面板 chip / logs 页状态点三处统一**（`.dot` 尺寸 10px 与
  `dot-busy` 类名语义不变，busy 态内部渲染切换为矩阵）；`prefers-reduced-motion` 置静态。
  ④ **设置面板分组**：「服务」（端口/Profile/自动打开/徽标）与「界面」（外观四 cube）11px/500
  caption 组标题，actions 仍在分组外底部；29 个既有 id 全部保留 + 4 个新增状态卡 id（statuscard/state-word/port-text/row2-text），主题引擎/镜像/外观行逻辑
  （§8.7，M6）零改动。⑤ verify-cdp 新增 15 条 M7 验收记录（14 项断言：状态卡结构/文案、busy 态 Matrix 渲染
  （8 cell + dot-chase + 全序列 125ms 相位差 + 琥珀状态词）、错误态红调卡、深/浅状态卡背景
  （深=bluish-800 #353638 精确值）、logs/面板 Matrix 基座、无新增 console 异常；另含 popup-m7.png
  截图存档），全量 **PASS 65 / FAIL 0**；`popup-m7.png`（浅）/ `popup-dark.png`（深）
  截图 vision 核验通过。design §8.8 此前已含完整规格与决策点默认取向（胶囊标签保留 /
  第二行信息保留完整 / 错误态红调卡 / Matrix 纳入）。
- **M7 修补（2026-08-22，用户实机观察反馈，design §8.8 同步注记）**：① **logs 页状态点闪烁**
  ——原实现把「页面日志请求在途（2s 自动刷新窗口）」映射为 dot-busy，绿点每 2s 被 Matrix
  替换几十毫秒再恢复，观感「点阵闪现即无」；改为状态点只表达 dsh 运行状态
  （error/running/stopped），Matrix 保留在 popup 状态卡与面板 chip（那里 busy=真实 dsh 状态
  转换/操作在途，语义正确）。② **运行态光晕呼吸**：running/external 圆点加 2.2s 光晕呼吸
  （光晕 opacity .08↔.18 缓动，实心点静止；浅深通用；reduced-motion 关闭），三处统一
  （popup/panel/logs）。③ **工具栏徽标风格统一**：badge「文字 ● + 绿底」组合在 Chrome 渲染
  混乱（自动对比文字色、字符与底吞没）、与面板分层圆点风格不统一 → 改「text:'●' + 绿底
  #22c55e + **文字色与底同色 #22c55e**」（隐形文字 → 纯绿色状态块；曾试「无文字 + 绿底」
  ——**Chrome 徽标 text 为空时整体不渲染**，实机重载后徽标不可见，2026-08-22 二次修订）；
  verify 徽标断言含 text/bg/fg 三值校验。
  ④ **popup 打开瞬间初始态**：首查 status 返回前静态初始渲染误导（「—」+ 空行2 +
  「安装 dsh-lifecycle 插件」提示 + 按钮可点）→ hint 初始改「正在获取 dsh 状态…」、状态卡
  行2 初始「正在获取状态…」、四主按钮与「打开 Web UI」初始 disabled、renderHint 在 detail
  为空时保持中性。verify-cdp 新增 1 条呼吸动画防回归断言，全量 **PASS 65 / FAIL 0**。
- **M7 修订二（2026-08-22，用户实机复盘，design §8.8/§8.8.1）**：① **Matrix 点阵动效撤销**
  ——webui「正在工作」点阵语义=**长时进行中的会话工作**，扩展 busy（starting/stopping/操作
  在途）是**秒级过渡态**，1Hz 追逐动画套上观感为「点阵闪现」，语义不匹配 → 不使用；busy
  态统一用琥珀圆点脉冲（既有 `dsh-dot-pulse` 1.2s）；popup/panel/logs 三处矩阵代码
  （SVG/关键帧/makeMatrix）全部移除，verify 断言改为「dot-busy + :after 脉冲 + 无 matrix」。
  ② **呼吸改实心点**：光晕太淡难以观察——呼吸迁移到**实心点**（opacity .5↔1 + scale .88↔1，
  2.2s，肉眼可见脉动）+ 光晕同步 .08↔.16（`dsh-halo-breathe`），三处统一。
  ③ **设置齿轮补齐内圈**：popup 设置图标此前只有外圈 path（提取不完整）——webui bundle
  `IconSettingsOutline16` 的 `<g>` 内含两个 path（外圈 + 内圈环 `M9.13764…`——含中心孔
  429 字节子路径），补全后与 webui 渲染一致（mockup 参考图同步；核对来源：
  `dsh-web-frontend/dist/assets/index-ClqxG24t.js`）。verify-cdp 断言同步重构
  （删矩阵断言、新增呼吸/脉冲/无矩阵断言），全量 **PASS 63 / FAIL 0**。
- **M7 修订三（2026-08-22，用户实测观察——工具栏图标视觉偏小/空间利用率低）**：扩展图标
  （16/48/128）此前为**透明底黑鲸**（客观测量：内容仅占画布 88%×63%（宽铺满、上下留白
  37%），且无底色，与相邻 KT 蓝块/黄猫等**满铺色块**图标并列时视觉重量明显偏小——非错觉，
  实测数据确认）→ 改为**品牌深底（#0F1115，圆角 22%）+ 白色鲸鱼**（webui 深色主题侧栏
  白鲸同款，品牌一致）：`tools/icons/_gen-icons.js` 渲染模板加满铺 `.bg` 层 + 注入时
  `fill="#0F1115"→"#FFFFFF"` 替换（`whale.svg` 源文件保持不变）；重新生成后内容占满
  **100%×100%**、四角保留透明（圆角外透出工具栏背景）。verify-cdp 不涉及图标资产，
  断言数不变（63/63）。
- **M6 主题与深色模式（design §8.7，2026-08-22）**：四态主题模型（`follow-webui` 默认 /
  `follow-system` / `light` / `dark`）。① **深色令牌**：popup.css / logs.css 内联 dsh Web
  UI 深色主题全量 `--dsw-*`（static/alias/specific，取自 dsh-client-ui-theme 打包源码，
  仓库内 `tools/ui-theme/dsw-tokens-dark.css` 存档逐字核验），`body[data-ds-dark-theme]`
  渲染标记与 webui 一致；修正 `.btn.primary` 为 `button-primary-fill` +
  `label-primary-foreground`（深色 = 白底深字，与 webui 主按钮同策略；
  原 brand-primary+bluish-00 组合在深色下会白底白字）、toast 三色变体 / `.error` /
  `.field-invalid` 深色覆盖、`color-scheme: dark`（原生 checkbox/number spinner 正确变深）。
  ② **主题引擎 `extension/theme.js`**（新，popup/logs 共用，零依赖）：四态白名单解析 +
  在 `<body>` 设/移除属性 + `storage.onChanged` / `matchMedia change` 实时自动切换。
  ③ popup 设置面板新增「外观」行（4 个 theme-cube 2×2 网格，复刻 webui AppearanceRow
  视觉；点选即生效、不弹 toast；保存其它设置保留主题选择；**三态图标为 webui bundle
  原样提取**：IconLightOutline16 / IconDarkOutline16 / IconFollowsystemOutline16，
  跟随 Web UI 用鲸鱼剪影）。④ 页内面板：CSS 变量继承
  天然跟随宿主（零逻辑）；MutationObserver 观察 `body[data-ds-dark-theme]` → 写 storage
  镜像 `webuiTheme`（幂等、含 port/at），popup/logs 经镜像跟随 webui **实际渲染态**，
  webui 未开时回退系统主题（design §8.7.3，只读镜像、不回写 webui 偏好）。
  ⑤ verify-cdp 新增 15 项主题断言（面板深色跟随 / 镜像写入 / popup 四态 +
  `Emulation.setEmulatedMedia` 系统模拟 / 无新增 console 异常），全量 **PASS 48 / FAIL 0**，
  `popup-dark.png` / `popup-light.png` 双截图存档（vision 核验通过）。
- **Windows 隐藏控制台载体（M5.5，2026-08-15）**：消除 dsh 命令执行闪窗——host.js 在
  Windows 下经 `launch-hidden.vbs`（`BASE_DIR` 下运行时自生成）+ `wscript.exe` +
  `WScript.Shell.Run(cmd, 0, False)`（SW_HIDE）拉起 dsh：dsh 获得**存在但从不显示**的
  控制台，其命令子进程继承该控制台（不再弹临时终端），桌面也无常驻窗口；命令经
  `DSH_MANAGER_LAUNCH_CMD` 环境变量传递、显式经 `cmd /d /c call` 执行以生效
  `1>> 日志 2>&1` 重定向（`WshShell.Run` 对引号开头命令直接 CreateProcess 会吞掉
  重定向）；run 记录 pid 在端口就绪后经端口表（netstat）反查（`findPidByPort`），
  `START_TIMEOUT` 时尽力反查回写以便仍可停止；POSIX 维持直接 spawn。实测核验：真实
  dsh 载体启动成功、控制台窗口不可见、停止后无孤儿；smoke 场景 27（Windows）新增
  载体链路断言，全量 **PASS 347 / FAIL 0**。
- `--port 0` 动态端口支持（design §6.3 start 第 9 步）：start 以 `--port 0` 拉起 dsh，
  从日志（spawn 时刻偏移之后）解析 `dsh web: http://127.0.0.1:<port>` URL 行回填
  run 记录实际端口；status 遇占位记录同样自愈回填（回填前 `port:null` +
  `requestedPort:0` + `starting`）；restart 按动态端口语义重放；POPUP 设置与
  host payload 均接受 0，徽标在动态端口下改经 native status 判定。
- fake-dsh 支持 `--port 0`（绑定后打印实际端口，与真实 dsh 一致）；smoke 场景 25
  覆盖回填/重启再发现/校验/超时/残留清理；smoke-real 新增 `--port 0` 真机段
  （**真实 dsh 0.1.0-rc.6 实测通过**：端口 58230 回填 + 停止全链路）。
- Firefox（Windows）宿主注册：manifest 声明 `browser_specific_settings.gecko.id`
  （`dsh-manager@local`）；install.ps1 解析 gecko id 写入宿主清单
  `allowed_extensions`（Chrome ID + gecko ID），注册表新增 Mozilla 项，uninstall
  同步清理；smoke 静态断言 gecko id 与模板一致性。**扩展在 Firefox 中的运行时行为
  尚未实测**（本机无 Firefox 验证环境）。
- smoke-real 新增「外部发现生产路径」只读段：真实 powershell 进程枚举 + netstat +
  指纹探测（实测检测到本机真实 dsh web，`EXTERNAL_UNMANAGED` 保护验证通过）——
  关闭「外部发现生产路径未实测」遗留项。
- **Linux 平台层实测通过（M4）**：host.js 新增 POSIX 分支（design §6.8）——状态根
  目录 `$XDG_CONFIG_HOME/dsh-manager` 或 `~/.config/dsh-manager`、强制终止
  `kill(-pid, SIGTERM)`（进程组）→ 3s → SIGKILL、零依赖 /proc 进程枚举与
  /proc/net/tcp(+tcp6) 端口表（inode → `/proc/*/fd` 反查 pid）、/proc PID 命令行
  校验；冒烟**场景 26（POSIX 专属）不注入任何 fake 钩子**，真实平台路径完成外部
  实例发现/接管/停止全链路。**Kali WSL（WSL2）全量冒烟 346/346 通过**；`BASE_ENV`
  进程枚举围栏改为仅 Windows 生效（本机常驻真实 dsh web 会干扰「空目录→stopped」
  场景，Linux 下无围栏让真实 /proc 直接参与冒烟）；新增 `tools/linux/`
  （`verify-linux.ps1` + `run-smoke-linux.sh`，自动准备便携 Node 22.16.0，幂等）。
  macOS 三个分支已实现但未实测（无 macOS 设备）。
- 文档：design.md §8.3/§9.1 与 §6.3 的 start 返回语义矛盾已对齐（宿主轮询至就绪
  后才应答 running）；新增 `docs/upstream-feedback.md`（M5 GitHub Discussions 帖子
  草稿，待用户账号发布）。

### Changed
- **README 全面重写**（用户要求，2026-08-14）：改为幽默/抽象风格，开头戏仿网络
  热梗句式快速勾勒使用场景与用户习惯（「不爱用 dsh web UI 的请划走 / 不会或者
  懒得敲终端启动命令的请留下」——后者为用户修正措辞，目标用户应留下而非划走），
  并注明本项目完全由 deepseek-V4-pro-0813 在 dsh 中构建（gemini-3.5-flash-lite
  任视觉辅助）；删除冗长的开源论述与目录/路线图大表格，保留
  功能、三步安装、配置、精简 FAQ 与安全/品牌一行声明；**新增「测试环境」章节**——
  列明 Windows 11 + Chrome/Edge（冒烟 339 PASS+1 SKIP）、Kali WSL2 Linux（346/346）、
  真实 dsh 0.1.0-rc.6 集成、verify-cdp 28 断言、插件单测 21 项，以及未实测项
  （macOS、Firefox 运行时、商店未上架）。
- design.md §15 记录范围决定：Chrome Web Store 上架与 macOS/Firefox 适配**暂缓**
  （无对应设备，CHROMEWEBSTORE.md 保留为将来素材）。
- **Linux 安装器（M4）**：新增 `native-host/install.sh` / `uninstall.sh`（POSIX sh，
  与 ps1 同构）——状态目录按 design §6.8 分支（`$XDG_CONFIG_HOME`/`~/.config` /
  `~/Library/Application Support`）；生成 `host.sh` 启动包装 + 宿主清单（JSON 转义
  交 node）；用户级注册四份浏览器 NativeMessagingHosts 清单（google-chrome /
  chromium / microsoft-edge / .mozilla，无需 sudo）；uninstall 经宿主 stop 动作
  复用全套防护链；`--dry-run`/`--extension-id`/`--keep-logs` 支持。host.js
  resolveDshBin 修复两处 POSIX 缺陷：npm 全局包布局 `prefix/lib/node_modules`
  （原仅拼 Windows 布局 `prefix/node_modules`）、`command -v dsh` 改经 `sh -c`
  （最小发行版无 /usr/bin/command 独立二进制）。README 安装章节
  增加 Linux/macOS 命令块；新增 `tools/linux/run-e2e-linux.sh`（真实安装 E2E：
  装真实 dsh → install.sh → 清单断言 → 经已安装宿主 start/status/指纹/stop →
  uninstall 清理），`verify-linux.ps1 -E2E` 可一键触发。

### Fixed
- **盲审整改**（第三方冷眼审计发布副本，结论「有条件发布」，无硬阻断）：design.md
  头部版本/日期/状态修正（0.1.0 / 2026-08-14 / 已实现）；AGENTS.md 插件单测
  18→21 项、冒烟口径标注本机与全新克隆两种语境；README 测试环境补全新克隆口径；
  popup.html 设置齿轮 SVG 移除无效 `clip-path` 引用（引用的 clipPath id 在独立
  SVG 内不可见，跨引擎可能静默失效）；发布副本剔除 4 份内部过程文档（
  open-source-review / upstream-feedback / publish / CHROMEWEBSTORE，清单见
  docs/publish.md）。
- smoke 静态核对自足化：`EXTENSION_ID.txt` / `extension-key.json` /
  `.extension-id.json` 为本地产物且不入库，缺失时记 SKIP 而非失败——**全新克隆
  （发布副本）可跑全量冒烟**（预期 333 PASS + 4 SKIP；本机开发目录 339 PASS + 1 SKIP）。
- 徽标动态端口分支死代码：`Number(s.port) || DEFAULT_SETTINGS.port` 会把合法设置值
  0 吞掉（port 0 时徽标错误地探测 3080）——改为 `Number.isFinite` 校验后原样使用；
  verify-cdp 新增徽标三步实测（附加扩展 SW：port 0 → 绿点、无监听端口 → 清空、
  恢复默认），并修正 SW 目标选择（Chrome 组件扩展的 service_worker 会干扰 find 首个）。
- popup starting 状态在动态端口下显示「端口自动分配中」。
- verify-cdp 增至 28 断言：面板「停止两步确认」安全实测（首击确认态 + 3s 超时还原，
  不执行真实停止）；smoke 新增 25h 占位期展示断言（不打印 URL 的存活进程 →
  `starting` + `port:null` + `requestedPort:0`，发现失败不误判）；fake-dsh 新增
  `DSH_FAKE_NO_URL=1` 变体；README 新增动态端口 FAQ。
- **页面内管理面板（§8.6）三处体验修复（2026-08-16，verify-cdp 33/33）**：
  - 修复「扩展重载/更新后旧面板永久红灯『状态获取失败』直到刷新页面」：扩展在
    `chrome://extensions` 重载/更新后，已打开页面里的旧内容脚本上下文失效（孤儿脚本，
    消息通道永久不可用）。CDP 实测复现（重载扩展 → 红错；刷新 → 恢复）后修复——
    检测到 `chrome.runtime.id` 为空即停止轮询并显示中性灰提示「扩展已重载或更新，
    请刷新页面恢复」（徽章「已断开」），不再误报红错；同时单次 status 失败不再立即
    红（连续 3 次约 6s 才显示「状态获取失败」，吸收 MV3 SW 休眠/唤醒竞态，期间保留
    上次成功状态）。
  - 圆点颜色改随「展示语义」而非原始状态：绿仅表示「本页托管实例运行中」，未托管/
    已停止为中性灰，外部实例为蓝（与 popup 配色一致）——此前「未托管」页面仍显示
    绿灯，语义矛盾。
  - 展开面板不再顶动胶囊：面板体改为绝对定位在胶囊上方弹出（`position:absolute;
    bottom:calc(100%+8px)`），胶囊位置不变——此前 body 是流内元素，展开时把胶囊
    向上顶起。
  - verify-cdp 新增 5 条回归断言（托管绿点+端口显示、展开时胶囊位置不变、面板在
    胶囊上方、扩展重载后提示刷新非红错、刷新页面后恢复托管状态），全量 PASS 33 /
    FAIL 0。

## [未发布] - M3 体验增强

### Added
- 宿主新增 `logs` 动作（design §6.3）：只读返回日志尾部或指定偏移之前的一段；
  参数 `tailLines`（1-2000，默认 500）、`maxBytes`（1KB-1MB，默认 256KB）、
  `beforeByte`（「加载更早」分页）。字节偏移按 UTF-8 精确计算，行边界对齐
  （跨块不完整首/尾行被丢弃），相邻块严格衔接（前块 `toByte` === 后块 `fromByte`）。
- 扩展新增日志查看页 `logs.html/js/css`（design §8.4）：尾部加载、按块向前翻页、
  2s 自动刷新（页面隐藏暂停、贴底跟随、与历史阅读互斥）、复制全部、错误横幅 + 重试；
  日志内容一律 `textContent` 渲染。popup 底部新增「查看日志」入口。
- 冒烟新增场景 24：空日志、尾部读取、beforeByte 分页衔接与全量重建、参数校验、
  `beforeByte>=size`/`beforeByte=0` 边界。
- 新增 `tools/verify-ui` 扩展 UI 自动验收：`verify-cdp.js`（零依赖 CDP 直连，
  沙箱内实测 16/16 通过：加载扩展、popup/日志页截图 + 文本断言 + console 异常检查、
  页面内管理面板注入/展开断言）与 `verify-ui.js`（Google 官方 chrome-devtools-mcp
  路径，版本钉 1.7.0，沙箱外）。工作区的第三方 chrome-mcp-server 构建产物已确认
  与需求不符并移除。
- 新增页面内管理面板 `extension/content/panel.js`（design §8.6）：dsh Web UI 页面
  右下角注入 shadow 面板（状态徽章 + 展开后停止两步确认/重启，全部动作经 SW →
  宿主全套防护）。方案采用 content script 而非 dsh client 插件：实测核验外部插件
  无独立构建路径（需 `dsh.client` 声明 + `exports["./client"]` 预构建 bundle）。

## [0.1.0] - 2026-02-13

首个发布版本，涵盖 M1（MVP）至 M2（生命周期插件）全部里程碑。

### M2 生命周期插件（优雅停机）

#### Added
- `plugin/dsh-lifecycle` 插件包：`POST /_lifecycle/shutdown` 优雅停机端点 +
  `GET /_lifecycle/health` 健康端点（注入 `webServer`/`appExit`，回环 + Origin 围栏）。
- 宿主 stop 先探测 health 判定插件可用，再走优雅停（3s 内端口关闭 → `stopMethod:'graceful'`，
  否则 taskkill 回退 → `'force'`）；status 附 `lifecycle`/`health` 富状态（不作存活判定依据）。
- popup：手动刷新按钮、设置无效输入红框 + 抖动 + 聚焦、复制失败 toast、状态漂移通知（去重）、
  hint 动态化、健康富状态、stopMethod toast。
- `peerDependencies`：`"@deepseek-ai/dsh": ">=0.1.0-rc.6 <0.2.0"`。

### M1.3 鲸鱼图标 + 点击反馈/动效

#### Added
- 扩展图标 16/48/128 由占位「蓝底 D」替换为与 Web UI 同源的鲸鱼图形（透明底黑鲸）。
- popup 操作乐观反馈：按钮禁用 + 转圈 + 不定进度条 + 阶段文案 + 耗时；完成/失败 toast 确认。
- 按钮按压/面板淡入/圆点颜色过渡动效（`prefers-reduced-motion` 关闭）。
- SW native 兜底超时按 action 区分（restart 120s）。

#### Fixed
- 修复长 restart 被 30s 兜底误判为 `NATIVE_ERROR` 的问题。

### M1.2 外部实例接管 + Web UI 同款视觉

#### Added
- `adopt` 动作：pid + port 双重匹配 → 解析原命令行 → 回写 run 记录 `adopted:true`；
  接管后 stop/restart 可用，restart 按原 argv 归一化重放且血统延续。
- popup 对齐 dsh Web UI 设计令牌（`--dsw-*` 浅色主题），鲸鱼 logo 与设置齿轮图标同源内联。

### M1.1 外部实例检测

#### Added
- status 无 run 记录时自动发现外部 dsh web（进程枚举 → 命令行解析 `--port` → netstat 端口表回退 →
  `GET /` 指纹 `DeepSeek Harness`）。
- `external` 状态展示 + 打开 UI；stop/restart 返回 `EXTERNAL_UNMANAGED`。
- 测试钩子 `DSH_MANAGER_FAKE_PROCESSES` / `DSH_MANAGER_FAKE_LISTENERS`。

### M1 MVP

#### Added
- Chrome MV3 扩展：popup UI、service worker（串行 native 调用 + 徽标）。
- Native Messaging 宿主：`ping` / `status` / `start` / `stop` / `restart`。
- 安装器（`install.ps1`）与卸载器（`uninstall.ps1`）。
- 冒烟测试（fake-dsh，覆盖宿主主流程）。
