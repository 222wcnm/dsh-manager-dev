# M5 上游反馈草稿（GitHub Discussions 帖子，待用户账号发布）

> 用途：按 design.md §15 M5 路线，向 deepseek-harness 上游做社区反馈。官方
> （2026-08-13 公告）暂不接受外部 PR，故走 GitHub Discussions。**本文档是
> 草稿**：发布前请用你自己的 GitHub 账号复制到
> https://github.com/deepseek-ai/deepseek-harness/discussions 并微调语气。

---

## 标题

【社区项目】dsh-manager：浏览器一键管理 dsh web 生命周期（附对上游的几点小建议）

## 正文

大家好，分享一个围绕 deepseek-harness 做的社区小工具，以及开发过程中发现的几个上游可优化点。

**项目**：dsh-manager（非官方，MIT）——Chrome/Edge 扩展 + Native Messaging 宿主，
一键启动 / 停止 / 重启 `dsh web`（默认 http://127.0.0.1:3080），免开终端。
仓库：`<你的仓库地址>`。

**特性**（基于 @deepseek-ai/dsh@0.1.0-rc.6 逐条核验实现）：

- 一键启动 / 停止 / 重启 + 状态徽标；停止在未装插件时以 taskkill 兜底；
- 外部实例发现与接管：终端手工启动的 `dsh web`（任意端口，含 `--port 0`）可被
  识别、打开 UI、接管后纳入管理；
- 配套 `dsh-lifecycle` 插件：`POST /_lifecycle/shutdown` 优雅停机 +
  `GET /_lifecycle/health` 健康端点（注入 `webServer`/`appExit`，回环 + Origin 围栏）；
- 日志查看页（宿主按字节分页读日志文件）与 dsh Web UI 页面内的管理面板
  （content script 注入，停止/重启不经终端）；
- `--port 0` 动态端口：从日志的 `dsh web:` URL 行回填实际端口。

**给上游的几点小建议**（按影响排序）：

1. **能否内置优雅停机端点**：目前外部进程停止 dsh 只能强杀（Windows 无信号机制）。
   若有官方 `POST /_lifecycle/shutdown` 或 `dsh server stop` 子命令，生态工具就不必
   各自实现；`appExit` 若正式文档化也很有帮助（目前仅包级 README 提及）。
2. **Web 客户端插件的独立构建路径**：外部包要挂 `dsh.client` + 提供预构建
   `exports["./client"]` bundle（工厂形式 CJS + 纯化门禁），但构建工具链只在
   monorepo 内，社区作者没有可复现的构建入口。若提供 `dsh plugin build` 或文档化
   bundle 格式，客户端插件生态会容易很多。
3. **`dsh web --port 0` 的日志格式契约**：我们的动态端口发现依赖 `dsh web:
   http://127.0.0.1:<port>` 这行输出，建议作为稳定契约文档化（或提供机器可读输出）。

如果这些方向合适，我们很乐意配合实现或按官方渠道提交 PR（在官方开放外部 PR 之后）。

**免责声明**：本项目与 DeepSeek 无隶属、无背书关系；鲸鱼 logo 版权归 DeepSeek 所有，
仅作非官方辨识用途（计划替换为原创图形），详见仓库 NOTICE。

---

## 发布前检查清单

- [ ] 用你自己的 GitHub 账号登录并发布（本仓库没有、也不应保存任何凭据）
- [ ] 把「`<你的仓库地址>`」替换为实际仓库 URL
- [ ] 确认官方 PR 政策是否有变化（若已开放外部 PR，改为提 PR 并附本仓库链接）
- [ ] 发布后把 Discussion 链接回填到 AGENTS.md 的 M5 状态行
