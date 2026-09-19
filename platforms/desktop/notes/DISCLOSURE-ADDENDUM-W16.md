# AWS Wickr Desktop — Addendum to DISCLOSURE-2026-08

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Install under test:** `%LOCALAPPDATA%\Programs\Amazon Web Services, Wickr\AWS Wickr`
(`WickrPro.exe` dated 2026-07-13; bundled Qt DLLs dated 2025-09-17)

This addendum does two things: it **retracts one finding** from the main report, and it adds **three new
findings plus one hardening defect**. Everything below was produced by static analysis of the shipped
binaries and by executing the shipped decoders in a local harness. **Nothing was sent to Wickr
infrastructure, no live account was used, and no Wickr process was attacked.**

**Labels.** CONFIRMED = disassembled or executed (which one is stated). NOT DETERMINED = we say so.
Where a result is a crash, the exact Windows exit code is given.

---

## 0. Retraction — F4f is not an out-of-bounds write

**`DISCLOSURE-2026-08.md` §4.5 claims that a received PDF drives "256 out-of-bounds stores, up to 6,104
bytes past a 24-byte heap allocation" in the shipped PDFium. We withdraw that claim.**

Re-measured with the same PoC, the same shipped `Qt6Pdf.dll`, and the same
`QImage::loadFromData(bytes, format = NULL)` call, this time reading the bound the code actually uses:

```
read_sod = 256   storeA = 256   storeB = 256
stores failing the UPSTREAM GUARD (current_tpsno < nb_tps) : 512    <- what was counted before
stores past the ACTUAL ALLOCATION (current_nb_tps * 24)    :   0    <- the correct question
```

`opj_j2k_read_sot` (**`0x1802570b0`**) allocates `opj_calloc(10, 24)` = **240 bytes**, not 24, and then
grows the array before every write:

```
0x1802575cb  cmp  eax, dword [rdx+8]         ; TPsot < current_nb_tps ?
0x1802575ce  jb   0x18025767a                ; yes -> nothing to do
0x1802575d6  mov  dword [rdx+8], eax         ; current_nb_tps = TPsot+1
0x1802575f8  lea  rdx,[rax+rax*2]; shl rdx,3 ; (TPsot+1)*24
0x180257600  call 0x180260fe0                ; opj_realloc -> array now covers the index
```

The other branch is closed too: `TPsot >= TNsot` is rejected at `0x1802572ed` and `read_sot` returns
FALSE, so the premise that TPsot and TNsot can be chosen independently is refuted. `nb_tps` stays 0 only
because it is written on the *other* branch — which is why the upstream guard rejects all 512 stores
while the array is correctly sized throughout.

