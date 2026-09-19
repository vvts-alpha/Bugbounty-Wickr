# A5 — Post-decrypt received-content, attachment & link handling (WickrPro.exe)

**Agent:** A5 (content/attachment/link surface). **Date:** 2026-07-24. **Target:** AWS Wickr 6.72.20 (Windows).
**Verdict: NEGATIVE (no win) on the assigned surface.** Honest negative; instruction-level evidence below. Every sink is closed at instruction level, including the 0-click auto-download write-site (residual closed 2026-07-24 — see "Residual — CLOSED"). No fabricated/overclaimed positive.

---

## TL;DR
The post-decrypt attachment/file/link path in WickrPro's own C++ is **well-architected against exactly the bugs in scope**. Every filesystem-write and URL sink that touches attacker-authored content is gated by a defense that holds:
- **Local file storage is GUID/UUID-keyed**, not attacker-named. The file-id is validated as a `QUuid` (`0x1409000e0`); non-UUID input → "Invalid filename format"/"Invalid GUID" reject.
- **Save = user picks path** via `QFileDialog::getSaveFileName` (`0x14006d6be`). Attacker name only pre-fills the dialog, and is first stripped by `QFileInfo::fileName()` + a literal `".."` compare.
- **Open = fixed sandboxed temp name** `temp/preview/Preview_<UUID><ext>`; the attacker-influenced `<ext>` (`mid(lastIndexOf("."))`) cannot contain `..`. Decrypted files get **Mark-of-the-Web** (`0x140b617d0`) so the OS SmartScreen warning fires on execute; an **openFileAllowList** restricts openable types; opening is strictly **1-click** (auto-download stores, never auto-opens).
- **Received-link open** is gated by a strict **`http://` / `https://` / `mailto:` scheme allowlist** (`0x1409c7950`); `file://`, `javascript:`, UNC, custom schemes → "Unable to open this link".
- **Link preview is sender-generated** (stored in DB `link_previews`); the receiver does **not** auto-fetch attacker URLs → no receiver-side SSRF.
- **Download fetch host** comes from a **fixed baked-in allowlist** (`gw-pro-prod.wickr.com`, `api.messaging.wickr.*.amazonaws.com`, GovCloud/IC hosts) + account config; path `/fileproxy/download` keyed by GUID → no attacker-chosen host (no SSRF).
- **No native zip extraction** (no `QZipReader`/`extractAll`) → **no zip-slip**; QZip is outbound log-compression only. Received archives are opaque encrypted blobs.

Result: no arbitrary file write, no path traversal, no zip-slip, no receiver-side SSRF, no scheme-abuse local-file read, from received content within ≤1-click on this stock install.

---

## Reachability facts
- **Auto-download (0-click):** config `"maxAutoDownloadSize": 5000000` — attachments < 5 MB auto-download on receipt, stored **encrypted** under `%LOCALAPPDATA%\Wickr, LLC\Wickr Pro\temp\attachments\` (confirmed on-disk dir; cleanup globs `*-*-*-*-*` = canonical UUID). Auto-download **stores only**; it never auto-opens.
- **Open / Save / link-click:** 1-click (victim taps Open/Save/link in the conversation).
- Local storage tree built by `0x140a11470`: `temp/{attachments,preview,shredder,crl}` under `QStandardPaths::writableLocation` — all app-controlled directory names.

## Sinks traced (entry → sink, with the blocker)

### 1. Save received file — `0x14006d350` (1-click "Save As")  [NEGATIVE]
Args `{domain, filekey, filename(GUID), vgroupid, msgid, showProgressBar}`.
- `0x14006d389 call 0x1409000e0(filename)` → **QUuid validation** (see §5). Fail → log `"Downloading file, Invalid filename format:"` @ `0x14006d3b7`, return "Unable to download this file".
- `0x14006d466 QFileInfo(...).fileName()` — strips any directory components from the display name.
- `0x14006d488 lea rcx,".."` + `QString::compare` — explicit `..` reject.
- `0x14006d6be QFileDialog::getSaveFileName(...)` — **USER chooses the destination**. Attacker cannot pick the write path.
→ No traversal / no attacker-chosen write path.

### 2. Open received file — `0x140070410` (1-click "Open")  [NEGATIVE]
- `0x14007044b call 0x1409000e0` → same QUuid gate ("Opening file, Invalid filename format:").
- Temp name = `"Preview_"` (`0x140e3f070`) + `<UUID>` + `<ext>`, where `<ext> = mid(lastIndexOf("."))` of the display name — by construction contains no `..` (nothing after the last dot). Dir from `0x140a11440` → `temp/preview/`.
- `0x14007076e call 0x1409d4f50(ctx, UUID, r15, filekey, …, &tempPath)` decrypts + writes + opens.
- Open itself: `QUrl::fromLocalFile` (`0x14006ef30`) → `openUrl` wrapper (`0x1408d62a0`) — forced `file://` on the **sandboxed** temp path.
- Backstops for the attacker-controlled extension: **Mark-of-the-Web** applied to the stored file (§4) → OS SmartScreen on `.exe`; **openFileAllowList** restricts types; strictly 1-click.
→ No traversal; received-executable open is behind OS MOTW warning + type allowlist + explicit click (not a silent/0-click RCE).

