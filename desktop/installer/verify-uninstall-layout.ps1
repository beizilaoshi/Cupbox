# Use a separate test AppId and an isolated workspace fixture, never a real install.
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskBase=[IO.Path]::GetFullPath((Join-Path $taskRoot 'output/uninstall-layout-test'))
$taskTarget=[IO.Path]::GetFullPath((Join-Path $taskBase 'Cupbox'))
if(-not $taskTarget.StartsWith($taskBase+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe fixture target'}
$taskRegistry='HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/{B9851FE8-90EF-4CB5-A3B2-532FD534AE8F}_is1'
if(Test-Path $taskRegistry){$entry=Get-ItemProperty $taskRegistry;if($entry.InstallLocation.TrimEnd('\') -ne $taskTarget){throw 'Another layout fixture exists; do not overwrite it'}}
& (Join-Path $taskRoot 'output/installer-tools/InnoSetup/ISCC.exe') /DAppVersion=1.2.0 /DInstallerTest /DInstallerUIReview (Join-Path $PSScriptRoot 'cupbox.iss')
if($LASTEXITCODE -ne 0){throw 'Layout fixture compile failed'}
$taskData=Join-Path $taskBase 'data/.cupbox/sessions';[IO.Directory]::CreateDirectory($taskData)|Out-Null
$taskKeep=Join-Path $taskData 'keep.json';[IO.File]::WriteAllText($taskKeep,'{"text":"layout-test-memory"}')
$taskHash=(Get-FileHash -LiteralPath $taskKeep).Hash
$taskPreviousHome=$env:CUPBOX_HOME
try {
 $env:CUPBOX_HOME=Join-Path $taskBase 'data'
 $taskSetup=Start-Process -FilePath (Join-Path $taskRoot 'output/installer-review/Cupbox-UI-Review.exe') -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOICONS','/TASKS=""',('/DIR="'+$taskTarget+'"')) -WindowStyle Hidden -Wait -PassThru
 if($taskSetup.ExitCode -ne 0){throw 'Layout fixture install failed'}
 $taskLog=Join-Path $taskBase 'uninstall.log'
 $taskUninstall=Start-Process -FilePath (Join-Path $taskTarget 'unins000.exe') -ArgumentList @('/SILENT','/SUPPRESSMSGBOXES','/NORESTART','/CUPBOXUI=1','/CUPBOXREVIEW=layout',('/LOG="'+$taskLog+'"')) -WindowStyle Hidden -Wait -PassThru
 if($taskUninstall.ExitCode -ne 0){throw 'Branded uninstall layout failed'}
 $taskLayout=(Get-Content -LiteralPath $taskLog | Select-String 'CUPBOX_UNINSTALL_LAYOUT' | Select-Object -Last 1).Line
 if(-not $taskLayout){throw 'Missing runtime geometry'}
 $taskValues=@{};foreach($taskMatch in [regex]::Matches($taskLayout,'(pageHeight|progressLeft|progressTop|progressWidth|progressHeight|artLeft|artTop|artWidth|artHeight|textTop)=(\d+)')){$taskValues[$taskMatch.Groups[1].Value]=[int]$taskMatch.Groups[2].Value}
 if($taskValues.progressLeft -le $taskValues.artLeft+$taskValues.artWidth){throw 'Progress overlaps illustration'}
 if($taskValues.progressTop+$taskValues.progressHeight -ge $taskValues.textTop){throw 'Progress overlaps explanatory text'}
 if($taskValues.artTop+$taskValues.artHeight -gt $taskValues.pageHeight){throw 'Illustration leaves content area'}
 if((Get-FileHash -LiteralPath $taskKeep).Hash -ne $taskHash){throw 'User data changed'}
 if(Test-Path $taskRegistry){throw 'Fixture registration remains'}
 Write-Output 'PASS real branded uninstall: progress, text and artwork have separate bounds'
 Write-Output 'PASS uninstall completes and preserves isolated user memory'
 Write-Output $taskLayout
} finally {$env:CUPBOX_HOME=$taskPreviousHome}
