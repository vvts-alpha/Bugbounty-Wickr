# W37: fire a wickrpro: URL through ShellExecute -- the same call a browser makes
# after the user accepts the external-protocol dialog.
param(
  [Parameter(Mandatory=$true)][string]$Url,
  [int]$WaitSec = 35,
  [switch]$LeaveRunning
)
$ErrorActionPreference = 'Continue'

function Tree { Get-CimInstance Win32_Process -Filter "Name='WickrPro.exe' OR Name='QtWebEngineProcess.exe' OR Name='marker.exe'" |
                Select-Object ProcessId,ParentProcessId,Name,CommandLine }

Write-Output "URL fired: $Url"
$pre = @(Tree)
Write-Output "PRE: $($pre.Count) WickrPro-related process(es)"
foreach ($p in $pre) { Write-Output ("  pre pid={0} {1}" -f $p.ProcessId,$p.Name) }
$prePids = @($pre | ForEach-Object { $_.ProcessId })

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $Url
$psi.UseShellExecute = $true
try { [System.Diagnostics.Process]::Start($psi) | Out-Null; Write-Output "ShellExecute returned OK" }
catch { Write-Output "ShellExecute THREW: $($_.Exception.Message)" }

Start-Sleep -Seconds $WaitSec

Write-Output "--- process tree after ${WaitSec}s ---"
$post = @(Tree)
if ($post.Count -eq 0) { Write-Output "  (nothing running)" }
foreach ($p in $post) {
  $new = if ($prePids -contains $p.ProcessId) { "existing" } else { "*** NEW ***" }
  Write-Output ("  pid={0} ppid={1} {2}  {3}" -f $p.ProcessId,$p.ParentProcessId,$p.Name,$new)
  Write-Output ("      cmdline: {0}" -f $p.CommandLine)
}

if (-not $LeaveRunning) {
  Write-Output "--- cleanup (only processes this script did not find at PRE) ---"
  foreach ($p in @(Tree)) {
    if ($prePids -notcontains $p.ProcessId) {
      try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Write-Output "  stopped pid=$($p.ProcessId)" } catch {}
    }
  }
}
Write-Output ""