**What we still report from that work:** the shipped PDFium is a **2025-09-17** build behind the
application that bundles it, and `opj_j2k_read_sod` is missing the bounds/NULL test added upstream for
CVE-2026-2648. We report that as **stale-dependency hardening (CWE-1395)** and **claim no severity for
it.** Recommendation 21 (remove `qpdf.dll` from `imageformats\`, or pass an explicit format to
`loadFromData`) stands on the stale-parser argument alone.

---

## 1. NEW — Two unpatched Qt CVEs reachable by anyone who can send content

### 1.1 The delivery chain and why both are reachable

`qsvg.dll` declares **`image/svg+xml` and `image/svg+xml-compressed`**, and §4.3 of the main report
establishes that received bytes reach `QImage::loadFromData(bytes, format = NULL)`. Because the format
argument is NULL, **Qt sniffs the content and the sender chooses the parser.** Both findings below were
executed through that exact call against the shipped DLLs.

### 1.2 The supply-chain timeline — this is the core of both findings

Qt publishes per-CVE patches for the 6.9 series at `https://download.qt.io/archive/qt/6.9/`
(no authentication required):

| patch | published |
|---|---|
| `CVE-2025-10728-qtsvg-6.9.diff` | **2025-10-01** |
| `CVE-2025-10729-qtsvg-6.9.diff` | **2025-10-01** |
| `CVE-2025-12385-qtdeclarative-6.9-0001/0002.diff` | 2025-11-24 |
| `CVE-2025-14575-qtbase-6.9.diff` | 2026-05-19 |

**The shipped Qt DLLs are dated 2025-09-17 (Qt 6.9.2). The qtsvg patches were published two weeks later.
`WickrPro.exe` is dated 2026-07-13 — roughly nine months after those patches were public.**

### 1.3 Finding 8 — CVE-2025-10728, stack exhaustion in the SVG renderer (CONFIRMED, executed)

Upstream fixes a stack overflow where an SVG element references itself via `url()` (QTBUG-137553, found
by OSS-Fuzz) by adding a recursion guard to `QSvgPattern::renderPattern()`.

**The fix is absent from the shipped build.** The string the fix introduces —
`"The pattern is trying to render itself recursively. Returning a transparent QImage of the right size."`
— occurs **0 times** in `Qt6Svg.dll` (ASCII and UTF-16), while the logging category `qt.svg.draw` **is**
present and 24 other diagnostic strings survive (`"Invalid path data; path truncated."`,
`"Error while inflating gzip file: SVG format check failed"`, …). **This is a missing fix, not stripped
strings.**

**Executed:**

```
input (94 bytes) -- the reproducer Qt's own patch adds as a regression test (OSS-Fuzz id 390467765):
    <svg stroke="url(#c)"><pattern height="2" width="4" id="c"/><path stroke="#F00" d="v2"/></svg>

result: process exit 0xC00000FD  (EXCEPTION_STACK_OVERFLOW)   3 of 3 runs
        gzip-wrapped .svgz variant (100 bytes): same
```

The patch's *other* reproducer (id 42532991) returns cleanly on this build — it is caught by the older
quadratic cycle check that 6.9.2 does contain. Qt's patch text describes the first case as "another,
**still unfixed** stack overflow". **The two behaving differently is positive evidence that the shipped
build sits at the pre-patch state.**

**Impact: remote denial of service.** No code execution is claimed.

### 1.4 Finding 9 — CVE-2025-10729, dangling pointer in the SVG parser (CONFIRMED, executed)

Upstream's regression test states the defect verbatim:

> *"This input caused a QSvgPattern node to be created with a QSvgPatternStyle referencing to it. The
> code then detected that the `<pattern>` element is misplaced in the `<text>` element and deleted it.
> That left behind the QSvgPatternStyle pointing to the deleted QSvgPattern. That was reported when
> running the test with ASAN or UBSAN."*

Pre-patch, `QSvgHandler::startElement` creates the node **before** validating the parent type
(`node = method(m_doc ? m_nodes.top() : 0, …)`) and `delete`s it on the `default:` branch, after the
factory has already registered it with a style. The fix inverts the order. The fix adds no new string,
so this was verified by execution.

**Executed:**

```
input (90 bytes):
    <svg>
    <text><pattern id="ptn" width="4" height="4"/></text>
    <g fill="url(#ptn) "/>
    </svg>

result: process exit 0xC0000409  (__fastfail -- security-mitigation hard abort)
```

The three inputs separate cleanly, which is itself evidence of three distinct paths:

| input | exit code |
|---|---|
| CVE-2025-10729 reproducer | **0xC0000409** (`__fastfail`) |
| CVE-2025-10728 reproducer | **0xC00000FD** (stack overflow) |
| already-fixed case | 0x00000000 (clean) |

> **Honest limit.** `0xC0000409` is `__fastfail`'s generic status and is used for several mitigation
> categories (GS cookie, heap metadata, CFG). **Which category fired was not determined**, so the correct
> statement is *"the reproducer causes mitigation-detected memory corruption and a hard abort"* — not a
> claim about the corruption primitive. Upstream calls it a dangling pointer; we did not run ASAN/UBSAN.
> **Impact reported as remote denial of service. No exploitability is claimed.**

**Remediation for 1.3 and 1.4:** apply `CVE-2025-10728-qtsvg-6.9.diff` and
`CVE-2025-10729-qtsvg-6.9.diff`, or move to a Qt 6.9.x that contains them. Independently, and
immediately: **`image/svg+xml` does not need to be a sender-selectable decoder for received content** —
the same argument as recommendation 21.

---

## 2. NEW — Finding 7: a peer-declared length is used as a Frame payload size with no bound check

**CONFIRMED (disassembled).** In `NPL.dll`, `Parser`'s packet handler `0x18011fce0` parses the peer's
bytes into a protobuf message and dispatches on a peer-chosen kind field to three sibling handlers, each
receiving `(Parser, parsed peer message, received Packet)`.

**The kind-3 sibling builds its Frame correctly, from one object:**

```
0x18011ec70  mov r8d, dword ptr [r15 + 0x18]      ; length  <- the Packet
0x18011ec74  mov rdx, qword ptr [r15 + 0x10]      ; pointer <- the Packet
0x18011ec7b  call 0x180135ea0                     ; Frame(pool, ptr, len, …)
```

**The kind-2 handler `0x18011ef70` does not:**

```
0x18011efac  test byte ptr [rdx + 0x10], 1        ; has-bit for an optional sub-message
0x18011efb6  mov  rax, qword ptr [rdx + 0x30]     ; the peer's sub-message
0x18011efc4  cmovne r14, rax                      ; (protobuf default instance otherwise)
0x18011efef  mov  r8d, dword ptr [r14 + 0x18]     ; *** LENGTH from the PEER'S MESSAGE ***
0x18011eff3  mov  rdx, qword ptr [rsi + 0x10]     ; *** POINTER from the received Packet ***
0x18011effa  call 0x180135ea0
```

`[rsi + 0x18]` — the Packet's own length, the value the sibling uses — **is never read anywhere in the
2,343-byte function.** The sub-message is `Musigy::AV::Proto::PacketHeader_Buffer` (resolved from its
vtable `0x180442358` via its RTTI COL), and `+0x18` is the **first declared field** of a protobuf
message. Nothing between `ParseFromArray` and the Frame construction clamps it, so the declared length
is an arbitrary 32-bit value. Because a payload pointer is supplied, the allocator only stores
`[frame+0x40]=ptr` / `[frame+0x60]=size` — a huge declared size costs no allocation, it simply produces
a descriptor spanning up to 4 GiB of the received buffer, which is then pushed to both downstream sinks.

**Impact: a remotely triggerable out-of-bounds read of attacker-chosen length — remote denial of
service.** **Not an information leak:** the two sinks are downstream AV-graph nodes, and a BFS from all
499 reachable callees to the complete egress set (`sendto`/`send`/`SSL_write`/`BIO_write`) returns 0 at
depth 3, 5 and 7. No peer-visible channel carries the over-read bytes.

**Remediation:** use the Packet's own length, as the kind-3 sibling does, or validate the declared
length against it.

---

## 3. NEW (hardening) — peer-controlled display names bound to QML `Text` without `PlainText`

QML `Text` defaults to **`Text.AutoText`**, which runs `Qt::mightBeRichText()` on the content and
switches to the rich-text engine when it looks like markup. A user's **display name is set by that
user**, so it is peer-controlled data.

The application clearly understands this. `QString::toHtmlEscaped()` is imported and called from exactly
two functions, both of which *deliberately* build rich text and escape the peer name before
interpolating it:

* `0x140a9e740` — the typing indicator (`"%1 is typing"`, `"%1 and %2 are typing"`, `</b>` markup)
* `0x1400c1470` — `populateBotTable()`

And three QML sites bind a display name with an explicit `textFormat: Text.PlainText`.

**But several sites bind peer-controlled strings with neither escaping nor `textFormat`.** The larger
group is **conversation / room titles**, which are set by whoever creates or renames the room — i.e. by
another user, from the victim's point of view:

| site | binding | `textFormat` |
|---|---|---|
| `blob_03072d82.js` | `rootCM.title` | **not set ⇒ `AutoText`** |
| `blob_03076f2b.js` | `rootCM.convoTitle` | **not set ⇒ `AutoText`** |
| `blob_030801e3.js` | `rootCCM.convoTitle` | **not set ⇒ `AutoText`** |
| `blob_0309d309.js` | `menuItemRoot.title` | **not set ⇒ `AutoText`** |
| `blob_030a0e69.js` | `title` | **not set ⇒ `AutoText`** |
| **call UI** (`blob_030ad960.js`) | `_callDisplayName`, `_callDisplayNameShort` | **not set ⇒ `AutoText`** |

`convoTitle` traces to `tempRoomTitle` in the room-management QML, and the shipped i18n carries
`"Room Name"`, `"Room description"`, `"A room name is required."` — rooms are named by users.

> **Correction to an earlier draft of this item.** We previously also listed
> `modelData.displayName` in `blob_0306f6df.js`. That is **wrong and is withdrawn**: the model there is
> `availableCameras.item.videoInputs`, so the `displayName` is a **camera device name**, not a user's.

**And nothing upstream constrains the content:**

* `convoTitle` is a protobuf **`string`** field (`case 3: ce.convoTitle = ee.string()`), validated only
  for type (`"convoTitle: string expected"`) — **no length or character-set constraint in the wire
  format.**
* **No client-side length or charset validation for room or display names** was found in the React
  bundle.
* The escaping that does exist — markdown-it's `escapeHtml`, DOMPurify — protects the **React/WebEngine**
  UI. **The QML shell is a separate rendering path and does not use it.**

**The inconsistency is the finding**: the web UI is defended, the app escapes peer names where it builds
rich text deliberately (typing indicator, bot table) and sets `PlainText` on three display-name
bindings — yet six native QML bindings of peer-controlled strings have neither.

### 3.1 The client-side half is CONFIRMED by execution, against the shipped Qt

Two experiments, both run entirely locally against the shipped DLLs. **No Wickr account, process or
server was involved, and the only network traffic was to `127.0.0.1`.**

**(i) Which strings flip a QML `Text` into the rich-text engine** — by calling the shipped
`Qt6Gui.dll`'s own `Qt::mightBeRichText()` (`?mightBeRichText@Qt@@YA_NAEBVQString@@@Z`), which is the
predicate `Text.AutoText` uses (`scratch/w16/richtext.c`):

```
plain  Engineering
plain  Q3 Planning (EMEA)
plain  a > b                                        <- bare angle brackets are safe
plain  5 < 6 and 7 > 3
RICH   <b>Engineering</b>
RICH   <img src="http://example.invalid/x.png">
RICH   Engineering<img src="http://example.invalid/x.png">    <- NOT required to be at the start
RICH   hello <b>world</b>
```

> **Correction to an earlier draft:** we wrote that the tag must **open** the string. That is wrong —
> the shipped predicate returns true for markup appearing **anywhere** in the value.

**(ii) ★ The `<img>` fetch is real — demonstrated** (`scratch/w16/qmlbeacon.c`). Loading, with the shipped
`Qt6Core`/`Qt6Gui`/`Qt6Qml`/`Qt6Quick` (offscreen platform), the QML:

```qml
Item { width: 200; height: 60
  Text { anchors.fill: parent
         text: '<img src="http://127.0.0.1:47913/beacon">' }   // textFormat NOT set -> AutoText
}
```

a loopback listener received:

```
GET /beacon HTTP/1.1
host: 127.0.0.1:47913
connection: Keep-Alive
accept-encoding: gzip, deflate
accept-language: en-US,*
user-agent: Mozilla/5.0
```

**So a `Text` with the default `textFormat`, given a string containing `<img src="http://…">`, issues an
outbound HTTP request for it.** This is consistent with the static evidence: `Qt6Quick.dll` carries
`QQuickPixmap` (×64), `loadResource` (×5) and `QTextDocument` (×89), and imports
`QNetworkAccessManager::get` from `Qt6Network.dll`.

### 3.2 The server link — OPEN (operator-supplied evidence)

**The remaining link was tested by the operator on their own accounts** (not by us, and not as part of the
static/dynamic analysis above). A room was created whose **name and description** were both set to
`<img src="https://webhook.site/<uuid>/…">`.

**The server accepted and stored the markup, and returned it to the client for display.** There is
therefore **no server-side validation** of `<…>` in room names or descriptions, which closes the last
open question in §3.1: the wire format imposes no constraint, the client imposes none, and the server
imposes none.

**What the operator's screenshot also shows, and it matters:** in the **React/WebEngine** surfaces (the
conversation header and the "Room Details" panel) the value is rendered as **literal text** — the tags are
visible. That is the correct, safe behaviour and is exactly what §3 predicts: **the web UI escapes
(markdown-it `escapeHtml`, DOMPurify); the QML shell does not.** So this screenshot is evidence *for* the
finding's shape, not against it — it exercises the defended path.

