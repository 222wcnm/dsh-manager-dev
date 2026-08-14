# DSH Manager 开源前审查报告

> 审查日期：2026-08-14 ｜ 审查对象：`dsh-manager`（Chrome MV3 扩展 + Native Messaging 宿主 + dsh-lifecycle 插件）
> 审查依据：chrome-extensions skill（20 条强制规则 + 输出清单）、`docs/design.md` 安全模型、本机 `@deepseek-ai/dsh@0.1.0-rc.6` 发布源码逐条核验。
> 分工：4 个并行审查 subagent（扩展 / 宿主 / 开源就绪 / DSH 对齐），主代理交叉验证关键发现。
> 详细分报告：`.review/extension.md`、`.review/native-host.md`、`.review/opensource.md`、`.review/dsh-alignment.md`。

> ## ✅ 修复状态（2026-08-14 已执行）
> - 🔴-1/🔴-2：`<user>` 用户名/绝对路径全仓去个人化完成（`<user>`/`<repo-root>` 占位、tools 用 `__dirname`）；`.reg` 现场产物已删除并 gitignore。
> - 🔴-3：鲸鱼 logo **暂缓替换**（稍后处理）；已加 README 免责声明 + NOTICE 版权声明。
> - 🔴-4：`appExit` 语义已在插件 README/注释/design.md §7.3 校正。
> - 🔴-5：`sec-fetch-site` 围栏已补，并加 shutdown 幂等（409）；插件单测 21/21。
> - 🟠 修复：宿主测试钩子 `DSH_MANAGER_TEST_MODE=1` 门控、adopt 重放危险参数过滤、install.ps1 JSON 转义 + UTF-8、uninstall.ps1 PID 命令行校验、readRunRecord 结构校验；`<clipPath>` 大小写、manifest 权限最小化 + 双语 description、sendResponse catch；LICENSE(MIT)/NOTICE/CHANGELOG/CONTRIBUTING/SECURITY 已建；handover-prompt.md/m2-plan.md 已删；README/AGENTS/design 修订。
> - 修复后测试：冒烟 **94 PASS / 0 FAIL / 1 SKIP**（SKIP=环境限制）；插件单测 **21/21**；全量语法检查通过。
> - 未处理（记录在案）：SW 长超时 alarm 化（评估后不改——SW 回收时消息通道关闭、popup 侧天然收到 reject，且 alarm 无法恢复已丢失的调用上下文）；logo 替换（稍后）。
> - ✅ 外部网络核查已完成（2026-08-14）：npm `latest` = `0.1.0-rc.6`（无更高版本/正式版，事实基线成立）；GitHub 无 releases；根 LICENSE 逐字核对 = MIT, Copyright (c) 2026 DeepSeek；官方 docs/（capability-seams / web-styling / api-gateway 等）已核对，`ctx.web`/`ctx.webServer` 为文档化 seam/core；官方暂不接受外部 PR（M5 路线已调整）。详见 design.md §2 在线复核注记与 NOTICE。

## 0. 测试基线（审查时实跑）

| 项 | 结果 |
|----|------|
| 语法检查（host.js / background.js / popup.js / keygen.js / compute-id.js） | ✅ 全部通过 |
| 宿主冒烟测试 `native-host/test/smoke.js` | ✅ **93 PASS / 0 FAIL / 1 SKIP / 94**（SKIP 为沙箱拦截 taskkill，符合已知记录） |
| 插件单测 `node --test` | ⚠️ 本会话沙箱 spawn EPERM 无法复跑（DSH 文档化边界，非代码缺陷；真机记录 18/18 通过） |
| 安装脚本 `install.ps1 -DryRun` | ✅ 预演通过 |

## 1. 汇总统计

| 范围 | 🔴 阻断 | 🟠 重要 | 🟡 建议 |
|------|:---:|:---:|:---:|
| 扩展代码（`extension/`） | 0 | 2 | 5 |
| Native 宿主（`native-host/`） | 0 | 4 | 6 |
| 开源就绪 + 敏感信息（全仓库） | 3 | 6 | 8 |
| 插件 + DSH 官方对齐（`plugin/`） | 2 | 2 | 4 |
| **合计** | **5** | **14** | **23** |

**总体结论**：代码核心安全边界质量高——action/参数双白名单、子进程 100% 参数数组 spawn（无 shell 注入面）、popup 全部 `textContent` 注入（零 XSS）、Native Messaging 帧协议规范、adopt 双重匹配 + PID 复用防护、测试充分（冒烟 94 断言）。**未发现任何真实凭据泄露，也未发现可被远程（网页/其他扩展）触发的代码执行漏洞。** 5 个 🔴 全部是开源发布层面的阻断项（隐私、仓库卫生、品牌合规、上游语义），修复成本低。

