# W17i — argument injection through the `wickrpro://` protocol handler

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Status:** all three links of the delivery **MEASURED**. The effect on WickrPro itself is **traced, not
executed** — see §5.

This resurrects the chain withdrawn in `W17g-arbitrary-url-webview-path.md`, by a different and shorter
route: instead of needing the `install-config/info` deep-link handler (which is unreachable on this
build), a web page hands **command-line options** to `WickrPro.exe`.

---

## 1. The registration

**VERIFIED (registry on this machine):**

```
HKCU\Software\Classes\wickrpro
    URL Protocol            (present)
    shell\open\command  =   "…\AWS Wickr\WickrPro.exe" "%1"
```

The template quotes `%1`. That is the standard shape, and it is what makes the substitution exploitable
rather than safe.

## 2. Link A — the browser preserves a quote and spaces, but only in one URL form

**MEASURED** (`scratchpad/urlser.html`, headless Chrome, `new URL(u).href`):

| input | serialised | `"` kept | space kept |
|---|---|---|---|
| `wickrpro://x/y" --clientType wickrEnterprise …` | `…%22%20--clientType%20…` | ✗ | ✗ |
| **`wickrpro:x" --clientType wickrEnterprise`** (no `//`) | **unchanged, verbatim** | **✓** | **✓** |
| in query / in fragment / with backslash | `%22` / `%20` | ✗ | ✗ |

Only the **opaque-path** form survives. This is the URL standard's own behaviour: a non-special scheme
with no authority goes to the *opaque path state*, which percent-encodes using the **C0 control**
percent-encode set — and neither U+0020 SPACE nor U+0022 QUOTATION MARK is in that set.

## 3. Link B — the shell's `%1` substitution is literal

**MEASURED** (`scratchpad/argecho.c` + `probe.ps1`). An **invented** scheme — `wickrargprobe` — was
registered under `HKCU` only, with the *same command shape* Wickr uses, fired, and the key removed in a
`finally` block. **Wickr's own association was never read, written or invoked**, and cleanup was
confirmed (`key still present = False`).

```
raw GetCommandLineW : "…\argecho.exe" "wickrargprobe:x" --clientType wickrEnterprise --baseURL http://127.0.0.1:9/"
  argv[0] = [ …\argecho.exe ]
  argv[1] = [ wickrargprobe:x ]
  argv[2] = [ --clientType ]
  argv[3] = [ wickrEnterprise ]
  argv[4] = [ --baseURL ]
  argv[5] = [ http://127.0.0.1:9/ ]

control, ordinary URL:
  argv[1] = [ wickrargprobe://register/?x=1 ]      <- single argument, as expected
```

## 4. Link C — the split is Windows' own

**MEASURED** independently (`scratchpad/argsplit.c`, `CommandLineToArgvW` on the constructed command
line) — same result, with no process started and nothing registered.

## 5. What the injected options do — and this part is TRACED, NOT EXECUTED

WickrPro's own option table, recovered from the binary, includes:

```
help | angle | headless | headlessport | ignorepath | logging | nocrypt | dbdump | vdump |
debugsyncingconvos | debugcontactbackup | auditmsgs | cdump | user | numUsers | usercaptest |
datalocation | filePath | configfile | noinstancecheck | disablekeychain |
baseURL | env/environment | clientType
```

with the descriptions:

* **`clientType`** — *"Specify client type (wickr, wickrGov, wickrGovADC, **wickrEnterprise**)"*
* **`baseURL`** — *"Sets baseURL of client to override internal settings"*
* `noinstancecheck` — *"Skips check to prevent multiple instances from running on device"*
* `datalocation`, `configfile`, `disablekeychain`, `logging`, `nocrypt`, `dbdump` …

**Why `clientType` matters:** `W17g` was withdrawn because the `install-config/info` deep-link matcher is
wired only on the `clientType == 2` branch (`0x140046b1c` / `0x140046b4d`), while this build runs
`clientType == 1`. The constructor writes that global at `0x1408d3c57` **before** argv is parsed at
`0x1408d3cbb call 0x1409d6500`, so `--clientType wickrEnterprise` would overwrite it.

**Why `baseURL` matters more:** it makes that irrelevant. The withdrawn chain needed the config deep link
*only* to take over the client's base URL, so that the relative `/getOpenIdConnectInfo.php` would be
answered by the attacker. **`--baseURL` sets it directly.**

> **NOT EXECUTED, and not claimed:** that WickrPro actually honours `--clientType` / `--baseURL` when they
> arrive this way, and what the client then does. The option table and the pre-argv write are read off the
> binary; **the end-to-end has not been run against the application.** Doing so means launching the
> operator's client with configuration-changing flags, which was deliberately not done.

## 6. Gates, stated plainly

1. **A user click.** Chrome shows its external-protocol confirmation before launching a custom-scheme
   handler. The victim must accept it. *(Observed behaviour of Chrome generally; not measured for this
   scheme specifically.)*
2. **The URL must use the opaque-path form** (`wickrpro:` with no `//`), which is what a user would see in
   the confirmation dialog.
3. **Single-instance behaviour is unknown** — if a running client absorbs the URL, no new process is
   started with the injected argv. `--noinstancecheck` is itself injectable, but whether that helps
   depends on which process handles the activation. Untested.

## 7. Remediation

The fix is on Wickr's side and is standard for this bug class: **do not pass the raw URL as a bare
command-line argument.** Either validate that argv[1] parses as a `wickrpro:` URL and ignore everything
after it, or reject any command line where a URL argument is followed by further options, or pass the URL
by another channel entirely. Separately, options like `--baseURL`, `--clientType`, `--datalocation`,
`--disablekeychain` and `--nocrypt` should not be honoured in a production build at all.

## 8. Relationship to other findings

* `W17g` — the chain withdrawn there is **restored by this route**, minus its longest link.
* This is **not** a chat-originated path (`W17h`); the entry point is a web page in the user's browser.
* No code execution is claimed anywhere here.