### 3.3 ✗ The chain does NOT complete in the product — this item is hardening only

**The operator exercised the product with that room in place and no request was received at the
collector.** We take that as decisive for the product as shipped.

The most likely explanation is visible in the operator's own screenshot: **the "Room Details" panel is
rendered by React**, i.e. the QML room-management views (`rootCM`, `rootCCM`) that carry the `AutoText`
bindings appear to be **legacy resources superseded by the React SPA** — present in the qrc but not
reached by the current UI. That is consistent with every observation: the room title propagates as far as
the **native window title** (a plain `QWindow::title` string, rendered by the OS shell and therefore never
rich text), but does not reach a QML `Text`.

> **Correction to our own reasoning.** We had cited the room name appearing in the native window title as
> evidence that the QML bindings are live code paths. **That inference was wrong** — a window title is a
> plain string property and says nothing about whether the QML dialogs are instantiated.

**Final classification of this item: hardening, no demonstrated impact.**

* **CONFIRMED:** six QML `Text` bindings of peer-controlled strings omit `textFormat`, so they would use
  `Text.AutoText`; the shipped `Qt::mightBeRichText()` classifies `<img …>` anywhere in a value as rich
  text; the shipped Qt Quick **does** fetch `<img src="http://…">` over the network (§3.1); and the
  server stores such values without validation (§3.2).