### 3. Received-link open — `0x14006f610` → validator `0x1409c7950`  [NEGATIVE]
`0x1409c7950` = `startsWith("mailto:") || startsWith("http://") || startsWith("https://")`. Anything else → `esi!=0` → `"Unable to open this link"` (skip `openUrl`).
→ No `file://`/`javascript://`/UNC/custom-scheme abuse; no local-file read via link.

### 4. Mark-of-the-Web — `0x140b617d0`, called from download path `0x140bcd341`  [DEFENSE CONFIRMED]
`MarkOfTheWebHelper` → `QString::toStdWString` → Win32 `Zone.Identifier` ADS write on the downloaded file. Applied in the CLOUD TRANSFER MANAGER download-completion region. → downloaded content is treated as internet-origin; SmartScreen/"Open File – Security Warning" fires on execute.

### 5. File-id validator — `0x1409000e0`  [THE anti-traversal gate]
Strips optional `{}` braces (`startsWith("{")`/`endsWith("}[")`), constructs `QUuid(QAnyStringView)`, checks `isNull()` → logs "Invalid GUID" and returns false for anything that is not a canonical UUID. Has a `/GS` stack canary (`0x143490e40`). Because the on-disk name is a `QUuid` (canonical `8-4-4-4-12` hex+dashes), it can never contain a path separator or `..`.

### 6. Link preview / SSRF  [NEGATIVE]
`link_previews` is a DB column (referenced from the DB layer `0x140a29ad2`/`0x140a2c24d`); previews are **sender-generated and stored on receipt**. No `QNetworkAccessManager::get/post` caller sits in a preview-render path. `uploadToS3WithUrl: Target host:` (`0x1406e6c40`) is the **sender** upload path (host from account config), not a victim-side fetch. → No receiver-side SSRF / URL auto-fetch.

### 7. Download fetch host  [NEGATIVE for SSRF]
`QNAM::get` in the transfer/S3 client; host resolved from a **fixed baked-in list** (`gw-pro-prod.wickr.com`, `https://api.messaging.wickr.eu-central-1.amazonaws.com`, `messaging.wickr.us-gov-*`, IC `*.ic.gov`/`*.sgov.gov`) selected by account/network config; endpoints `/fileproxy/download` keyed by GUID. CRL fetch (`0x140be9980`) writes `temp/crl/<certhash>`. → per-message `domain`/GUID build the path, not the host.

### 8. Zip-slip  [NEGATIVE on native surface]
No `QZipReader`/`extractAll` symbols. QZip usage = outbound **log** archiving only (`/%1-logs_%2_%3.zip`, `slotArchiveLogs`, "DATABASE CORRUPTION DETECTED: … archived logs"). Received archives are stored as opaque encrypted blobs, never auto-extracted to disk.

---

## Dynamic verification (live PID, frida)
- Hooks installed & **fired** on the live process (base e.g. `0x7ff6acc50000`): filename validator `0x1409000e0`, link validator `0x1409c7950`, `openUrl` wrapper `0x1408d62a0`, `CreateFileW`, `GetAddrInfoW/getaddrinfo`. Confirms reachability/instrumentability.
- In observed windows: **no writes to sensitive locations** (only `.dbg`/`.pdb` symbol reads, all read-only) and no anomalous egress.
- Full end-to-end attack observation was **blocked by**: (a) no 2nd throwaway account to actually send a malicious file/link, (b) empty attachment state on this account (`temp/attachments`, `temp/preview` empty), (c) the shared WickrPro PID being **restarted repeatedly by other agents** (observed PIDs 20804→19268→1624→15048), preventing sustained capture. A synthetic direct-call of the validator via frida was inconclusive (QString ABI marshalling) and not pursued further to avoid crashing the shared PID.

