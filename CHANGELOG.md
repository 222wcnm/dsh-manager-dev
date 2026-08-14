# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布] - M4 跨平台/跨浏览器（进行中）

### Added
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