* **NOT DEMONSTRATED, and not claimed:** that any of those bindings is reachable in the shipped UI. On
  the evidence, at least the room-management ones appear not to be.

**Why it is still worth reporting:** the missing `textFormat: Text.PlainText` is a latent defect on
attacker-controlled data. If any of those views is re-enabled, or a new `Text` is added over the same
model data, the fetch behaviour proved in §3.1(ii) becomes live — and the server-side gate that would
otherwise contain it does not exist (§3.2). It is a one-line fix per binding.
>
> **If that link holds, the consequence is not a crash — it is an interaction-free disclosure.** A room
> named `<img src="http://attacker/<id>">` would cause the victim's client to make an outbound request
> **when the room merely appears in a list**, revealing IP address, online status and timing, with no
> click and no message opened. The same value also reaches the **call UI** binding. Secondarily, it
> would make the unpatched `CVE-2025-12385` rich-text paths reachable.
>
> **We do not claim the end-to-end chain**, because the server-side link is untested. We do claim, with
> execution behind it, that **every client-side element of it is present in the shipped build.**
>
> Note that the shipped Qt is also missing `CVE-2025-12385-qtdeclarative-6.9-0001/0002` (2025-11-24),
> which harden exactly the rich-text `Text` paths (*"Rich text: Limit size of text object"* and
> *"Increase robustness of `<img>` tag in Text component"*). If display names can carry markup, those
> become reachable through the two sites above.

