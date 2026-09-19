# W18 — the third-party `frame-src` origin, and whether it (or the bridge) reaches code execution

**Question this wave was set:** with `https://main.d4zeeqgazhley.amplifyapp.com/` treated as
attacker-controlled (operator states it is compromisable via React2Shell), so that
`<iframe src=…>` yields arbitrary JS inside the Wickr window — **does a peer-originated RCE path
remain?**

**Answer: no demonstrated one, and the most direct hypothesis is now measured and dead.**
Two new positives (F21, F23) and two hard negatives (F19, F22) below. Everything marked MEASURED was
run against the shipped binaries on this host; nothing was sent to any Wickr service or account.

Artifacts: `scratch/w18/` — `framebridge.c` (drives the shipped Qt6WebEngineQuick + Qt6WebChannel),
`wcsrv.py` (two loopback origins + the probe script), `moc.py`/`moc2.py` (Qt6 moc metaobject →
`qt_static_metacall` jump-table resolver, reusable for any shipped Qt binary),
`wc-hits-transport.log`, `wc-hits-grant.log`.

---

## §1 The premise checks out: the third-party origin is framable in the BRIDGE-BEARING document

Both qrc HTML documents carry the same CSP (`scratch/w16/qrc/blob_00e46f48.html` = file-preview,
`blob_00e568b7.html` = the main app, the one that loads `qrc:///qtwebchannel/qwebchannel.js`):

```
default-src 'self' qrc://* wickrweb://* ; style-src 'self' 'unsafe-inline' ;
script-src  'self' qrc://* ;
frame-src   'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ;
worker-src 'self' blob: ; child-src 'self' blob: ; object-src 'self'
```

So an HTML injection that cannot run inline script (F11 display name → `bindPopup`→`innerHTML`;
the reported docx `altChunk`→`srcdoc`) **can still emit an `<iframe>` tag**, and that frame executes
the third party's JS under the third party's own CSP. `<iframe srcdoc>` inherits the parent CSP and
is therefore useless to the attacker; `blob:` needs script to mint a URL; `javascript:` is blocked —
**the allow-listed third-party origin is the only script-execution primitive available from pure
HTML injection, and it is allow-listed in both frames.**

Not hypothetical: the product itself frames that origin in the main window —
`src/components/Modals/CheckSpeed/index.tsx:29`,
`src={customTest ? 'https://main.d4zeeqgazhley.amplifyapp.com/' : 'https://fast.com'}`
(the "Custom speed test" toggle of the Check Speed modal).

---

## §2 F19 — MEASURED NEGATIVE: the bridge is **not** exposed to cross-origin subframes

