# W37 trial harness.
# Launches ONE fresh WickrPro.exe with chosen argv, records the resulting
# process tree and any marker hits, then terminates only what it started.
param(
  [Parameter(Mandatory=$true)][string]$Tag,
  [string[]]$AppArgs = @(),
  [int]$WaitSec = 18
)

$ErrorActionPreference = 'Continue'
$SP  = "C:\Users\mwgn-\AppData\Local\Temp\claude\E--tmp-wickr\9b5edbf0-7902-44a0-b52a-1ae0537df861\scratchpad"
$EXE = "C:\Users\mwgn-\AppData\Local\Programs\Amazon Web Services, Wickr\AWS Wickr\WickrPro.exe"
$LOG = "$SP\marker.log"

function Tree { Get-CimInstance Win32_Process -Filter "Name='WickrPro.exe' OR Name='QtWebEngineProcess.exe' OR Name='marker.exe' OR Name='crashpad_handler.exe'" |
                Select-Object ProcessId,ParentProcessId,Name,CommandLine }

Write-Output "=========== TRIAL: $Tag ==========="
Write-Output "argv: $($AppArgs -join ' | ')"

$pre = @(Tree)
Write-Output "PRE  : $($pre.Count) related process(es) running"
if ($pre.Count -gt 0) { $pre | ForEach-Object { Write-Output ("  pre pid={0} {1}" -f $_.ProcessId,$_.Name) } }

$markerBefore = 0
if (Test-Path $LOG) { $markerBefore = (Get-Content $LOG | Measure-Object -Line).Lines }

if ($AppArgs.Count -gt 0) { $proc = Start-Process -FilePath $EXE -ArgumentList $AppArgs -PassThru }
else                      { $proc = Start-Process -FilePath $EXE -PassThru }
Write-Output "LAUNCHED pid=$($proc.Id)"
Start-Sleep -Seconds $WaitSec

Write-Output "--- process tree after ${WaitSec}s ---"
$post = @(Tree)
foreach ($p in $post) {
  $cl = $p.CommandLine
  if ($cl -and $cl.Length -gt 400) { $cl = $cl.Substring(0,400) + " ...<trunc>" }
  Write-Output ("  pid={0} ppid={1} {2}" -f $p.ProcessId,$p.ParentProcessId,$p.Name)
  Write-Output ("      {0}" -f $cl)
}
Write-Output ("  (exited already? launched pid alive = {0})" -f (-not $proc.HasExited))

Write-Output "--- marker.log delta ---"
$markerAfter = 0
if (Test-Path $LOG) { $markerAfter = (Get-Content $LOG | Measure-Object -Line).Lines }
if ($markerAfter -gt $markerBefore) {
  Write-Output "  *** MARKER FIRED: $($markerAfter - $markerBefore) new line(s) ***"
  Get-Content $LOG | Select-Object -Last ($markerAfter - $markerBefore) | ForEach-Object { Write-Output "  $_" }
} else {
  Write-Output "  (no new marker lines)"
}

Write-Output "--- cleanup ---"
$prePids = $pre | ForEach-Object { $_.ProcessId }
foreach ($p in @(Tree)) {
  if ($prePids -notcontains $p.ProcessId) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Write-Output "  stopped pid=$($p.ProcessId) $($p.Name)" }
    catch { Write-Output "  (pid=$($p.ProcessId) already gone)" }
  }
}
Start-Sleep -Seconds 2
Write-Output "POST : $(@(Tree).Count) related process(es) remain"
Write-Output ""
