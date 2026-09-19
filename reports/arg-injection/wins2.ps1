# Enumerate top-level windows for given PIDs, and dump child-control text of any
# dialog found (so we can read what the app is showing the user).
param([int[]]$Pids)
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class W2 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode, EntryPoint="GetWindowTextW")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode, EntryPoint="GetClassNameW")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
function TextOf([IntPtr]$h) { $sb = New-Object System.Text.StringBuilder 1024; [void][W2]::GetWindowText($h,$sb,1024); $sb.ToString() }
function ClassOf([IntPtr]$h) { $sb = New-Object System.Text.StringBuilder 256; [void][W2]::GetClassName($h,$sb,256); $sb.ToString() }

$tops = New-Object System.Collections.ArrayList
$cb = [W2+EnumProc]{
  param($h,$l)
  $q = 0; [void][W2]::GetWindowThreadProcessId($h, [ref]$q)
  if ($Pids -contains [int]$q) { [void]$tops.Add($h) }
  return $true
}
[void][W2]::EnumWindows($cb,[IntPtr]::Zero)

if ($tops.Count -eq 0) { Write-Output "  (no top-level windows)"; return }
foreach ($h in $tops) {
  $cls = ClassOf $h; $txt = TextOf $h; $vis = [W2]::IsWindowVisible($h)
  Write-Output ("  hwnd=0x{0:x} visible={1} class=[{2}] title=[{3}]" -f [int64]$h,$vis,$cls,$txt)
  if ($vis) {
    $ccb = [W2+EnumProc]{
      param($c,$l)
      $ct = TextOf $c; $cc = ClassOf $c
      if ($ct) { Write-Output ("        child class=[{0}] text=[{1}]" -f $cc,$ct) }
      return $true
    }
    [void][W2]::EnumChildWindows($h,$ccb,[IntPtr]::Zero)
  }
}
