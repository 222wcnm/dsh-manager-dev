# tools/linux — WSL Linux 验证（M4）

`verify-linux.ps1`：在 WSL 发行版（默认 **kali-linux**）内实测 host.js 的 POSIX 平台层
（design §6.8）——`~/.config` 状态目录、SIGTERM→SIGKILL 终止、/proc 进程枚举与
端口表、/proc PID 校验。脚本在发行版用户目录准备**便携 Node**（官方 linux-x64
tarball，免 sudo/apt），以 Linux Node 直接运行仓库的 `native-host/test/smoke.js`
（仓库经 `/mnt/<盘>/` 挂载，`.smoke` 产物落仓库工作区，gitignore 已覆盖）。

Linux 下冒烟**不设进程枚举围栏**：smoke 场景 26 不注入任何 fake 钩子，以真实
/proc 枚举 + /proc/net/tcp 端口表 + /proc PID 校验 + HTTP 指纹完成外部实例
发现/接管/停止全链路（Windows 该场景记 SKIP，围栏仅 Windows 使用——本机常驻
真实 dsh web 会干扰「空目录→stopped」场景）。

## 用法

```powershell
# 首次：安装 WSL 发行版（一次性，数百 MB 下载）
wsl --install -d kali-linux --no-launch

# 运行验证（自动准备 Node + 跑完整冒烟）
powershell -ExecutionPolicy Bypass -File tools\linux\verify-linux.ps1
```

参数：`-Distro`（默认 kali-linux）、`-NodeVersion`（默认 22.16.0）。

## 说明

- 仅验证宿主（POSIX 进程/网络/终止路径）；浏览器扩展（native messaging 注册、
  popup 等）仍以 Windows 侧 verify-cdp.js 覆盖，Linux 桌面浏览器的宿主注册
  （`~/.config/google-chrome/NativeMessagingHosts/` 等）未实测。
- macOS 仍无验证环境（无 macOS 设备）：其 `ps`/`lsof` 分支代码已写但未实测，
  设计文档如实标注。
