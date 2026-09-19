# Which command-line options does this build's QCommandLineParser actually register?
# Oracle: launch with --<opt> and read the error MessageBox.
#   "Unknown option 'x'."        -> NOT registered
#   "Missing value after '--x'." -> registered, takes a value
#   (no dialog, app starts)      -> registered, boolean flag
param([string[]]$Opts,[int]$WaitSec = 11)
$EXE="C:\Users\mwgn-\AppData\Local\Programs\Amazon Web Services, Wickr\AWS Wickr\WickrPro.exe"
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class OS2 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode, EntryPoint="GetWindowTextW")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode, EntryPoint="GetClassNameW")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);

  public static uint TargetPid;
  public static List<string> Hits = new List<string>();
  static string Txt(IntPtr h){ var sb=new StringBuilder(1024); GetWindowText(h,sb,1024); return sb.ToString(); }
  static string Cls(IntPtr h){ var sb=new StringBuilder(256); GetClassName(h,sb,256); return sb.ToString(); }
  public static List<string> Scan(uint pid){
    TargetPid=pid; Hits.Clear();
    EnumWindows(delegate(IntPtr h, IntPtr l){
      uint q; GetWindowThreadProcessId(h, out q);
      if(q==TargetPid && IsWindowVisible(h)){
        string c=Cls(h);
        if(c=="#32770"){
          EnumChildWindows(h, delegate(IntPtr ch, IntPtr l2){
            string t=Txt(ch);
            if(!string.IsNullOrWhiteSpace(t)) Hits.Add("DIALOG: "+t);
            return true; }, IntPtr.Zero);
        } else { Hits.Add("WINDOW["+c+"]: "+Txt(h)); }
      }
      return true; }, IntPtr.Zero);
    return Hits;
  }
}
"@
foreach ($o in $Opts) {
  Get-CimInstance Win32_Process -Filter "Name='WickrPro.exe'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 800
  $p = Start-Process -FilePath $EXE -ArgumentList @("--$o") -PassThru
  Start-Sleep -Seconds $WaitSec
  $res = [OS2]::Scan([uint32]$p.Id)
  $verdict = "no dialog (started or still loading)"
  foreach ($r in $res) { if ($r -like "DIALOG:*") { $verdict = $r } }
  if ($res.Count -eq 0) { $verdict = "no visible window yet" }
  Write-Output ("  --{0,-22} => {1}" -f $o, $verdict)
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
Get-CimInstance Win32_Process -Filter "Name='WickrPro.exe' OR Name='crashpad_handler.exe'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
