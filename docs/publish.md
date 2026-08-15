# 发布清单（publish.md）

dsh-manager 的公开仓库按「**内容镜像 + 增量提交**」方案准备（2026-08-16 修订：早期
「另起新仓、单提交发布」方案 A 已废弃——发布版 git 历史单独管理，每次发布在既有历史
之上叠加一条新提交，绝不 `git init` 推平；首次发布才 init + 初始提交）。本文件记录
发布时需在 GitHub 上操作的事项与步骤。

## 仓库布局（私有开发 + 公开发布镜像）

| 仓库 | 地址 | 状态 |
|------|------|------|
| 开发仓库（**私有**，完整历史） | https://github.com/222wcnm/dsh-manager-dev | 已建仓并推送（main 分支，2026-08-14） |
| 发布仓库（**公开**，增量历史） | https://github.com/222wcnm/dsh-manager | 已公开发布（2026-08-14 初始提交 `v0.1.0`；2026-08-16 增量 `v0.1.1`，五个话题：dsh / dsh-plugin / deepseek-harness / chrome-extension / native-messaging） |

日常开发只推私有开发仓库；发布新版本时重建发布副本（**保留发布仓库历史与 remote，
只做内容镜像 + 增量提交**）并推公开仓库（`build-publish.ps1` + push）。

## 发布物剔除清单（build-publish.ps1 自动执行）

以下内部过程文档**不进入**发布副本（仅存在于私有开发仓库）：

- `docs/open-source-review.md` —— 开源前内部审查记录（含 subagent 分工、待拍板决策）
- `docs/upstream-feedback.md` —— M5 GitHub Discussions 帖子草稿（含待填占位）
- `docs/publish.md` —— 本文件：发布操作清单，开发仓库自用
- `CHROMEWEBSTORE.md` —— 商店上架素材（暂缓上架，保留待用）

## 仓库话题（Topics）

| Topic | 依据 |
|-------|------|
| `dsh` | 官方公开测试公告要求：插件仓库必须带 `#dsh` 话题标签 |
| `dsh-plugin` | 官方仓库自用话题之一，也是 awesome-deepseek-harness 与 dshplugins.com 的公开发现入口（`github.com/topics/dsh-plugin`） |
| `deepseek-harness` | 便于按项目全名检索 |
| `chrome-extension` | 描述性话题：本项目本体是 Chrome MV3 扩展 |
| `native-messaging` | 描述性话题：宿主经 Chrome Native Messaging 通信 |

官方仓库自身的话题（2026-08-14 经 GitHub API 实测）为 `cordis`、`dsh`、`dsh-plugin`、`ai-agents`，
作为对照参考。

## 发布步骤（内容镜像 + 增量提交）

发布副本位于仓库外的 `dsh-manager-publish/`（**git 历史与 remote 单独管理**：
首次发布 `git init` + 初始提交；此后每次发布在既有历史之上叠加一条增量提交，
`robocopy /MIR` 以 `/XD .git` 排除发布仓库的 `.git`，绝不推平历史）。
发布物只带面向使用者的正式版本条目，CHANGELOG 由脚本以 `tools/publish/release-changelog.md`
替换（开发期流水账留在开发仓库）。

1. 发布新版本前：先在 `tools/publish/release-changelog.md` 加好该版本的正式条目。

2. 在开发仓库根目录重建发布副本（自动保留历史/remote 并增量提交）：

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\publish\build-publish.ps1 -Version 0.1.1 -CommitMessage "页面内管理面板体验修复（重载提示/圆点语义/展开布局）"
   ```

   参数：`-Version`（默认 0.1.0）、`-CommitMessage`（提交信息正文，前缀自动加 v<版本>）、
   `-PublishDir`（默认仓库同级 `dsh-manager-publish`）。

3. 首次发布（仅当发布目录尚无 `.git`）才需要：在 GitHub 新建空仓库（**不要**勾选
   README/.gitignore/LICENSE 初始化），然后在发布副本内：

   ```powershell
   git remote add origin https://github.com/<你的账号>/dsh-manager.git
   git push -u origin main
   ```

   此后发布副本的 remote 由脚本保留，push 直接 `git push` 即可。

4. 在仓库 Settings → Topics 填上上表五个话题（已填则跳过）；描述：
   「DSH Manager — 浏览器一键启动/停止/重启 DeepSeek Harness（dsh）web 服务」。

5. 发布前自查（每次发布前重跑）：
   - 发布副本内 `git status` 干净；`git log --oneline` 为「初始提交 + 历次增量提交」
     （发布版历史独立延续，不做单提交 squash）；
   - `git ls-files` 中无 `extension-key.json` / `.extension-id.json` / `com.dsh.manager.reg`；
   - 冒烟 `node native-host/test/smoke.js` 通过——**全新克隆预期 333 PASS + 4 SKIP**
     （3 项本地产物核对 SKIP + 1 项 POSIX 场景 SKIP，smoke 已自足化；本机开发目录
     因本地产物存在为 339 PASS + 1 SKIP）；
   - UI 验收 `node tools/verify-ui/verify-cdp.js`（33 断言）通过；
   - 原开发仓库（`dsh-manager/`，含完整历史）本地保留备份，不回滚不删除。

## 范围决定（2026-08-14）

- Chrome Web Store 上架：暂缓（CHROMEWEBSTORE.md 保留为素材）。
- macOS / Firefox 运行时适配：暂缓（分支与注册已实现，缺设备实测）。
- 历史：发布物不含开发期迭代记录，发布仓库只承载「正式版本增量提交」序列
  （v0.1.0 初始提交 → v0.1.1 …），详情见主仓库 CHANGELOG 与 docs/design.md。
