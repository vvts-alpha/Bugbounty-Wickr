# Capture ONLY the given window's rectangle (not the whole desktop), so nothing
# unrelated on the operator's screen is recorded.
param([int[]]$Pids,[string]$Out)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public struct RECT { public int L,T,R,B; }
public class S {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet=CharSet.Unicode, EntryPoint="GetClassNameW")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
$target=[IntPtr]::Zero; $tcls=""
$cb=[S+EnumProc]{ param($h,$l)
  $q=0; [void][S]::GetWindowThreadProcessId($h,[ref]$q)
  if (($Pids -contains [int]$q) -and [S]::IsWindowVisible($h)) {
    $sb=New-Object System.Text.StringBuilder 256; [void][S]::GetClassName($h,$sb,256)
    if ($script:target -eq [IntPtr]::Zero) { $script:target=$h; $script:tcls=$sb.ToString() }
  }
  return $true }
[void][S]::EnumWindows($cb,[IntPtr]::Zero)
if ($target -eq [IntPtr]::Zero) { Write-Output "no visible window"; return }
$r = New-Object RECT
[void][S]::GetWindowRect($target,[ref]$r)
$w=$r.R-$r.L; $h2=$r.B-$r.T
Write-Output ("capturing hwnd=0x{0:x} class=[{1}] {2}x{3} at ({4},{5})" -f [int64]$target,$tcls,$w,$h2,$r.L,$r.T)
if ($w -le 0 -or $h2 -le 0) { Write-Output "degenerate rect"; return }
[void][S]::SetForegroundWindow($target); Start-Sleep -Milliseconds 700
$bmp = New-Object System.Drawing.Bitmap $w,$h2
$g = [System.Drawing.Graphics]::FromImage($bmp)
# copy from screen at the window's own rect only
$g.CopyFromScreen($r.L,$r.T,0,0,(New-Object System.Drawing.Size $w,$h2))
$g.Dispose(); $bmp.Save($Out,[System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
Write-Output "saved $Out"
