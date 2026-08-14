# 发布清单（publish.md）

dsh-manager 的公开仓库按「另起新仓、单提交发布」方案准备（方案 A）。本文件记录发布时需在
GitHub 上操作的事项与步骤；当前状态：**本地已备好发布副本，尚未推送**。

## 仓库布局（私有开发 + 公开发布镜像）

| 仓库 | 地址 | 状态 |
|------|------|------|
| 开发仓库（**私有**，完整历史） | https://github.com/222wcnm/dsh-manager-dev | 已建仓并推送（main 分支，2026-08-14） |
| 发布仓库（**公开**，单提交快照） | https://github.com/222wcnm/dsh-manager（计划名） | 尚未创建 |

日常开发只推私有开发仓库；公开发布时才按下方步骤推送发布副本。

## 仓库话题（Topics）

发布后在仓库设置（Settings → Topics，或建仓向导）填写：

| Topic | 依据 |
|-------|------|
| `dsh` | 官方公开测试公告要求：插件仓库必须带 `#dsh` 话题标签 |
| `dsh-plugin` | 官方仓库自用话题之一，也是 awesome-deepseek-harness 与 dshplugins.com 的公开发现入口（`github.com/topics/dsh-plugin`） |
| `deepseek-harness` | 便于按项目全名检索 |
| `chrome-extension` | 描述性话题：本项目本体是 Chrome MV3 扩展 |
| `native-messaging` | 描述性话题：宿主经 Chrome Native Messaging 通信 |

官方仓库自身的话题（2026-08-14 经 GitHub API 实测）为 `cordis`、`dsh`、`dsh-plugin`、`ai-agents`，
作为对照参考。

## 发布步骤（方案 A：另起新仓、单提交）

发布副本位于仓库外的 `dsh-manager-publish/`（单提交 `v0.1`，与主仓库开发历史解耦）。
发布物只带面向使用者的正式版本条目，CHANGELOG 由脚本以 `tools/publish/release-changelog.md`
替换（开发期流水账留在开发仓库）。

1. （重）建发布副本：在开发仓库根目录运行

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\publish\build-publish.ps1
   ```

   参数：`-Version`（默认 0.1.0）、`-PublishDir`（默认仓库同级 `dsh-manager-publish`）。
   发布新版本前：先在 `tools/publish/release-changelog.md` 加好正式条目，再跑脚本。

2. 在 GitHub 新建空仓库（**不要**勾选 README/.gitignore/LICENSE 初始化）。
3. 在发布副本内：

   ```powershell
   git remote add origin https://github.com/<你的账号>/dsh-manager.git
   git push -u origin main
   ```

4. 在仓库 Settings → Topics 填上上表五个话题；描述可写：
   「DSH Manager — 浏览器一键启动/停止/重启 DeepSeek Harness（dsh）web 服务」。
5. 发布前自查（每次发布前重跑）：
   - 发布副本内 `git status` 干净、`git log --oneline` 仅 1 条、CHANGELOG 为正式版本条目；
   - `git ls-files` 中无 `extension-key.json` / `.extension-id.json` / `com.dsh.manager.reg`；
   - 冒烟 `node native-host/test/smoke.js` 通过——**全新克隆预期 333 PASS + 4 SKIP**
     （3 项本地产物核对 SKIP + 1 项 POSIX 场景 SKIP，smoke 已自足化；本机开发目录
     因本地产物存在为 339 PASS + 1 SKIP）；
   - UI 验收 `node tools/verify-ui/verify-cdp.js`（28 断言）通过；
   - 原开发仓库（`dsh-manager/`，含完整历史）本地保留备份，不回滚不删除。

## 范围决定（2026-08-14）

- Chrome Web Store 上架：暂缓（CHROMEWEBSTORE.md 保留为素材）。
- macOS / Firefox 运行时适配：暂缓（分支与注册已实现，缺设备实测）。
- 历史：发布物不含开发期迭代记录（单提交），详情见主仓库 CHANGELOG 与 docs/design.md。
