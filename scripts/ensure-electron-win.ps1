# Repairs Electron install when npm's extract-zip leaves a partial dist/ on Windows.
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$electronDir = Join-Path $projectRoot "node_modules\electron"
$distDir = Join-Path $electronDir "dist"
$electronExe = Join-Path $distDir "electron.exe"

if (Test-Path $electronExe) {
    exit 0
}

$version = (Get-Content (Join-Path $electronDir "package.json") | ConvertFrom-Json).version
$cacheRoot = Join-Path $env:LOCALAPPDATA "electron\Cache"
$zip = Get-ChildItem -Path $cacheRoot -Recurse -Filter "electron-v$version-win32-x64.zip" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $zip) {
    Write-Error "Electron zip not found in cache. Run: node node_modules/electron/install.js"
}

Remove-Item -Recurse -Force $distDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
Expand-Archive -Path $zip.FullName -DestinationPath $distDir -Force
Set-Content -Path (Join-Path $electronDir "path.txt") -Value "electron.exe" -NoNewline
Set-Content -Path (Join-Path $distDir "version") -Value "v$version" -NoNewline
Write-Host "Electron repaired at $electronExe"
