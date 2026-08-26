# Chrome Web Store Listing — Whalekeeper

> Last Updated: 2026-08-22
> 本文档是 Chrome Web Store 上架信息与发布就绪度的唯一事实源（chrome-extensions 技能约定）。
> 发布前按此逐项填写 Dashboard 即可；隐私声明、权限理由与版本历史随代码变化同步更新。

## Store Listing

**Extension Name** [REQUIRED]

Whalekeeper

**Short Description** [REQUIRED]（≤132 字符）

Whalekeeper — 一键管理本机 DeepSeek Harness (dsh) Web 服务：启动、停止、重启、状态监控与日志查看，全程无需打开终端。

**Detailed Description** [REQUIRED]

Whalekeeper — 一键管理本机 DeepSeek Harness (dsh) Web 服务，无需打开终端。

主要功能：

- 一键启动 / 停止 / 重启 dsh Web 服务，工具栏徽标实时显示运行状态
- dsh 页面在后台时，工作完成或需要你输入时，工具栏图标自动亮起提醒徽标（「!」完成 /「?」等待拍板），切回页面即清除
- 自动识别你在终端里手工启动的 dsh（任意端口），一键打开或接管管理
- 端口被占用时可更换端口，或设为自动分配动态端口
- 查看 dsh 的运行日志，自动跟随最新内容、翻看历史、一键复制
- 打开 dsh Web 页面时，页面右下角出现管理徽章，可直接停止 / 重启
- 停止时优先使用官方优雅停机方式，保护会话状态

使用方式：

1. 本机安装 Node.js 与 dsh（npm i -g @deepseek-ai/dsh）
2. 安装本扩展附带的本地组件（随附脚本，一次性完成）
3. 点击工具栏图标，按「启动」即可；dsh 就绪后自动打开其 Web 界面

本扩展只与本机 127.0.0.1 通信，不读取、不传输你的任何数据；设置仅保存在你的浏览器本地。

支持与反馈：见 GitHub 仓库 Issues。

**Category** [REQUIRED]

Developer Tools

**Single Purpose** [REQUIRED]

在浏览器中一键管理本机 DeepSeek Harness (dsh) Web 服务的启动、停止与重启。

**Primary Language** [REQUIRED]

Chinese (Simplified)（描述同时提供英文，界面为中文）

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `extension/icons/128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 或 640×400 | 🟡 Needs update | `tools/verify-ui/shots/popup.png`（当前 1258×802，需重切/缩放） |
| Screenshot 2 [RECOMMENDED] | 1280×800 或 640×400 | 🟡 Needs update | `tools/verify-ui/shots/logs.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 或 640×400 | 🟡 Needs update | `tools/verify-ui/shots/panel.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes

- Screenshot 1（popup）：展示运行中状态面板——状态圆点、启动/停止/重启按钮、健康信息、查看日志入口。
- Screenshot 2（日志查看页）：展示 dsh 运行日志的尾部与底部状态栏。
- Screenshot 3（页面内管理面板）：展示 dsh Web 页面右下角的悬浮管理徽章与展开面板。
- **品牌注意（见 Review Notes）**：截图与图标含 DeepSeek 鲸鱼图形，其版权归 DeepSeek 所有；
  计划替换为原创图形后再正式提交，或确保截图中的品牌元素符合 DeepSeek 品牌使用规范。

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | 保存用户的本地设置（端口、profile、启动后自动打开界面、徽标刷新间隔、徽标提醒开关）与页内提醒状态——仅存于用户本机浏览器 |
| `nativeMessaging` | permissions | 与本机安装的随附原生组件通信，从而在用户点击按钮时启动 / 停止 / 重启用户自己安装的 dsh 进程 |
| `alarms` | permissions | 按用户设置的间隔周期性刷新工具栏徽标，显示 dsh 是否在运行（Chrome 定时器机制，非持续后台运行） |
| `http://127.0.0.1/*` | host_permissions | 仅访问用户本机回环地址：探测 dsh Web 服务是否就绪（以便显示准确状态与自动打开界面），并在 dsh 自己的页面上显示管理面板 |
| `http://localhost/*` | host_permissions | 同上（localhost 与 127.0.0.1 同指本机回环） |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

- 无遥测、无分析、无广告、无第三方服务调用；
- 所有数据（设置、状态、日志读取）都停留在用户本机；网络请求仅发往本机 127.0.0.1；
- 徽标提醒仅读取 dsh 页面上的会话状态标记（「工作中/等待输入/空闲」三类），不读取消息内容、不采集会话文本；
- 不读取、不存储 dsh 的凭据文件。

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]

待定（发布前托管到 GitHub Pages，内容可直接沿用本节「不收集任何数据」的声明；见
`references/webstore/privacy-policy.md` 模板生成）。

## Distribution

**Visibility**: Public（待用户确认）
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]

待用户填写（Chrome Web Store 开发者账号主体名称）

**Contact Email** [REQUIRED]

待用户填写（将公开展示在商店页）

**Support URL / Email** [RECOMMENDED]

GitHub 仓库 Issues（仓库地址待发布时填写）

**Homepage URL** [RECOMMENDED]

GitHub 仓库主页（待发布时填写）

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.2.0 | 2026-08-22 | 新增徽标提醒「该点回来看看了」：dsh 页面在后台时工作完成 / 等待用户 → 工具栏徽标「!」/「?」提醒（设置面板可开关） | Draft |
| 0.1.0 | — | 首个版本：一键启动/停止/重启、状态徽标、外部实例发现与接管、优雅停机（随附 dsh 插件）、日志查看、页面内管理面板、动态端口 | Draft |

## Review Notes

### Known Issues / Limitations

- **品牌素材**：扩展图标与界面截图中的鲸鱼图形版权归 DeepSeek 所有（本项目为社区工具，
  无隶属关系）；README 与 NOTICE 已声明并计划替换为原创图形。**提交前须处理**：替换
  图标或取得/确认品牌使用许可，避免审核拒绝与投诉风险。
- 停止操作在未安装随附 dsh 插件的旧式场景下会强制结束 dsh 进程（会话可能丢失最后数秒
  状态）；描述文案已说明，审核如问询可引用。
- 仅支持 Windows + Chrome/Edge（Firefox 宿主注册已支持但运行时未实测）；商店描述按
  Windows + Chrome 撰写，不夸大跨平台支持。

### Rejection History

（暂无）