The obvious hypothesis was that Qt installs `qt.webChannelTransport` in every frame of a
`webChannel`-bearing page (Qt's `WebChannelIPCTransportHost` observes the whole `WebContents`), which
would hand the injected iframe the full 58-method native bridge. **Measured, and it does not.**

`framebridge.c` builds a `WebEngineView` with a `WebChannel` exactly as an app does, registers a
`QtObject` carrying a property `secret = 'W18_NATIVE_ONLY_SECRET_4f2a'` and a function `pwn(s)`, and
loads `http://127.0.0.1:8480/main` (origin A) which frames `http://127.0.0.2:8481/child` (origin B)
**twice** — once statically in the initial HTML, once appended by script 1.5 s later, to separate
"frame existed at page load" from "frame injected afterwards", the case that actually matters.

| frame | origin | `typeof qt` | transport |
|---|---|---|---|
| main | A | `object` | **PRESENT** |
| `/child` (static iframe) | B | `undefined` | ABSENT |
| `/child2` (injected iframe) | B | `undefined` | ABSENT |

The main frame ran the protocol end-to-end and the harness proves each step out of band:
`{type:3}` init → response listing `probeObj` with
`properties:[[1,"secret",[1,4],"W18_NATIVE_ONLY_SECRET_4f2a"]]` (a value only the native side knew)
and `methods:[["pwn",5],…]` → `{type:6,object:"probeObj",method:5,args:["CALLED_FROM_MAIN"]}` →
the QML function really executed (the server logged the request `GET
/NATIVE_SIDE_EXECUTED_CALLED_FROM_MAIN` that only `pwn()`'s body can make) → response
`"native-executed:CALLED_FROM_MAIN"`.

**⇒ the amplify-origin frame is walled off from the native bridge by ordinary same-origin policy.**
It cannot reach `parent.qt` either (cross-origin). The reported docx chain reaches the bridge only
because `FILE_PREVIEW_URL = 'file-preview.html'` is **relative, i.e. same-origin** (F17), so that
frame can touch `parent.qt` directly. That distinction is the whole difference between the two paths
and should be stated that way in any report.

---

## §3 F21 — MEASURED: the injected cross-origin frame gets **camera + microphone with no prompt**

What the frame *can* do instead. Wickr's main view (`scratch/w16/qrc/blob_030a2bec.js`) ships:

```qml
onFeaturePermissionRequested: function(securityOrigin, feature) {
    console.log("granting permissions", securityOrigin, feature)
    grantFeaturePermission(securityOrigin, feature, true);
}
```

An attacker who injects the `<iframe>` also writes its `allow` attribute, i.e. delegates the parent's
own Permissions-Policy to the third-party origin. Same harness, `framebridge.exe grant`, fake devices
(`--use-fake-device-for-media-stream`; deliberately **not** `--use-fake-ui-for-media-stream`, which
would auto-accept and confound the result):

| frame | `allow` attribute | `getUserMedia({video,audio})` |
|---|---|---|
| main (origin A) | — | GRANTED — `audio:Fake Default Audio Input, video:fake_device_0` |
| `/child` static (origin B) | none | **DENIED** — `NotAllowedError: Permission denied` |
| `/child2` injected (origin B) | `camera *; microphone *; display-capture *` | **GRANTED** — live audio+video tracks |
| control run, no `onFeaturePermissionRequested` handler | any | never resolves (Qt default = no grant) |

**⇒ peer message → HTML injection → `<iframe allow="camera *; microphone *" src=<third party>>` →
silent live camera and microphone capture, exfiltrated to the attacker's own origin** (that frame's
CSP is the attacker's, so Wickr's `connect-src` does not apply). No bridge, no click, no prompt.
The `/child`-vs-`/child2` split is the finding's own control: the grant is not automatic, it needs
the attribute the attacker supplies.

Same handler also covers desktop capture, geolocation and notifications; `getDisplayMedia` needs a
user activation, `getUserMedia` does not.

---

## §4 F22 — MEASURED NEGATIVE: `openFile` is not an RCE primitive; the native side re-checks

This looked like the clean win: the JS allow-list really is cosmetic.
`utils/path.ts:isAllowedToOpenFile` is called by exactly three **render** sites
(`BaseConvoMessage.tsx:124`, `ConvoMessageAttachmentContent/index.tsx:31`,
`FileManagementItem/index.tsx:71`) — it decides whether to draw an "open" affordance. The
`openFile` thunk (`store/thunks/ui.ts:66`) does **not** call it, and the QML dispatcher
(`blob_030a350e.js:371`) does not check an extension either — it forwards to
`wickrWindow.openFile(fileUrl, fileDomain, fileKey, fileName)` where `fileName` comes from
`webChannelMessageBridge.getImagePreviewDetails(vgroupId, msgId)`, i.e. **the sender's attachment
name**.

Traced into the binary rather than inferred (the F12 lesson):

* the QML signal `openFile(QString,QString,QString,QString)` is connected to
  `wickrQuickMain::slotOpenFile` — the SIGNAL/SLOT literal pair is at file offset `0xe3b1c9`;
* metaobject resolved with `scratch/w18/moc.py`: stringdata struct `0x141d4db2c`, QMetaObject
  `0x141d4b9b8`, `qt_static_metacall = 0x14012f850`, jump table at RVA `0x1307a0`;
  **`slotOpenFile` = method 105 = `0x140070410`**, `slotFileDownloadedOpen` = 104 = `0x14006ef30`;
* `slotOpenFile` validates arg 1 (the cloud GUID) at `0x1409000e0` (failure logs
  *"Opening file, Invalid filename format"* and shows *"Unable to open this file"*), then builds the
  local name as **`"Preview_" + guid + defaultName.mid(defaultName.lastIndexOf("."))`**
  (`0x140070548` = `lastIndexOf`, `0x140070578` = `mid`, `"Preview_"` at `0x140e3f070`) — so the
  extension of the file that lands on disk **is chosen by the sender**;
* `slotFileDownloadedOpen` then calls **`0x1409c7390(config, filename) -> bool` and opens nothing if
  it is false** (`test bpl,bpl / je`), before reaching the `QDesktopServices::openUrl` wrapper
  `0x1408d62a0` — the same 68-byte wrapper W17 mis-attributed to `openLink`;
* `0x1409c7390` extracts the extension and does a hash lookup in `config+0x2d8`, returning true only
  on a hit (`cmp cl,0xff` → miss → `xor eax,eax`). **There is no `__default__` fallback in the
  lookup**, so an unknown extension is fail-closed;
* `config+0x2d8` is the *same* hash the bridge method `openFileAllowList` enumerates
  (`0x140106ac0`, reached through the identical `0x1409d5320` → `[rax]` → `+0x2d8`), so the list the
  JS sees and the gate the native uses are one table.

The table (file offset `0x326e1b4`, entries = *ext, description, colour, mime*) is:
`csv doc eps html docx zip (keynote) pdf ppt pptx pub (txt) xls xlsx ai psd bmp raw tiff mp3 wav avi
mov mp4 wmv png gif jpg` + `__default__`. **No `exe/bat/cmd/hta/js/vbs/scr/lnk/url/ps1/msi/chm/jar`.**

**⇒ bridge access does not convert into code execution through `openFile`.** Worth reporting as
hardening, not as RCE: `html` (an attacker HTML file opened from `file://` in the default browser),
`eps`/`ai` (PostScript), and `doc/xls/ppt` — legacy macro formats that **Wickr writes itself, so the
file carries no Mark-of-the-Web and Office opens it without Protected View**.

---

## §5 F23 — the bridge *can* repaint the whole window from an unvalidated URL

`webAppLoadUrl` is a **direct** `WebChannelMessageBridge` method (index 192; `configureWebApp` is
193, `saveGeneralFile` 134, `getAwsCredentials` 122 — `scratch/w18/moc2.py`, jump table RVA
`0xf4500`). The native implementation `0x140112860` unpacks the QVariantMap and re-invokes the QML
function **by name** (`"webAppLoadUrl"` literal at `0x141d453f0`) — it contains **no scheme or host
check** (`EnvironmentMgr::isURLDenied` is *not* on this path; the one internal call,
`0x1401085c0`, is an unrelated Amazon-build probe). The QML target, in the same file as the
permission handler:

```qml
function webAppLoadUrl(id, url) { var webView = webApps[id]; if (webView) webView.url = url }
```

and the view it navigates is created by `configureWebApp` from `webAppComponent` — a **separate
full-window `WebEngineView`** with `onCertificateError → acceptCertificate()`, **no CSP at all**
(it is a top-level document of whatever origin), and — the one piece of good news — **no
`webChannel`**.

**⇒ anyone with bridge access can replace the visible Wickr window with an arbitrary remote page over
a connection whose certificate is not validated.** Contrast `openLink`, which *is* filtered by
`environmentMgr.isURLDenied` in the dispatcher. Credential phishing / total UI spoof, not RCE.

---

## §5b The whole callable bridge surface, swept for "executes a process / writes an arbitrary path"

`WebChannelMessageBridge` has **197 methods, 49 of them signals ⇒ 148 callable** (enumerated with
`moc2.py`). Every member of that list that could plausibly reach process execution or an
attacker-chosen path was resolved to its implementation and read:

| method | reaches | verdict |
|---|---|---|
| `openFile` (via uiBridge action) | `slotOpenFile 0x140070410` → `slotFileDownloadedOpen 0x14006ef30` → `QUrl::fromLocalFile` → `openUrl 0x1408d62a0` | **gated** by the fail-closed extension hash (§4) |
| `saveFile` (action) | `slotDownloadFileNew 0x14006d850` unpacks the map and `QMetaObject::invokeMethodImpl(this,"slotDownloadFile",Queued,9 args)` → `slotDownloadFile 0x14006d350` → **`QFileDialog::getSaveFileName(parent,"Save File",…)`** | **the user picks the destination.** The sender's filename is only the *suggested* name ⇒ **no arbitrary-write primitive, no path traversal.** This closes the lead §6 previously called "most promising untested" |
| `saveGeneralFile` | `0x14010a6a0` — caption `"Save QR Code"`, filter `"Images (*.png)"`, default `"/qrCode.png"` | save dialog, PNG only |
| `activateHyperlink` | `0x1400f8f50` → `0x1409c7950`, and opens **only if it returns 0** (`test r14d,r14d / jne` skips `openUrl`) | **gated.** `0x1409c7950` is *literally* `EnvironmentMgr::isURLDenied` — proved by resolving `EnvironmentMgr`'s own metaobject (pool `0x143269444`, `qt_static_metacall 0x140a56320`, table RVA `0xa57fd0`, method 103) whose dispatch case `0x140a56932` calls the same `0x1409c7950`. So the direct bridge method carries the same deny-list as the QML `openLink` action |
| `updateApp` | `0x1401114b0` | Wickr's own update helper behind state preconditions ("in force state, but do not have force update available", "DB is corrupt", "auto update helper criteria not met"); no attacker-supplied URL |
| `webAppLoadUrl` / `configureWebApp` | §5 | arbitrary URL, but into a **webChannel-less, CSP-less** view ⇒ spoof, not execution |

**⇒ the bridge — the thing the reported XSS chain actually owns — contains no method that runs an
attacker-chosen program or writes an attacker-chosen path.** That is the substantive answer to the
goal, and it is a sweep of the whole surface, not a sample.

## §6 Where a peer-originated RCE could still be, in priority order

1. **The Chromium 130 renderer, reached from the third-party origin.** This is what the amplify
   premise is actually worth: a stable arbitrary-JS foothold inside the app process tree, which is
   the standard delivery position for a renderer n-day. **The confinement is now MEASURED on the
   running product, not inferred from a missing `--no-sandbox` string** (`scratch/w18/sandprobe.c`,
   read-only token/job/mitigation query over live processes):

   | process | integrity | restricted token | job | signature policy |
   |---|---|---|---|---|
   | `WickrPro.exe` (browser) | MEDIUM (0x2000) | no | yes | 0 |
   | **`QtWebEngineProcess.exe --type=renderer --webengine-schemes=wickrweb:…`** (the product's own renderer) | **UNTRUSTED (0x0000)** | **YES** | **YES** | **1 (MicrosoftSignedOnly)** |

   That is a genuine Chromium sandbox — untrusted integrity, restricted token, job object, and
   signed-code-only. **⇒ arbitrary JS at the third-party origin needs a renderer RCE *and* a sandbox
   escape to become code execution.** Two unproven n-days, neither demonstrated here. W16b already
   named the reachable native subsystems for the first half (PDF.js → `new FontFace(attacker bytes)`
   → OTS/Skia/FreeType; the image decoders).
2. **F6's relay overflow → instruction-pointer control** (W14) — real, executed in a harness, but it
   needs an on-path MITM, so it is not the peer-originated model the goal names.
3. Native memory corruption at the message-peer position that no wave has reached IP control on:
   the `Qt6Gui.dll` CRT-heap image decoders (W16), the two unpatched Qt SVG CVEs (W16c, DoS only so
   far), and the B-1 Chromium decoder path (W17f, crash-only instrumentation).

**~~`saveFile` path traversal~~ — CLOSED this wave, negative: it ends in
`QFileDialog::getSaveFileName` (§5b).** It was the lead this note originally ranked first; it does
not survive contact with the disassembly.

## §6b How the third-party origin actually gets on screen — the three delivery surfaces

The operator's blocker was "I cannot find a screen that displays the amplify origin". Confirmed, with
the reason: **on a stock GA build there is no legitimate screen that does.** Both in-product screens
are build-gated:

* `CheckSpeedModal` (the `<iframe src={amplify}>`) — the *only* opener is `BetaMenu.tsx:57`, and
  `NavRail/index.tsx:124` renders `{!isProduction && <BetaMenu />}`;
* **"Open Link in WebApp (Beta)"** — `ConvoMessageLinkContent.tsx:136-146`, gated on
  `useSetting('isBeta')` (`--environment` argv only, W17h). Note *what* it loads:
  `webAppLoadUrl({ id: vgroupId, url: link.url })` where `link` is the **peer's `WickrMessageLink`
  protobuf**, i.e. the URL is sender-chosen. The gate is the menu item, not the URL.

But no screen is needed, because two of the three delivery surfaces are attacker-created:

| # | delivery | precondition | what the attacker page gets |
|---|---|---|---|
| 1 | **injected `<iframe src=…>`** | HTML injection only, **no script** | cross-origin frame; own CSP (attacker's); **camera+mic if the tag carries `allow=`** (§3); no bridge (§2) |
| 2 | **`bridge.webAppLoadUrl({id,url})`** | script execution in the main frame | **full window, top-level, NO CSP at all**, TLS validation off, natively ungated on GA |
| 3 | "Open Link in WebApp" menu item | `isBeta` build | same view as #2, one victim click on a peer's link |

**#2 measured** (`framebridge.exe webapp`): the second, `webChannel`-less `WebEngineView` that
`configureWebApp`/`webAppLoadUrl` create reports `typeof qt === "undefined"` — so that view is a
chrome-less browser pointed anywhere, but it **cannot reach the bridge**, and having no
`onFeaturePermissionRequested` it does not auto-grant camera/mic either. It is the best *delivery
position* (no CSP constrains the attacker's page) and the worst *privilege position*.

## §6c The number route 1 actually needs, taken from the shipped DLL

`Qt6WebEngineCore.dll` exports both version accessors; disassembled, they return:

```
qWebEngineChromiumVersion()              -> "130.0.6723.192"   (Chromium base)
qWebEngineChromiumSecurityPatchVersion() -> "139.0.7258.67"    (declared backport baseline)
```

**⇒ a renderer n-day for this build must be a bug fixed AFTER 139.0.7258.67 (≈2025-09), not a
130-era one.** That is the "blocking artefact" W16b wanted and could not find on this host — it was
in the binary all along. **Caveat that must travel with it:** this is Qt's *declared* patch level,
and W16c showed Qt's own qtsvg CVE fixes were **absent** from this same build nine months after
publication. Treat it as a claim to be falsified per-CVE by W16c's method (find a string the fix
adds, test the shipped DLL, run the regression input), not as ground truth.

## §6d ★ CORRECTION TO §6 ITEM 1 — the network stack is NOT behind the sandbox

§6 said route 1 needs "renderer RCE **and** a sandbox escape". **That is true only for a bug in the
renderer.** The real product's own renderer command line (PID 24916, the process carrying
`--webengine-schemes=wickrweb:sLVCFG;qrc:sV`) reads:

```
--enable-features=NetworkServiceInProcess2,TracingServiceInProcess
--disable-features=…,StandardCompliantNonSpecialSchemeURLParsing,…
```

and a process census finds **exactly one** `QtWebEngineProcess.exe` — the renderer. There is no
separate network/utility process, because `NetworkServiceInProcess2` puts the network service
**inside the browser process**, i.e. inside `WickrPro.exe`, which §6 item 1's own table measured at
**IL=MEDIUM (0x2000), restricted token = no, dynamic code prohibited = no**.

**⇒ for the subset of Chromium bugs that live in the network path — URL parsing, HTTP/1.1 and H2
framing, content decoding, cookies, WebSocket, TLS, and the custom-scheme handler — there is no
sandbox to escape.** The attacker's origin drives that stack directly and completely (it chooses
headers, redirects, transfer encodings, compression, and, given
`onCertificateError → acceptCertificate()`, does not even need a valid certificate). And
`StandardCompliantNonSpecialSchemeURLParsing` being **disabled** means Chromium uses the *legacy*
URL parser for non-special schemes — the class `wickrweb://` belongs to, and historically a source of
parser-differential bugs.

**This does not demonstrate RCE and must not be reported as one.** What it does is correct the cost
estimate: route 1 is "**one** unproven n-day, in an unsandboxed process" for the network-stack
subset, not "two unproven n-days" as §6 stated. Settling it requires the same discipline W16c used
for the Qt CVEs — pick candidate CVEs fixed after `139.0.7258.67` in `//net`, `//url` or
`//services/network`, find a string or behaviour the fix changes, and test the shipped DLL.

## §7 Method notes that travel

* **`scratch/w18/moc.py` / `moc2.py` turn any shipped Qt binary's moc metadata into
  `method-name → implementation address`**: find the name in a `qt_meta_stringdata` pool, walk back
  to the struct start by testing `S + u32(S) == first_string_rva`, find the QMetaObject by searching
  the image for a qword equal to the pool VA, read `data`/`static_metacall` at +16/+24, then read the
  jump table (`lea rdx,[rip-…]` → image base; `mov eax,[rdx+rax*4+TABLE]`; `add rax,rdx; jmp rax`).
  Three unknown-slot questions this wave were answered in minutes each.
* **When a JS-layer allow-list exists, find the native one before writing either verdict.** Here the
  JS check *was* cosmetic (a real defect-in-depth remark) and the native check *was* real and
  fail-closed — the opposite of the F12 mistake, arrived at the same way: by tracing.
* An A/B with a **control that fails** is what makes a permission or capability result a
  measurement. `/child` (no `allow`) failing while `/child2` (with `allow`) succeeds is what turns
  §3 from a claim into evidence.