## Adversarial refutation (why this is a real negative)
- *Path sanitized upstream?* Yes — file-id is `QUuid`-validated; display name is stripped by `QFileInfo::fileName()` + `..` compare.
- *Save-As dialog lets the USER pick the path?* Yes (`getSaveFileName`) → no attacker-chosen destination.
- *Open confined to sandbox dir?* Yes — `temp/preview/Preview_<UUID><ext>`, ext cannot hold `..`.
- *Received .exe → RCE?* Only behind OS **MOTW/SmartScreen** + **openFileAllowList** + explicit 1-click (not silent, not 0-click) = expected OS-mitigated behavior, not a Wickr bypass.
- *Scheme/host validated?* Link open = http/https/mailto allowlist; download host = fixed baked-in list. → no SSRF, no scheme abuse.
- *Zip-slip?* No native extractor.

## Residual — CLOSED (instruction-level NEGATIVE, 2026-07-24)
The 0-click auto-download write-site is now traced to the instruction level. **No arbitrary-write: the on-disk storage name is the QUuid-validated GUID, not the attacker `realfilename`.**

**Download-file init (0-click store entry): `0x140bcd7a0`** ("CLOUD TRANSFER MANAGER: Started Download File, Guid =").
- `0x140bcd7cd mov rcx,r8` (r8/rsi = storage GUID QString) → **`0x140bcd7d0 call 0x1409000e0`** = the QUuid validator (strips `{}`, `QUuid(...)`, rejects `isNull`).
- `0x140bcd7e1 test al,al ; 0x140bcd7e3 jne 0x140bcd830` — proceeds to task-setup **only if the name is a valid UUID**. Else `0x140bcd7f9` log "Downloading file, Invalid filename format:" → `0x140bcd826 call 0x140bd4c90` (abort) → `0x140bcdbfd` cleanup. **A non-UUID name aborts the download before any file is created.**
- Valid branch: `0x140bcd891 new(0x178)` task, `0x140bcd8a5` ctor, then **`0x140bcd8d6 lea rcx,[rax+0x38]; mov rdx,rsi; call QString::operator=`** → `task->field@0x38 = the validated GUID`. The attacker display name is stored in a *separate* field (`[rdi+8]`) and is itself passed through **`QFileInfo::fileName()`** (`0x140bcd906`→`0x140bcd914`, directory-stripping) — it never becomes the storage path.

**Write-site (decrypt/store): `0x140bccb10`** ("CLOUD TRANSFER MANAGER: Decrypt Download").
- `0x140bccb4b call 0x140a111a0` (attachments dir) → `0x140bccb50 lea r8,[r13+0x38]` (the GUID) → `0x140bccb5b QDir::absoluteFilePath` → source open `0x140bccb8e QFile::open`.
- Dest = `<attachmentsDir>/absoluteFilePath(field@0x38 = GUID)` (`0x140bcce08`–`0x140bcce18`); temp = `QUuid::createUuid().toString().mid(1,36)` (`0x140bcce2b`–`0x140bcce6a`); decrypt → temp → **`0x140bcd173 QFile::rename(temp → dest)`** → MOTW `0x140bcd341`.

Because `field@0x38` is a canonical `QUuid` string (`8-4-4-4-12` hex+dashes), it cannot contain `..`, `/`, `\`, or `:`; `QDir::absoluteFilePath` therefore stays inside `temp\attachments`. The attacker-controlled `realfilename` is directory-stripped (`QFileInfo::fileName`) and, regardless, is not the name used at the write. **Verdict: NEGATIVE — no 0-click arbitrary-file-write.** (No live-app injection needed; the QUuid gate at `0x140bcd7d0` is dispositive and matches the identical gate in the click-path handlers `0x14006d350`/`0x140070410`.)

## Handoffs (not my surface)
- **A2 (WebChannel/renderer):** embedded **SheetJS/jszip/SocialCalc** parse attacker-sent spreadsheet/archive content **in-memory inside the WebEngine view** for preview (`SocialCalcSpreadsheetControlSave`, xlsx/ODS parser). This is a renderer-side parse of attacker content — injection point for A2, not a native filesystem write.
- **A2 (deeplink):** QML `schemaRE.test(loadRequest.url)` / "DEEP LINK REQUEST" routing.

## Key offsets (all vaddr, ImageBase 0x140000000)
- Save handler `0x14006d350`; Open handler `0x140070410`; file-id validator `0x1409000e0`; link open `0x14006f610` → link validator `0x1409c7950`; openUrl wrapper `0x1408d62a0`; mailto composer `0x140072620`; local-file open `0x14006ef30`; temp/base dir `0x140a11440`; attachments-dir+cleanup `0x140a11470`; MOTW helper `0x140b617d0` (called `0x140bcd341`); CRL download `0x140be9980`; decrypt+open `0x1409d4f50`.
- Tooling left in scratchpad: `xref.py` (rip-relative + call/jmp xref map, cached `xrefmap.pkl`), `foxref.py` (file-offset→vaddr xref), `observe.py` (live passive hooks), `wpro_strings.txt`, `wpro_syms.txt`, `izz.txt`.