## 2. 🔴 阻断发现（开源前必须处理）

### 🔴-1 本机 Windows 用户名以绝对路径硬编码（隐私泄露）
- **位置**：`docs/design.md:51,356,359`、`native-host/com.dsh.manager.reg:4,7`、`native-host/test/smoke.js:187,469,548`、`native-host/test/smoke-real.js:14,43`、`native-host/test/VERIFICATION.md:87`（共 5 文件 11 处，主代理 grep 复核）。
- **处理**：全部替换为 `<user>` 占位或 `%APPDATA%` 变量写法；测试桩路径改由已有环境钩子（`DSH_MANAGER_NPM_PREFIX` 等）注入。发布前全仓 grep 确认本机用户名清零（✅ 已完成）。

### 🔴-2 `native-host/com.dsh.manager.reg` 是含本机路径的现场生成产物
- 由 `install.ps1` 安装时导出（UTF-16），既泄露本机路径又无可再生成价值。
- **处理**：不入库（`.gitignore` 已加入 `native-host/com.dsh.manager.reg`）；文件本身可删除，install.ps1 现场生成即可。

### 🔴-3 鲸鱼 logo / brand-logo 为 DeepSeek 官方品牌资产的复制（商标风险）
- 证据链：`AGENTS.md` 自述「与 Web UI 同源的鲸鱼图形，从存档原样内联」；主代理对比本机 dsh 包 `@deepseek-ai/dsh-web-frontend/dist/favicon.svg` 与 `tools/icons/whale.svg` 的 path 数据结构同源（坐标缩放差异，曲线命令一致）。上游为 MIT 许可（版权复制允许），但**商标使用权不随 MIT 转移**。
- **处理（需你拍板，见 §5）**：① 换原创图标（最安全，CWS 审核也敏感）；② 保留但 README/NOTICE 声明版权归 DeepSeek、非官方产品；③ 发布前向 DeepSeek 确认授权。

### 🔴-4 插件对 `appExit(0)` 退出语义过度解读（进程可能不退出）
- 上游源码核验：`appExit(0)` → `shutdown.shutdown(0)`，dispose 成功后**只设 `process.exitCode`，不强制 `process.exit()`**，进程退出依赖事件循环自然排空。插件注释/README 声称「appExit → dispose 后退出」不精确。
- **实际影响可控**：宿主判定以「3s 内端口关闭」为权威，并有 taskkill 回退（已实现）。**处理**：校正 README/注释/design.md 措辞即可，不必改代码。

### 🔴-5 插件 HTTP 围栏缺失 `sec-fetch-site` 检查（与官方 `/api` 围栏不一致）
- 官方 `isTrustedApiRequest` 额外拒绝 `sec-fetch-site: cross-site`；插件只做了回环 + Host 正则 + Origin 同源。因 Host 已钉死回环，实际可利用性低，属一致性缺口。
- **处理**：`allow()` 补一行 `if (req.headers['sec-fetch-site'] === 'cross-site') return false`。

## 3. 🟠 重要发现摘要（14 项，详见分报告）

**Native 宿主（4）：**
1. 测试钩子环境变量（`DSH_BIN_STUB`、`DSH_MANAGER_FAKE_PROCESSES` 等）在生产路径「存在即生效」，未做发行剥离/门控——需本机环境控制能力才能利用，但建议加 `DSH_MANAGER_TEST_MODE=1` 开关。
2. `adopt` 接管重放路径绕过 extraArgs 白名单——参数源自可被本机伪造的进程表，建议对重放参数做危险项拒绝（`--trusted-host` 等）。
3. `install.ps1` 模板替换只做 `\→\\`，未做 JSON 转义——路径含 `"`/非 ASCII 时生成非法清单。
4. `uninstall.ps1` 信任 run 记录 pid 直接 taskkill，绕过 host.js 的 PID 复用防护——建议复用宿主校验或改走 host.js stop 动作。

**扩展（2）：**
5. `popup.html` 3 处 `<clippath>` 应为 `<clipPath>`（SVG 大小写敏感，跨引擎渲染风险）——主代理 grep 复核属实。
6. `background.js` Native 兜底 `setTimeout`（最长 120s）在 SW 休眠期理论不可靠——建议改 `chrome.alarms` 或加队列 watchdog。

