# DSH Manager

通过浏览器扩展一键管理 DeepSeek Harness（dsh）的 Web 服务生命周期：**启动 / 停止 / 重启 `dsh web`，自动打开 Web UI**，全程无需打开终端。

> **非官方免责声明**：本项目是**非官方**社区工具，与 DeepSeek（深度求索）/ DeepSeek Harness 官方团队**无隶属、无背书**关系。"DSH" 指被管理的 DeepSeek Harness。鲸鱼 logo 及品牌素材版权归 DeepSeek 所有，本项目仅作非官方辨识用途（详见 [NOTICE](NOTICE)），并计划替换为原创图形。

> **风险自担**：本扩展会以 `taskkill /T /F` 强制终止 dsh 进程（安装 `dsh-lifecycle` 插件后自动改用官方优雅停机）。强制终止可能丢失最近数秒会话状态，使用前请自行评估，风险自担。

- 目标平台：Windows 10/11 + Chrome / Edge；Firefox（实验性，宿主注册已支持，扩展运行时待实测）
- 详细设计文档：[docs/design.md](docs/design.md)

## 功能

- **一键启动**：点击扩展图标 → 启动 `dsh web`（默认 `http://127.0.0.1:3080`）→ 自动打开 Web UI
- **一键停止 / 重启**：停止按状态自动降级（v1 taskkill / M2 优雅停机），重启重放原启动参数
- **外部实例检测**：在终端手工启动的 `dsh web`（任意端口，含 `--port 0`）也能被自动识别——popup 显示 `external` 状态与实际地址，可一键打开 Web UI
- **外部实例接管**：对检测到的外部实例点「接管」后纳入扩展管理——获得停止 / 重启能力，重启按原命令行参数重放
- **状态可视化**：图标徽标（绿点 = 运行中）+ popup 面板实时展示 stopped / starting / running / stopping / error / external
- **日志查看**：popup 底部「查看日志」打开全页日志查看器——自动刷新尾部、按块加载更早日志、一键复制全部
- **页面内管理面板**：打开 dsh Web UI 时页面右下角自动出现管理徽章——实时状态、展开后可停止（两步确认）/ 重启，全程不用离开页面
- **Web UI 同款视觉**：popup 界面与 DeepSeek Harness Web GUI 同一套设计令牌（`--dsw-*` 浅色主题、字体、配色、组件风格）
- **无守护进程**：dsh 停止时系统零残留；状态由本地状态文件 + PID 存活 + 端口探测推导，可靠且无状态
- **可配置**：端口、profile、自动打开 UI、徽标刷新间隔
- **安全**：仅 127.0.0.1 回环通信；不读取 dsh 凭据；宿主清单仅接受本项目固定扩展 ID

## 安装（三步）

> **前置条件**：Node.js ≥ 18，并已全局安装 dsh：
>
> ```powershell
> npm i -g @deepseek-ai/dsh
> ```

**第一步：运行安装脚本**

```powershell
# 建议先预演（只打印，不写注册表）：
powershell -ExecutionPolicy Bypass -File .\native-host\install.ps1 -DryRun
# 正式安装：
powershell -ExecutionPolicy Bypass -File .\native-host\install.ps1
```

脚本会自动完成：

- 从 `extension\manifest.json` 的 `key` 自动计算固定扩展 ID（`compute-id.js`，sha256 前 16 字节映射为 a–p 字符）；
- 解析 Firefox 附加组件 ID（`browser_specific_settings.gecko.id`）写入宿主清单的 `allowed_extensions`；
- 创建 `%LOCALAPPDATA%\dsh-manager\{host,run,logs}`；
- 生成 `host.cmd`（Node 启动包装）与 `com.dsh.manager.json`（宿主清单）；
- 注册 Chrome、Edge 与 Firefox 的 Native Messaging 宿主（HKCU，无需管理员权限）；
- 导出 `native-host\com.dsh.manager.reg` 备用（注册表写入失败时可手动导入）。

**第二步：加载扩展**

打开 `chrome://extensions`（或 `edge://extensions`）→ 开启右上角「开发者模式」→ 点击「加载已解压的扩展程序」→ 选择本仓库的 `extension` 目录。

> 若浏览器此前已在运行，请**完全退出并重新启动浏览器**，再加载扩展（Native Messaging 宿主注册变更必须重启浏览器才生效）。

**第三步：使用**

点击浏览器工具栏的 DSH Manager 图标，在 popup 中点击「启动」。状态就绪后会自动打开 Web UI（可在设置中关闭）。

## 使用说明

- 打开 popup 即显示当前状态与操作按钮；按钮随状态自动启用 / 禁用。
- 「启动」后 popup 自动轮询直至 running 或超时；异常时展示错误码与日志尾部，可一键复制日志。
- 点击「打开 Web UI」在标签页中打开 `http://127.0.0.1:<port>`。
- 点击 popup 底部「查看日志」打开日志查看页：默认自动刷新最新日志（每 2 秒）、「加载更早」逐块向前翻历史、「复制全部」复制已加载内容。

## 卸载

- 运行 `native-host\uninstall.ps1`：停止 dsh、清理注册表与数据目录。
- 加 `-KeepLogs` 可先把日志备份到桌面再删除数据目录。
- （M2 起，若安装了 dsh-lifecycle 插件）卸载脚本会询问是否 `dsh plugin --profile web remove dsh-lifecycle`。

## 配置项

popup 设置面板（保存在 `chrome.storage.local`）：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 端口 port | `3080` | dsh web 监听端口；被占用时可在设置中更换；`0` = 自动分配动态端口（启动后从日志回填实际端口） |
| profile | `web` | 透传给 `dsh --profile` |
| 主机 host | `127.0.0.1` | v1 固定，不允许 `0.0.0.0` |
| 自动打开 UI | 开 | 启动就绪后自动打开 Web UI 标签页 |
| 徽标刷新间隔 | 30 秒 | 图标徽标的状态刷新周期（`chrome.alarms`） |

