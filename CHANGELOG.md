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
- 文档：design.md §8.3/§9.1 与 §6.3 的 start 返回语义矛盾已对齐（宿主轮询至就绪
  后才应答 running）；新增 `docs/upstream-feedback.md`（M5 GitHub Discussions 帖子
  草稿，待用户账号发布）。

### Fixed
- 徽标动态端口分支死代码：`Number(s.port) || DEFAULT_SETTINGS.port` 会把合法设置值
  0 吞掉（port 0 时徽标错误地探测 3080）——改为 `Number.isFinite` 校验后原样使用；
  verify-cdp 新增徽标三步实测（附加扩展 SW：port 0 → 绿点、无监听端口 → 清空、
  恢复默认），并修正 SW 目标选择（Chrome 组件扩展的 service_worker 会干扰 find 首个）。
- popup starting 状态在动态端口下显示「端口自动分配中」。

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
