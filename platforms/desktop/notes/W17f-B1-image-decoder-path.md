# W17f — B-1: the peer-image → Chromium-decoder path, and a correction to my own §3b triage

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)

**What this establishes:** a **delivery path** into the renderer's image decoders that is
zero-interaction, needs no file preview, no HTML injection and no script — i.e. it does **not** overlap
the operator's reported HTMLi chain, which is why the "the delivery overlaps, so stop" decision that
closed the renderer-CVE line does not apply here.

**What it does not establish:** any reachable bug. See §4 — the named candidates from my earlier triage
turn out to be unreachable on this path, and I say so.

---

## 1. The path, verified end to end in the application source

1. A peer sends an image attachment. The client gates on the **declared** mimetype
   (`SUPPORTED_IMAGE_PREVIEW_TYPES`, `src/lib/protobuf/messages.ts:583`):
   `image/png`, `image/jpeg`, `image/jpg`, `image/bmp`, `image/gif`, `image/webp`.
2. `ConvoMessageImageContent` renders it as an `<img src="wickrweb://image/message/:convoId/:msgId">`
   via `SafeImageWithLoadingSpinner`, with `loading="lazy"`.
3. That is the **main application frame** — the one carrying the WebChannel bridge — **not** the
   file-preview iframe.

**So decoding happens when the message scrolls into view. No click, no "open", no preview.**

## 2. The sender, not the client, chooses the decoder

Blink selects an image decoder by **content sniffing**, not by the transport's Content-Type. The
mimetype gate above therefore constrains which attachments Wickr *offers* to render, not which decoder
actually runs on the bytes. Measured decoder inventory in the shipped `Qt6WebEngineCore.dll`:

| MIME registered | count | notes |
|---|---|---|
| `image/png`, `image/apng` | 11 / 3 | **libpng 1.6.43** |
| `image/jpeg` | 4 | **libjpeg-turbo 2.1.5.1** |
| `image/webp` | 3 | `RIFF`/`WEBP`/`VP8L`/`VP8X` markers present |
| **`image/avif`** | 3 | `av01` ×21 — **AVIF is compiled in** |
| `image/gif`, `image/bmp`, `image/x-icon` | 5 / 2 / 5 | |
| `image/svg+xml` | 6 | inert in `<img>` (no script) |

The libpng version is unambiguous — `1.6.43` sits inside libpng's own string block at `0x8d197ac`,
adjacent to `Potential overflow in png_zalloc()`, `Application built with libpng-`,
`unexpected end of LZ stream`:

```
|Potential overflow in png_zalloc()||1.6.43||||||Application built with libpng-|| but running with |
```

## 3. Why this matters for F10

F10 established that the bundled Chromium was frozen at **2025-08-12** and is missing 77 CVE backports
that Qt has since landed on the very branch it is built from. Its weakest point was that no delivery
path had been shown for the script-free subset. **This is that path**, and it is the cheapest one in the
product: send an image.

The concrete, checkable currency statement for the report is therefore:

> The PNG decoder that any peer's image reaches with no user interaction is **libpng 1.6.43**, while the
> vendor's own `130-based` branch has since moved it to **1.6.55**. The JPEG decoder is
> **libjpeg-turbo 2.1.5.1**.

## 4. ✗ CORRECTION to §3b of DISCLOSURE-ADDENDUM-W16 — the named candidates are NOT reachable here

§3b named, as "reachable in components driven without attacker script", `CVE-2025-48174` and
`CVE-2025-48175` (libavif) and treated the libpng bumps as carrying reachable fixes. **Checked against
what the code actually does, on this path:**

| CVE | where the defect lives | reachable from `<img>` decode? |
|---|---|---|
| **CVE-2025-48174** (libavif) | integer overflow in `makeRoom`, `stream.c` — that is `avifRWStream`, the **read-write/mux** stream | **No** — encode/mux side |
| **CVE-2025-48175** (libavif) | `avifImageRGBToYUV`, `reformat.c` — **RGB→YUV**, the encode direction | **No** — encode side |
| **CVE-2025-65018** (libpng, heap **write**, ≤1.6.50) | `png_image_finish_read` — libpng's **simplified API** | **Very likely no** — Blink's `PNGImageDecoder` drives the low-level progressive API (`png_process_data`), not `png_image_*` |
| **CVE-2025-66293** (libpng, OOB read, ≤1.6.51) | `png_image_read_composite` — **simplified API** | **Very likely no**, same reason |
| CVE-2025-64720 (libpng) | introduced in 1.6.51 | **N/A** — shipped build is 1.6.43, predates it |

**So the strongest-looking candidates from my own triage do not survive contact with this path.** The
triage classified by *which files a backport touched*; it did not check whether the touched function is
in the code path a browser decode actually takes. That was the error, and §3b should be read with this
correction attached.

**Honest scope:** I checked the four CVEs §3b named plus the libpng release range. **The remaining ~35
CVEs in components the renderer does exercise (skia, blink core/css/paint, libxml, pdfium) were not
examined for decode-path reachability**, and nothing here says they are or are not reachable.

## 5. What is reportable from this, stated at the strength it holds

* **Reportable, and it strengthens F10:** peer-supplied images are decoded by the bundled Chromium's
  decoders, in the bridge-bearing frame, with no interaction beyond the message scrolling into view; the
  decoder is chosen by the sender's bytes rather than the declared mimetype; and those decoders are at
  **libpng 1.6.43 / libjpeg-turbo 2.1.5.1**, frozen 2025-08-12. This is an attack-surface and
  dependency-currency statement, and it is measured.
* **Not reportable, and not claimed:** that any specific CVE is exploitable here. Nothing in §4 survived.
* **No exploitation was attempted.**

## 6. If this is taken further

The remaining honest way forward is not CVE archaeology — it is to fuzz the shipped decoders directly
through the shipped `Qt6WebEngineCore`, using the harness already built for F13
(`scratch/w17/certprobe.c` loads the shipped WebEngine and can be pointed at a local server that serves
mutated images). That measures this build rather than inferring from advisories written about other
builds.
