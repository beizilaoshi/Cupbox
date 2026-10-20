# End-to-end packaging checks. Run on Windows outside the process sandbox.
# Only install into this workspace's output tree. Never use real Cupbox data.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$testRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'output\installer-test'))
$installedRoot = [IO.Path]::GetFullPath((Join-Path $testRoot '含 空格\Cupbox'))
if (-not $installedRoot.StartsWith($testRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid test path' }
$regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{DC8B23F6-11C4-44D2-8E7B-8D84125039AB}_is1'
if (Test-Path $regPath) {
  $existing = Get-ItemProperty -LiteralPath $regPath
  if ($existing.InstallLocation.TrimEnd('\') -ne $installedRoot) { throw 'A real installation exists; do not replace it for testing.' }
}
$compilerFile = $env:ISCC_PATH
if (-not $compilerFile) { $compilerFile = Join-Path $projectRoot 'output\installer-tools\InnoSetup\ISCC.exe' }
& $compilerFile '/DAppVersion=1.0.2' '/DInstallerTest' (Join-Path $PSScriptRoot 'cupbox.iss')
if ($LASTEXITCODE -ne 0) { throw 'Test installer compile failed' }
$setupFile = Join-Path $projectRoot 'output\installer-review\Cupbox-Setup-1.0.2-x64-test.exe'
$testHome = Join-Path $testRoot 'data'
$dataDir = Join-Path $testHome '.cupbox'
New-Item -ItemType Directory -Force $dataDir,(Join-Path $dataDir 'sessions') | Out-Null
$config = Join-Path $dataDir 'config.json'
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($config, '{"provider":"openai-compatible","preset":"custom","model":"installer-preserve-test","baseUrl":"http://127.0.0.1:9/v1","apiKey":"test-only-not-real"}', $utf8)
[IO.File]::WriteAllText((Join-Path $dataDir 'desktop.json'), '{"theme":"dark","startupEnabled":false}', $utf8)
[IO.File]::WriteAllText((Join-Path $dataDir 'sessions\keep.json'), '{"text":"keep-test-history"}', $utf8)
$before = (Get-FileHash -LiteralPath $config).Hash
$oldHome = $env:CUPBOX_HOME
$oldUpdate = $env:CUPBOX_UPDATE_DISABLE
$oldInstalled = $env:CUPBOX_INSTALL_TEST_ROOT
function Invoke-TestInstall($logName) {
  $logFile = Join-Path $testRoot $logName
  $arguments = @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOCLOSEAPPLICATIONS','/NOICONS','/TASKS=""',('/DIR="' + $installedRoot + '"'),('/LOG="' + $logFile + '"'))
  $installerProcess = Start-Process -FilePath $setupFile -ArgumentList $arguments -PassThru -Wait -WindowStyle Hidden
  if ($installerProcess.ExitCode -ne 0) { throw "Installer exited $($installerProcess.ExitCode); see $logFile" }
}
try {
  $env:CUPBOX_HOME = $testHome
  $env:CUPBOX_UPDATE_DISABLE = '1'
  $env:CUPBOX_INSTALL_TEST_ROOT = $installedRoot
  Invoke-TestInstall 'install.log'
  if (-not (Test-Path -LiteralPath (Join-Path $installedRoot 'Cupbox可视化.exe'))) { throw 'Application missing' }
  Write-Output 'PASS offline installation into a Unicode path containing spaces'
  $installedMetadata = Get-Content -LiteralPath (Join-Path $installedRoot 'resources\app\package.json') -Raw | ConvertFrom-Json
  if ($installedMetadata.version -ne '1.0.2') { throw 'Version mismatch' }
  $entry = Get-ItemProperty -LiteralPath $regPath
  if ($entry.DisplayVersion -ne '1.0.2' -or $entry.InstallLocation.TrimEnd('\') -ne $installedRoot) { throw 'Uninstall registration mismatch' }
  Write-Output 'PASS per-user uninstall registration and version 1.0.2'
  if ((Get-FileHash -LiteralPath $config).Hash -ne $before) { throw 'Install changed configuration' }
  $note = Join-Path $installedRoot 'user-note.txt'
  Set-Content -LiteralPath $note -Value 'not owned by installer'
  Invoke-TestInstall 'upgrade.log'
  if ((Get-FileHash -LiteralPath $config).Hash -ne $before -or -not (Test-Path -LiteralPath $note)) { throw 'Upgrade removed user files' }
  Write-Output 'PASS same-version upgrade preserves configuration and extra user files'
  $uiLog = Join-Path $testRoot 'installed-ui.log'
  $uiErr = Join-Path $testRoot 'installed-ui.err'
  $electronFile = Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'
  $runner = Join-Path $PSScriptRoot 'verify-installed.mjs'
  $uiProcess = Start-Process -FilePath $electronFile -ArgumentList ('"' + $runner + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $uiLog -RedirectStandardError $uiErr
  if (-not $uiProcess.WaitForExit(45000)) { $uiProcess.Kill(); throw 'Installed UI check timed out' }
  Get-Content -LiteralPath $uiLog
  if ($uiProcess.ExitCode -ne 0) { Get-Content -LiteralPath $uiErr; throw 'Installed UI failed' }
  $uninstaller = Join-Path $installedRoot 'unins000.exe'
  if (-not [IO.Path]::GetFullPath($uninstaller).StartsWith($testRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe uninstall path' }
  $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG="' + (Join-Path $testRoot 'uninstall.log') + '"') -WindowStyle Hidden -Wait -PassThru
  if ($uninstallProcess.ExitCode -ne 0) { throw 'Uninstall failed' }
  if (Test-Path -LiteralPath (Join-Path $installedRoot 'Cupbox可视化.exe')) { throw 'Program remained after uninstall' }
  if (Test-Path $regPath) { throw 'Uninstall registration remained' }
  if ((Get-FileHash -LiteralPath $config).Hash -ne $before -or -not (Test-Path -LiteralPath (Join-Path $dataDir 'sessions\keep.json')) -or -not (Test-Path -LiteralPath $note)) { throw 'Uninstall removed user data' }
  Write-Output 'PASS uninstall removes program and registration while preserving user data'
} finally {
  $env:CUPBOX_HOME = $oldHome
  $env:CUPBOX_UPDATE_DISABLE = $oldUpdate
  $env:CUPBOX_INSTALL_TEST_ROOT = $oldInstalled
}
