<#
.SYNOPSIS
    DSH Manager — 重建发布副本（tools/publish/build-publish.ps1）

.DESCRIPTION
    按「另起新仓、单提交发布」方案（docs/publish.md）重建发布目录：
      1. 从开发仓库 HEAD 导出干净快照（git archive，仅入库文件）；
      2. 用 tools/publish/release-changelog.md 覆盖发布物的 CHANGELOG.md
         （发布物只带面向使用者的正式版本条目，开发流水账留在开发仓库）；
      3. 在发布目录 git init + 单提交（v<版本>）。
    不推送任何远程；推送步骤见 docs/publish.md。

.PARAMETER PublishDir
    发布目录（默认仓库同级的 dsh-manager-publish）。

.PARAMETER Version
    版本号（默认 0.1.0），写入提交信息。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\publish\build-publish.ps1
#>
[CmdletBinding()]
param(
    [string]$PublishDir,
    [string]$Version = '0.1.0'
)

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $PublishDir) {
    $PublishDir = Join-Path (Split-Path -Parent $repoRoot) 'dsh-manager-publish'
}

Write-Host ('开发仓库：' + $repoRoot)
Write-Host ('发布目录：' + $PublishDir)
Write-Host ('版本：' + $Version)

Push-Location $repoRoot
try {
    if (Test-Path $PublishDir) {
        Remove-Item $PublishDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $PublishDir | Out-Null

    Write-Host '1/3 导出干净快照（git archive HEAD）...'
    git archive HEAD | tar -x -C $PublishDir

    Write-Host '2/3 替换为发布版 CHANGELOG...'
    Copy-Item (Join-Path $PSScriptRoot 'release-changelog.md') (Join-Path $PublishDir 'CHANGELOG.md') -Force

    Write-Host '3/3 初始化发布仓库并单提交...'
    Push-Location $PublishDir
    try {
        git init -b main | Out-Null
        git add -A
        git -c user.name='DSH Manager' -c user.email='dsh-manager@local' commit -m ('v' + $Version + '：浏览器一键管理 dsh web（Chrome MV3 扩展 + Native Messaging 宿主 + dsh-lifecycle 插件）') | Out-Null
        $fileCount = (git ls-files).Count
        $commitCount = (git log --oneline | Measure-Object -Line).Lines
        Write-Host ('完成：' + $fileCount + ' 个文件 / ' + $commitCount + ' 条提交')
        Write-Host '推送前自查见 docs/publish.md（冒烟/verify-cdp/敏感文件检查）。'
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
