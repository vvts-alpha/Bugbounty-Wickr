// W37 marker binary.
// Proves that a child process was actually spawned, AND records the exact argv
// the parent handed it.  Appends one line to marker.log and exits immediately.
// It does nothing else: no network, no file writes outside its own log.
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

class Marker
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr GetCommandLineW();

    const string LOG = @"C:\Users\mwgn-\AppData\Local\Temp\claude\E--tmp-wickr\9b5edbf0-7902-44a0-b52a-1ae0537df861\scratchpad\marker.log";

    static int ParentPid()
    {
        try
        {
            var q = new System.Management.ManagementObjectSearcher(
                "SELECT ParentProcessId FROM Win32_Process WHERE ProcessId=" +
                Process.GetCurrentProcess().Id);
            foreach (var o in q.Get())
                return Convert.ToInt32(o["ParentProcessId"]);
        }
        catch { }
        return -1;
    }

    static void Main()
    {
        string raw = Marshal.PtrToStringUni(GetCommandLineW());
        string line = string.Format(
            "{0:yyyy-MM-dd HH:mm:ss.fff}  MARKER-EXECUTED  pid={1} ppid={2}\n    rawcmdline: {3}\n",
            DateTime.Now, Process.GetCurrentProcess().Id, ParentPid(), raw);

        // several children may land at once; retry briefly on sharing violations
        for (int i = 0; i < 40; i++)
        {
            try
            {
                using (var fs = new FileStream(LOG, FileMode.Append, FileAccess.Write, FileShare.ReadWrite))
                using (var sw = new StreamWriter(fs))
                    sw.Write(line);
                break;
            }
            catch (IOException) { Thread.Sleep(25); }
        }
    }
}