**开源就绪（6）：**
7. 缺根级 LICENSE（推荐 MIT，与上游一致，已验证本机 dsh 包 license 为 MIT）。
8. 缺 `.gitignore`（已由本审查补建，见根目录）。
9. 根目录 `_audit.json` 与 `tools/visual-audit/_audit.json` 重复（220KB×2 衍生产物，已加入 .gitignore）。
10. 工具脚本硬编码本机绝对路径（`tools/visual-audit/*.js`、`tools/icons/_gen-icons.js`）——不可移植，建议改 `path.resolve(__dirname, …)`。
11. `docs/handover-prompt.md` 含会话内部工作过程信息（AI 接手指令、8080 会话服务、自我批评遗留），不宜原样公开。
12. `docs/m2-plan.md`、`AGENTS.md`、`VERIFICATION.md` 含 subagent 分工等内部工作流细节，需改写或去个人化。

**插件（2）：**
13. 并发 shutdown 无自身幂等保护（依赖上游 `pending` 合并这一未文档化行为），建议插件侧加去抖标志。
14. `package.json` 缺 `peerDependencies`（design.md §16 承诺过），建议声明 `"@deepseek-ai/dsh": ">=0.1.0-rc.6 <0.2.0"` 以在版本漂移时告警。

## 4. 🟡 建议摘要（23 项，代表性条目）

- `manifest.json` 的 `http://localhost/*` 冗余未使用，可移除（权限最小化）。
- `description` 无英文、未说明依赖本机 native host。
- background.js 少量 `.then()` 与 `.then(sendResponse)` 未捕获拒绝（风格/健壮性）。
- run 记录 `readRunRecord` 未校验 host/profile/extraArgs 结构（trust but verify）。
- 固定扩展 ID / manifest `key` 公钥：**可安全公开**（无私钥），保留有利于「clone 即用」；需在 README 说明商店发布将用商店 ID。
- README 缺「风险自担」声明（扩展会 taskkill 强杀进程）、路线图 M2 状态滞后（已完成但仍标「规划」）。
- 建议补 CHANGELOG / CONTRIBUTING / SECURITY。
- 插件 `.dsh\plugins` 目录是自创布局非官方约定，README 需澄清（`dsh.profile.bundles + dsh.bundle.patch` 双锚点才是官方机制）。
- 版本基线 rc.6：上游仍为 rc（API 未冻结），`webServer`/`appExit` 是**已文档化但未承诺语义化版本稳定**的扩展点——开源后需版本锁定 + feature detection + 定期重核验。

## 5. 需要你拍板的决策点

| # | 决策 | 选项 | 推荐 |
|---|------|------|------|
| 1 | LICENSE | MIT / Apache-2.0 / GPL | **MIT**（与上游一致，子插件已声明 MIT） |
| 2 | 鲸鱼 logo | 换原创图标 / 保留+NOTICE 声明 / 联系官方 | **换原创图标**（一劳永逸，CWS 审核敏感） |
| 3 | `handover-prompt.md`、`m2-plan.md` | 改写为 CONTRIBUTING / 移入私有 / 删除 | **改写 CONTRIBUTING + 删除 m2-plan** |
| 4 | 🔴-1 隐私替换 | 是否授权我执行本机用户名 → `<user>` 全局替换 | 建议授权（低风险纯文本替换） |
| 5 | 测试钩子门控（🟠-1） | 是否授权我加 `DSH_MANAGER_TEST_MODE=1` 开关 | 建议授权（改动小、收益明确） |

## 6. 修复优先级清单（建议顺序）

1. **隐私**：本机用户名 → `<user>` 全局替换 + 移除/忽略 `.reg`（🔴-1/2）
2. **品牌**：logo 决策 + README 免责声明 + NOTICE（🔴-3）
3. **许可证**：根目录 LICENSE（MIT）+ dsh 版权声明保留（🟠-7）
4. **插件语义**：`appExit` 措辞校正 + `sec-fetch-site` 围栏 + 幂等去抖 + peerDependencies（🔴-4/5、🟠-13/14）
5. **宿主加固**：测试钩子门控、adopt 重放过滤、uninstall PID 校验、install JSON 转义（🟠-1~4）
6. **扩展加固**：`<clipPath>` 大小写、SW 超时 alarm 化（🟠-5/6）
7. **文档**：README 风险声明/路线图同步、handover/m2-plan 改写、绝对路径去硬编码（🟠-10~12）

---

*本报告由主代理汇总并交叉验证 4 份 subagent 分报告而成；审查全程只读，未修改任何源文件（`.gitignore` 与 `.review/` 除外）。*