**Remediation:** set `textFormat: Text.PlainText` on every `Text` that binds user-controlled strings, or
escape at the binding, as the typing indicator already does.

---

## 3a. NEW — Finding 10: the bundled Chromium is frozen at 2025-08-12 and is missing **77** CVE backports that Qt has since applied to the very branch it is built from

**CONFIRMED, from Qt's own published repositories — not from binary analysis.**

`Qt6WebEngineCore.dll` reports a Chromium base of `130.0.6723.192` and a "security patch version" of
`139.0.7258.67`. Both are self-reported strings. The authoritative record is Qt's submodule pin:

```
qt/qtwebengine, tag v6.9.2, submodule src/3rdparty
  -> qtwebengine-chromium commit 136d7fe8aa41c9d4cd764a6b890af9699f5141dd
     committed 2025-08-12
     subject: "[Backport] CVE-2025-8582: Insufficient validation of untrusted input in DOM"
```

**So the Chromium source tree inside the shipped client was frozen on 2025-08-12.** Qt maintains that
tree on the `130-based` branch and lands security fixes on it as explicit `[backport] CVE-…` commits.
Comparing the pinned commit against the branch head:

```
qt/qtwebengine-chromium  136d7fe8...130-based
  status: ahead    ahead_by: 141 commits    (2025-08-15 .. 2026-03-20)
  distinct CVEs backported in those commits: 77
```

**None of those 77 CVE backports is present in the shipped build.** `WickrPro.exe` is dated
**2026-07-13** — about eleven months after the freeze, and roughly four months after the most recent
backport in that range.

The 77, by identifier:

```
CVE-2025-6021, -6965, -8582, -8879, -8880, -8881, -8901, -9866, -10200, -10201, -10500, -10501,
-10502, -10890, -10891, -10892, -11206, -11207, -11216, -11458, -11460, -11756, -12036, -12429,
-12432, -12433, -12438, -12441, -12443, -12726, -13042, -13224, -13634, -13638, -13639, -13721,
-14174, -24928, -48174, -48175, -54874,
CVE-2026-0628, -0899, -0905, -0908, -1220, -1504, -2316, -2317, -2319, -2320, -2441, -2648, -2649,
-3061, -3536, -3538, -3539, -3540, -3541, -3542, -3543, -3544, -3545, -3909, -3910, -3921, -3922,
-3923, -3929, -3931, -3934, -3938, -3940, -3941, -3942, -4441
```

**Note `CVE-2026-2648`** — the PDFium defect behind the retracted F4f — **is in this set** (Qt backported
it 2026-02-23). That is consistent with §0: the guard really is missing from the shipped build; what we
withdrew was the claim that it produces an out-of-bounds write.

> **Stated precisely, and this is the honest scope of the finding:**
> * This is **"CVEs Qt judged worth backporting to this branch after Wickr's pin"**, which is a
>   **superset** of "CVEs exploitable in Wickr". Some will not be reachable in QtWebEngine's
>   configuration (no V8 sandbox in some paths, components not compiled in) or in Wickr's usage.
> * It is **not** an accusation that Qt's `139.0.7258.67` string is false. That string describes what
>   6.9.2 claimed at release; the 77 backports landed on the branch **afterwards**, and would be picked
>   up by moving to a later 6.9.x. **The defect is Wickr's dependency currency, not Qt's honesty.**
> * **No exploitation of any of the 77 was attempted or is claimed.**
>
> **What it does settle:** the renderer's patch state, which two prior waves of this engagement left as
> UNDETERMINED. It is now determined, and the answer is that the bundled browser engine is
> approximately one year behind on security backports **from its own vendor's branch**.

**Remediation:** move to a current Qt 6.9.x (or later) so the `130-based` backports are picked up, and
add the qtwebengine-chromium pin to whatever dependency-currency process covers the rest of the product.
Given the renderer is reachable from received content (see §3, and the file-preview path generally), this
is the highest-leverage single change in this addendum.

## 3b. Triage of the 77 — which could plausibly be a *reachable* renderer bug

The question "does the missing set contain a reachable renderer RCE?" was triaged, not answered. The
triage is worth recording because **one filter does most of the work**.

