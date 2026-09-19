# Wave-2 leads (held; surface when a slot frees or wave-1 stalls)

## Auto-update / WinSparkle — LOW EV under our scope
- WinSparkle (wxWidgets build) verifies updates with **DSA** (`#dsaSignature`, `Cannot read DSA public key from PEM`, `Missing DSA signature!`, `Invalid update signature`, OpenSSL `dsa_*`).
- Appcast URL is runtime-set: `win_sparkle_set_appcast_url`, `WickrWinSparkle::checkForUpdates`, `signalAutoUpdateUrlChanged`, `: Appcast Endpoint = `. Possibly server/config-driven.
- Clean win requires: (HTTP appcast **or** attacker-controllable appcast URL) **AND** a DSA-verify bypass/downgrade. Two hurdles → violates "no 2nd unproven bug"; MITM is EXCLUDED.
- CHEAP CHECKS worth doing before any agent: (1) is the appcast fetched over HTTP or HTTPS? (find the actual URL WickrPro passes); (2) does the `Missing DSA signature!` path fail-open (accept unsigned) — audit `WickrWinSparkle`/WinSparkle verify branch; (3) is `sparkle#installerArguments` attacker-influenceable (arg injection to the installer)?

## Calling / WebRTC media — STRONG wave-2 (0-click-ish native parsing)
- Strings `/api/call/start`, `/api/call/status`, meeting/host logic. Voice/video = large native media/RTP/codec parsing surface reachable by calling the victim (0-click if auto-answer, else victim-answers). Distinct from MLS. Good candidate for an A5.

## SSRF via upload host — MEDIUM
- `uploadToS3WithUrl: Target host:` — if the S3/upload host is attacker-influenceable (room/file/config), possible SSRF or redirect. Check host controllability + whether it's validated.

## SocialCalc spreadsheet in webview — feed to A2
- Embedded SocialCalc engine (`--SocialCalcSpreadsheetControlSave`). If attacker-sent spreadsheet content renders with JS in a WebChannel-attached view → renderer→native. A2 owns WebChannel; flag SocialCalc as a specific attacker-content type to check.

## Data-at-rest keys — OUT (needs local access = excluded for WIN)
- `skd.wic/dkd.wic/ds.wic`, SQLCipher `wickr_db.sqlite`. Only relevant if it enables a remote/cross-user break; otherwise excluded.
