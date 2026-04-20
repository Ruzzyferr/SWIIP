# Compiles AppLoopbackEx.cpp into apps/desktop/bin/win32-x64/AppLoopbackEx.exe.
#
# Requires Visual Studio 2022 Build Tools with "Desktop development with C++"
# workload + Windows 10/11 SDK. Locates MSVC via vswhere, then invokes cl.exe
# inside a temporary batch that runs vcvars64.bat (because vcvars mutates a
# lot of env vars and is easier to delegate to cmd than to reimplement).
#
# Usage:
#   pwsh apps/desktop/native/app-loopback-ex/build.ps1
#   pwsh apps/desktop/native/app-loopback-ex/build.ps1 -Clean

param(
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Resolve-Path (Join-Path $scriptRoot "..\..\..\..")
$outDir     = Join-Path $repoRoot "apps\desktop\bin\win32-x64"
$outExe     = Join-Path $outDir "AppLoopbackEx.exe"
$src        = Join-Path $scriptRoot "AppLoopbackEx.cpp"

if ($Clean) {
  if (Test-Path $outExe) { Remove-Item $outExe -Force }
  Get-ChildItem -Path $scriptRoot -Filter "*.obj" -ErrorAction SilentlyContinue | Remove-Item -Force
  Write-Host "Cleaned." -ForegroundColor Green
  exit 0
}

if (-not (Test-Path $src)) {
  Write-Error "Source not found: $src"
  exit 1
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
  Write-Error @"
vswhere.exe not found at: $vswhere

Install 'Visual Studio 2022 Build Tools' with the 'Desktop development with C++'
workload + a Windows 10/11 SDK. From an elevated prompt:

  winget install --id Microsoft.VisualStudio.2022.BuildTools --override \
    "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools \
     --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended"
"@
  exit 1
}

$vsInstall = & $vswhere -latest -products * `
  -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  -property installationPath
if (-not $vsInstall) {
  Write-Error "No Visual Studio install found with the x86/x64 MSVC tools component."
  exit 1
}

$vcvars = Join-Path $vsInstall "VC\Auxiliary\Build\vcvars64.bat"
if (-not (Test-Path $vcvars)) {
  Write-Error "vcvars64.bat not found at: $vcvars"
  exit 1
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$objDir = Join-Path $scriptRoot ".obj"
New-Item -ItemType Directory -Force -Path $objDir | Out-Null

$cmdFile = [System.IO.Path]::GetTempFileName()
Rename-Item -Path $cmdFile -NewName ($cmdFile + ".bat") | Out-Null
$cmdFile = $cmdFile + ".bat"

$batch = @"
@echo off
call "$vcvars" >nul
if errorlevel 1 exit /b %errorlevel%
cl /nologo /std:c++17 /EHsc /W3 /O2 /MT ^
   /DWIN32_LEAN_AND_MEAN /D_UNICODE /DUNICODE ^
   /Fo"$objDir\\" ^
   "$src" ^
   /link /OUT:"$outExe" /SUBSYSTEM:CONSOLE
exit /b %errorlevel%
"@

Set-Content -Path $cmdFile -Value $batch -Encoding ASCII

try {
  & cmd /c $cmdFile
  $exit = $LASTEXITCODE
} finally {
  Remove-Item $cmdFile -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $objDir -ErrorAction SilentlyContinue
}

if ($exit -ne 0) {
  Write-Error "Compilation failed (exit=$exit)"
  exit $exit
}

Write-Host "Built: $outExe" -ForegroundColor Green