**The dominant filter is Wickr's own CSP, and it is a genuine defensive strength.** The majority of
high-severity Chromium RCEs are **V8 JIT/engine bugs that require attacker-controlled JavaScript**. A8
proved by harness that the file-preview and app CSP (`script-src 'self' qrc://*`, no `unsafe-inline`, no
`unsafe-eval`) prevents attacker script from executing. **So the V8 class is out of reach**, and with it
most of the set. What remains is the subset triggerable by **markup, CSS, images and fonts alone**.

Classifying by the files each backport actually changed (the union of the 141 commits, 300 files):

| component | files | reachable without attacker script? |
|---|---|---|
| `v8/src` | 16 | **no** — needs script (CSP) |
| `blink/renderer/bindings/core` | 9 | **no** — JS↔DOM bindings |
| `third_party/angle` | 22 | **no** — WebGL needs script |
| `third_party/sqlite` | 15 | **no** — needs script |
| `blink/modules/xr` | 5 | **no** — WebXR |
| `content/browser` | 23 | only *after* a renderer compromise (sandbox/browser side) |
| **`third_party/libpng`** | **40** | **yes** — any PNG, including images embedded in docx/pptx/xlsx |
| **`third_party/skia`** | **16** | **yes** — rasterisation and glyph rendering |
| **`third_party/libavif`** | 2 | **yes** — AVIF `<img>` decoded by the renderer |
| **`third_party/libxml`** | 2 | **yes** — XML parsing (the preview has an `xml`/`rss` renderer) |
| **`third_party/pdfium`** | 2 | **yes** — via the `qpdf` image-plugin path |
| `blink/core/css`, `core/paint`, `core/html`, `core/animation` | 7 | **yes** — markup/CSS driven |

**Named candidates in the reachable components:** `CVE-2025-48174`, `CVE-2025-48175` (libavif);
`CVE-2025-6021`, `CVE-2025-24928` (libxml); `CVE-2026-2648`, `CVE-2025-54874` (pdfium);
`CVE-2026-3909`, `CVE-2026-3538` (skia). *(The 40 libpng files are **version bumps** — 1.6.53, 1.6.54,
1.6.55 — not CVE-labelled backports, so they are not counted among the 77; but libpng is a
reachable-without-script decoder and the bumps presumably carry fixes.)*

**The most promising single candidate, on the shape of its fix, is `CVE-2026-3909` (Skia).** The backport
changes `GrAtlasManager::addGlyphToAtlas` and `GlyphVector::regenerateAtlasForGanesh` so the mask format
is taken from the glyph entry key rather than re-derived from the `SkGlyph`, adding
`SkASSERT(gpuGlyph->fGlyphEntryKey.fFormat == maskFormat)`. `bytesPerPixel` is computed from that format,
so a mismatch is a **buffer-size confusion in the glyph atlas** — memory-corruption-shaped. **And glyph
rendering is precisely the surface §4k.1 shows is reachable** (peer PDF → PDF.js → `new FontFace(…)` →
the native font/text path).

*(By contrast `CVE-2025-48175`'s visible hunk is in `avifImageRGBToYUV` — the **encode** direction —
which weakens its reachability from received content.)*

> **What this triage does NOT establish, and we do not claim it:** that any of these is exploitable, or
> even that the vulnerable code is reached in this build's configuration (GPU vs software rasterisation
> matters for the Skia one). Going further means, per CVE: confirm the pre-fix code is in the shipped
> binary, confirm the path is driven by received content, and build a trigger. **That is a separate
> exploitation effort per candidate, not a continuation of this triage.**
>
### 3b.1 ✗ CORRECTION — the CSP filter above does NOT hold, and the line was stopped deliberately

**The CSP argument in §3b is wrong.** It assumed attacker JavaScript cannot execute in the renderer, on
A8's verdict. **The operator has an already-reported HTML-injection → XSS chain that achieves script
execution in the preview iframe.** With script available the filter collapses and essentially the whole
set is driveable, including the classes §3b excluded:

| component | previously excluded because | actual status |
|---|---|---|
| `v8/src` | "needs script" | **in scope** — `CVE-2026-3910`, `-3543`, `-3542`, `-3539`, `CVE-2026-2649`, `-2319`, `-1220`, `CVE-2026-0899` |
| `third_party/angle` (WebGL) | "needs script" | **in scope** — incl. Qt's own commit titles **"CVE-2025-10502: Heap buffer overflow in ANGLE"** and **"CVE-2025-8901: Out of bounds write in ANGLE"**, plus `CVE-2026-3536`, `-0908`, `CVE-2025-14174` |
| `blink/renderer/bindings` | "needs script" | **in scope** — `CVE-2026-3921`, `CVE-2025-10890` |
| `third_party/sqlite` | "needs script" | **in scope** — `CVE-2025-6965` |