## 常见问题（FAQ）

**打开 popup 显示 HOST_NOT_INSTALLED？**
浏览器找不到本地宿主。请重新运行 `native-host\install.ps1`，然后**完全退出并重启浏览器**。

**端口被占用（PORT_BUSY / 启动失败）？**
其他程序占用了 3080 端口。可在 popup 设置中更换端口后重启，或先关闭占用端口的程序。若占用者本身就是另一个 dsh web（如在终端里手工启动过），扩展会识别并在 popup 显示 `external` 状态——可打开它的 Web UI，或点「接管」纳入扩展管理。

**popup 显示「external」是什么？**
检测到有一个**不是由本扩展启动**的 dsh web 正在运行（例如你在终端里手工跑过 `dsh web --port 4080`）。扩展会自动解析出它的端口并显示实际地址，可一键打开 Web UI；点「接管」后即可像自启动的实例一样停止 / 重启（重启按原命令行参数重放）。不接管的话扩展不会动它。

**安装后扩展不生效？**
Chrome 会缓存宿主清单，manifest / 注册表变更后必须完全重启浏览器（关闭所有窗口后再打开）。

**安全吗？**
- 扩展与宿主仅通过 `127.0.0.1` 回环通信；宿主清单的 `allowed_origins` 仅含本项目固定扩展 ID，其他扩展无法调用。
- 扩展**不读取、不存储** dsh 的凭据文件（`$DSH_HOME` 下的 `.credentials.yaml` 等）；状态展示仅含 pid / 端口 / 时长 / 版本。
- 状态文件与日志位于 `%LOCALAPPDATA%\dsh-manager\`，仅当前用户可读。

**日志在哪里？**
`%LOCALAPPDATA%\dsh-manager\logs\dsh-web.log`（dsh 的 stdout/stderr 追加日志）。在扩展 popup 底部点击「查看日志」即可在浏览器里直接查看（自动刷新、可翻历史、可复制全部）。

**停止是否安全？**
Windows 无法从外部触发 dsh 的 SIGINT/SIGTERM 优雅退出，v1 以 `taskkill /PID <pid> /T /F` 强制停止；dsh 会话持久化保证最多丢失最后几秒状态。安装 M2 的 `dsh-lifecycle` 插件后可走官方优雅停机（`POST /_lifecycle/shutdown`）。

## 目录结构

```
dsh-manager/
├─ docs/
│  └─ design.md                  # 详细设计文档（架构、协议、安全、路线图）
├─ extension/                    # 浏览器扩展（MV3，可直接「加载已解压的扩展程序」）
│  ├─ manifest.json              # 含 key 字段（固定扩展 ID 的来源）
│  ├─ background.js              # Service Worker：native 消息中转 + 徽标刷新
│  ├─ popup.html / popup.js / popup.css
│  ├─ logs.html / logs.js / logs.css   # 日志查看页（M3）
│  ├─ content/panel.js                 # 页面内管理面板（M3，content script）
│  └─ icons/
├─ native-host/
│  ├─ host.js                    # Native Messaging 宿主主程序（零依赖）
│  ├─ compute-id.js              # 由 manifest key 计算固定扩展 ID
│  ├─ install.ps1                # 安装脚本（生成清单 + 注册 Chrome/Edge）
│  ├─ uninstall.ps1              # 卸载脚本（停 dsh + 清注册表 + 删数据目录）
│  ├─ host.cmd.template          # host.cmd 生成模板（文档参考）
│  ├─ com.dsh.manager.json.template
│  └─ test/                      # 冒烟测试
├─ plugin/                       # M2 dsh 生命周期插件（规划）
├─ tools/                        # 开发期工具（视觉审计 / 图标生成 / verify-ui 扩展 UI 自动验收）
└─ README.md
```

## 路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| **M1 MVP** | 扩展（popup + SW）、宿主（ping/status/start/stop/restart）、安装 / 卸载器、冒烟测试 | 完成 |
| **M1.1 外部实例检测** | status 自动发现非本扩展启动的 dsh web 及其端口（进程扫描 + netstat + HTTP 指纹），`external` 状态展示 + 打开 UI；`EXTERNAL_UNMANAGED` 保护 | 完成 |
| **M1.2 外部实例接管 + Web UI 同款视觉** | adopt 动作（pid+port 双重匹配回写 run 记录），接管后停止/重启可用、重启按原 argv 重放；popup 对齐 dsh Web UI 设计令牌（`--dsw-*` 浅色主题） | 完成 |
| **M2 生命周期插件** | `dsh-lifecycle`：`/_lifecycle/shutdown` 优雅停机 + `/_lifecycle/health` 健康状态；宿主优雅停止链、popup 富状态 | 完成 |
| **M3 体验增强** | 日志查看与复制、启动后自动开 UI 开关、徽标周期刷新、Web UI 页面内管理面板 | 完成 |
| **M4 跨平台 / 跨浏览器** | macOS / Linux、Firefox（`allowed_extensions` 已预留）、`--port 0` 端口发现（本扩展启动场景） | 规划 |

## 相关链接

- dsh 仓库：https://github.com/deepseek-ai/deepseek-harness
- dsh npm 包：https://www.npmjs.com/package/@deepseek-ai/dsh
- Chrome Native Messaging：https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging

## 贡献

欢迎贡献！本地构建、测试命令与提交规范见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

本项目以 [MIT License](LICENSE) 开源。鲸鱼 logo 等品牌素材版权归 DeepSeek 所有、不随 MIT 授权，详见 [NOTICE](NOTICE)。
