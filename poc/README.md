# W93 xcalc PoC — V8 renderer RCE (Chromium 130 / V8 13.0.245.25)

Authorized BBP research (HackerOne #3895069). Loopback / same-host only.
Target engine: `libQt6WebEngineCore.so.6.9.2` (Chromium 130.0.6723.192,
V8 13.0.245.25). OS sandbox OFF (`QTWEBENGINE_DISABLE_SANDBOX=1`), V8 sandbox ON.

## What this does

`server.py` hosts an HTTPS page that, when loaded by the Wickr renderer
(any Chromium-130 / QtWebEngine client on the same host), runs a 4-fire V8
type-confusion → confused-call arbitrary R/W → trusted-space walk to
`WasmDispatchTable entry[0].target` → 1-byte atomic redirect → execve shellcode
→ `execve("/usr/bin/xcalc", [path,NULL], ["DISPLAY=:0",NULL])`. DISPLAY is passed
via envp (the renderer env is scrubbed), so xcalc opens a window on WSLg.
Success = the renderer process's `/proc/<pid>/cmdline` becomes `/usr/bin/xcalc`.

The fire source is the page JS (confused-call primitive). The server only serves
the page and reads the renderer's `/proc` READ-ONLY to supply ASLR candidates
(`/addrs`, `/tptcheck`, `/memcheck`) — W67/W68 convention. **No ptrace, no
`/proc/mem` writes, no lab-side GOT/code overwrite.**

## Files

| file | role |
|---|---|
| `server.py` | HTTPS server + `/log` dashboard (run this) |
| `fire_xcalc.py` | exploit page builder + H class + /proc helpers (imported by server.py) |
| `poc_wlinux.py` | frozen 4-fire V8 chain (`make_page`) |

## Setup (one-time)

```bash
# 1. xcalc binary (if not present)
ls /usr/bin/xcalc || sudo apt install -y x11-apps

# 2. /etc/hosts (so Wickr resolves the domain to local)
echo "127.0.0.1 main.d4zeeqgazhley.amplifyapp.com" | sudo tee -a /etc/hosts

# 3. python deps (cryptography for the self-signed cert)
/home/veritas/wickr-poc/.venv/bin/pip install cryptography   # or: pip3 install cryptography
```

## Run

```bash
cd /mnt/c/project/wickr/poc   # (or wherever you placed the dir)
/home/veritas/wickr-poc/.venv/bin/python server.py 9443
# args: [PORT=9443] [DOMAIN=main.d4zeeqgazhley.amplifyapp.com]
```

Then:
- **your browser** → `https://main.d4zeeqgazhley.amplifyapp.com:9443/log`
  (dashboard, auto-refresh; accept the self-signed cert warning)
- **real Wickr app** → `https://main.d4zeeqgazhley.amplifyapp.com:9443/`
  (loads the exploit page → fires on a successful MEMBI-OK attempt)

Watch the dashboard / stdout for `CAGE → MEMBI-OK → W92-WALK → W93-XSC →
W93-XCALC-FIRE`, then `/tmp/wickr_rce_proof.txt` appears → **XCALC ACHIEVED**.

## Notes / limits

- **Same host required.** The server reads the Wickr renderer's `/proc`; it must
  run on the same WSL2 machine as Wickr. (Remote `/proc` access is not possible;
  full page-side ASLR defeat is future work.)
- **MEMBI-OK ~15–30% per page load.** The page auto-reloads and retries; keep it
  open. A 0/15 run happens occasionally — just let it keep trying.
- **Self-signed cert.** If Wickr rejects it, install the cert into Wickr's trust
  store or use a domain/CA Wickr trusts.
- **OS sandbox.** nonce EXEC-OK (memory write) fires regardless; the xcalc
  (execve) requires OS sandbox OFF. This PoC's scope is sandbox OFF.
- **Nonce EXEC-OK variant:** swap `import fire_xcalc as F` → `import fire as F`
  in server.py and copy `fire.py` (from `scratch/w92/`) next to it, to serve the
  nonce-proof page instead (renderer survives, beacon `0x13371339`).

## Evidence (from the dev runs)

- nonce EXEC-OK: `scratch/w92/` run 9408 att8 — `nonce=0x13371339`, live
  retaddr + frameptr, read back by page JS + lab `/proc/mem`.
- xcalc: `scratch/w92/` run 9412 att5 — `/tmp/wickr_rce_proof.txt`
  `WICKR-RCE-PROOF pid=8579 ppid=8578` (wrapper written by the page-fired
  execve), then `/usr/bin/xcalc`.