So the honest triage answer to *"does the missing set contain a reachable renderer RCE?"* is **yes at the
triage level** — several are explicitly memory-corruption bugs in components the attacker can drive.
Whether any is *exploitable* in this build remains unproven.

> **DECISION — this line was stopped on purpose. Do not re-open it without reading this.**
> The delivery path for any such renderer bug is the **same HTML-injection → XSS entry point the operator
> has already reported.** Chasing an n-day to exploitation would therefore not produce an independent
> finding; it would raise the severity of an existing one, at the cost of a full per-CVE exploitation
> effort. **That trade was judged not worth it.**
>
> **What does NOT overlap, and still ships on its own:** **F10** — the engine being ~1 year behind its
> own vendor's backports is a statement about patch state, independent of any delivery path, with its own
> remediation (move to a current Qt 6.9.x). Likewise **F8/F9** (delivered through
> `QImage::loadFromData`, not the preview iframe) and **F7** (the call path). Those are unaffected by the
> overlap.

## 3c. NEW — Finding 11: `sanitizeHTML()` decodes HTML entities instead of escaping them, and its output is assigned to `innerHTML` in the main application frame

**The sanitizer bypass is CONFIRMED by execution. The in-product trigger is NOT tested — see "Not proven".**

This is a defect in **Wickr's own code**, not in a bundled dependency, and it is **distinct from the
HTML-injection issue already reported against the `.docx` preview**: different entry point, different
sink, different root cause, different remediation, and — the part that matters — **a different frame**.

### 3c.1 The broken control

`src/utils/dom.ts:341` (recovered from the shipped source maps, see §3c.5):

```ts
/** Given an input string, sanitizes any HTML out of it using a DOMParser. */
export const sanitizeHTML = (input: string): string => {
  if (!HAS_DOMPARSER) { logger.warn(…); return input; }
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  return doc.body.textContent ?? '';
};
```

`textContent` on a parsed document returns the **entity-decoded** text. The function therefore does not
escape its input — it *decodes* it. It strips markup that was already markup, and **creates markup that
was not**.

### 3c.2 The sink

`src/components/Convo/MessageContent/GeoLocationMap.tsx:188` — the function's only caller:

```ts
marker.current.bindPopup(sanitizeHTML(senderName ?? ''));
```

`bindPopup` is Leaflet's. `leaflet/dist/leaflet-src.js:10034`, `Popup._updateContent`:

```js
if (typeof content === 'string') {
    node.innerHTML = content;
}
```

### 3c.3 The data is peer-controlled and unvalidated

`src/utils/strings.ts:178`:

```ts
export const getContactDisplayName = (contact?) =>
  contact?.customName ?? contact?.name ?? contact?.id ?? '';
```

`contact.name` is mapped straight through from the native user record (`src/lib/protobuf/contacts.ts`)
with no escaping and no charset constraint. `src/components/Modals/LocationModal/index.tsx:41,71`:

```ts
const senderName = getContactDisplayName(sender);            // sender = whoever shared the location
…
<GeoLocationMap {...location} senderName={senderName} />     // `interactive` defaults to true
```

### 3c.4 EXECUTED — the bypass

`sanitizeHTML` was reproduced verbatim and its output assigned to `innerHTML` exactly as Leaflet does,
run headless in Chromium. **No Wickr account, process or server was involved and no network request was
made** (the probe uses the relative URL `x`, which never resolves).

```
--- plain markup ---      <img src=x onerror=…>        -> sanitized to ""          -> 0 elements
--- entity-encoded ---    &lt;img src=x onerror=…&gt;   -> "<img src=x onerror=…>"  -> 1 element [IMG]
--- numeric entities ---  &#60;img …&#62;               -> "<img …>"               -> 1 element [IMG]
--- entity svg/onload --- &lt;svg onload=…&gt;          -> "<svg onload=…>"        -> 1 element [svg]
--- mixed w/ real name -- Alice &lt;img …&gt;           -> "Alice <img …>"         -> 1 element [IMG]
--- benign ---            Alice                        -> "Alice"                 -> 0 elements

HANDLERS THAT ACTUALLY EXECUTED: 5,2,3,4
```

**Only the naive case is stopped.** Every entity-encoded variant survives sanitisation, is re-materialised
as a live element by `innerHTML`, and its handler runs.

> **The payload contains no `<` and no `>`.** A filter that rejects angle brackets in display names — the
> obvious defence — would not stop it.

### 3c.5 Where it lands

The main application frame is served from an HTML document whose scripts are
`/assets/wickr-BXqo7ivg.js` **and `qrc:///qtwebchannel/qwebchannel.js`** — this is the frame that holds
the WebChannel bridge, **not** the file-preview iframe. Its CSP is identical to the preview's:

```
script-src 'self' qrc://*
img-src    'self' https://tile.googleapis.com wickrweb://* blob: data:
frame-src  'self' blob: https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/
```

**Stated honestly:** `script-src` carries no `'unsafe-inline'`, so **inline `onerror`/`onload` handlers
do not execute in the product** — the handlers fire in the harness above only because the harness has no
CSP. What the defect yields in the product is **HTML injection into the bridge-bearing frame**, with
`frame-src` allow-listing an external origin.

### 3c.6 Not proven

* **That Wickr accepts and stores a display name containing `&lt;`.** Untested — it requires a live
  account. (§3.2 established that room names are stored without validation; display names were not
  tested.)
* **That the popup opens in the shipped UI.** `openPopup()` appears nowhere in the application source, so
  the popup requires the marker click: the victim must open the location message and then click the
  marker — two interactions.
* **Code execution.** Not claimed.

### 3c.7 Remediation

One line: make `sanitizeHTML` **escape** rather than decode, or — better — build a text node and pass
that to `bindPopup`, which Leaflet appends instead of assigning to `innerHTML`. Every other consumer of a
peer display name in this codebase relies on React's automatic escaping and is correct as written.

### 3c.8 How the source was obtained, and a completeness statement

`WickrPro.exe` embeds **Vite source maps including `sourcesContent`** — the original TypeScript of the
web UI (2,195 files). Note that the Qt resource system stores some entries **uncompressed**, so a
zlib-only carve is incomplete; the remaining maps were recovered by scanning the executable for the
literal `{"version":3,"file":"` header.

With the complete source, the HTML-sink census can be stated as a closed result rather than a sample.
**Wickr's own code contains exactly three HTML sinks:** two are `innerHTML`/`outerHTML` **reads** for
clipboard support (`ConvoMessageContextMenuItems.tsx:139`, `copyTextSelection.tsx:35`), and one is the
DOMPurify-guarded `dangerouslySetInnerHTML` in the PowerPoint preview. Every other file preview was
checked to a conclusion and is safe by React's escaping: **xls/xlsx/csv** (`sheet_to_json` → React
children), **txt/log/md** (`<p>{line}</p>`), **rtf** (converted with `rtfToTxt`, to text, not HTML),
**xml/rss** (`DOMParser` → a React node tree), and **pdf** (canvas). Finding 11 is therefore not one of
several such issues — on this evidence it is the only one of its kind in the application's own code.

---

## 4. Summary

| # | finding | evidence | impact |
|---|---|---|---|
| — | **F4f retracted** — the PDFium OOB write does not occur | executed; 0 of 512 stores leave the allocation | none (stale-dependency hardening only) |
| **F7** | peer-declared length used as a Frame payload size, unchecked | disassembled; sibling handler proves the correct pairing | remote DoS (OOB read) |
| **F8** | **CVE-2025-10728** present — SVG stack exhaustion | executed; 94-byte input, `0xC00000FD`, 3/3 | remote DoS |
| **F9** | **CVE-2025-10729** present — SVG dangling pointer | executed; 90-byte input, `0xC0000409` | remote DoS |
| **F10** | **bundled Chromium frozen 2025-08-12; 77 CVE backports Qt has since applied to the same branch are absent** | Qt's own submodule pin + branch comparison | supply chain / dependency currency |
| **F11** | **`sanitizeHTML()` decodes HTML entities instead of escaping; its output is assigned to `innerHTML` by Leaflet in the bridge-bearing frame, carrying a peer's display name** | bypass **executed** (4 of 5 payloads survive and materialise); sink, data flow and CSP source-verified | HTML injection into the main application frame — **storage of the payload in a display name is untested** |
| — | **peer-controlled room titles / call display name bound to `AutoText` without escaping.** Shipped Qt confirmed to treat `<img …>` as rich text **and fetch it over HTTP**; server confirmed to store such names unvalidated — **but the operator could not reach any of those bindings in the shipped UI (§3.3)** | disassembled + executed (`richtext.c`, `qmlbeacon.c`) + operator test | **hardening only — no demonstrated impact** |

**Attacker position for F7–F9 and item 3: anyone who can send the user content or place a call.** No
server compromise, no network position, and no interaction beyond receipt.

**What is not claimed anywhere in this addendum: code execution.** Every result here is a crash, an
out-of-bounds read, or a hardening gap.

**Reproduction.** PoCs and harnesses in `scratch/w16/` (`svgpoc/` for F8/F9; `jpxwatch.c` for the F4f
retraction) and `scratch/w13/` (`imgfuzz.exe`, the decode harness that resolves six Qt entry points by
exported mangled name so it cannot drift from the shipped build).
