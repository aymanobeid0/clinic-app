param(
  [ValidateSet('status','plan','check','stop','helper')][string]$Action = 'status',
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$HelperArgs
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$env:PYTHONUTF8 = '1'
$env:Path = "$PSScriptRoot\runtime;C:\Program Files\Git\bin;C:\Program Files\Git\usr\bin;" + [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$bash = 'C:\Program Files\Git\bin\bash.exe'
if (!(Test-Path $bash)) { throw 'Install Git for Windows with Git Bash first.' }
$config = '.claude/super-board/configs/clinic-mvp.json'
switch ($Action) {
  'helper' { if (!$HelperArgs -or $HelperArgs[0] -notmatch '^\.claude/bin/super-[a-z-]+\.sh$') { throw 'Pass a .claude/bin/super-*.sh helper path.' }; & $bash @HelperArgs }
  'status' { python .claude/bin/super-board-status.py clinic-mvp }
  'plan' { & $bash .claude/bin/super-board-wave-plan.sh --config $config }
  'check' { python scripts/check-board.py }
  'stop' { & $bash .claude/bin/super-board-stop.sh --config $config }
}
exit $LASTEXITCODE
