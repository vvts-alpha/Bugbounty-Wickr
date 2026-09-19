# Wickr Android 6.72.5 — file preview route analysis

## Scope

- Package: `com.wickr.pro`
- Base APK: `base.apk`
- ABI split: `split_config.arm64_v8a.apk`
- Scanned code: all seven DEX files in the base APK
- The ABI split contains no DEX files.

## Conclusion

The built-in file preview is deliberately enabled only when network policy
disables file downloads.

```text
FilePreviewRepository.isFilePreviewEnabled()
    = !WickrConfig.isFileDownloadsEnabled()
```

When `enableFileDownload` is `true`, tapping a decrypted attachment calls
Android `ACTION_VIEW`, which produces the external Viewer selection screen.
This happens before the built-in preview checks whether DOCX is supported.

When `enableFileDownload` is `false`, the same tap enters
`FilePreviewActivity`. DOCX then maps to `FileWebPreviewFragment`.

## Conversation attachment route

```text
FileMessageAdapter.bindClickListeners$lambda$0
  -> decrypt or download attachment as required by FileState
  -> BaseAttachmentAdapter.openFile
  -> FileExtensionsKt.openFile
  -> FilePreviewRepository.isFilePreviewEnabled
       false -> FileExtensionsKt.openFileExternally
                -> Intent(ACTION_VIEW)
       true  -> FileExtensionsKt.openFile$openFileInternally
                -> MIME support lookup
                -> FilePreviewActivity
                -> FileWebPreviewFragment for DOCX
```

The decryption callback also converges on the same method:

```text
BaseAttachmentAdapter$startFileDecryption$observable$2.accept
  -> BaseAttachmentAdapter.openFile
  -> FileExtensionsKt.openFile
```

## Other UI route

The room file directory provides another entry:

```text
FileDirectoryPresenter.viewFile
  -> FileExtensionsKt.viewFile
  -> FileExtensionsKt.openFile
```

The room's **Open file** option therefore reaches the same policy gate. It
does not bypass the external/internal decision.

## Policy source

The runtime key is:

```text
enableFileDownload
```

It is loaded from the session's application configuration during login:

```text
Session.getSettings().getAppConfiguration()
  -> WickrConfig.loadConfig(...)
```

It is also refreshed through:

```text
WickrSessionManager.updateNetworkPermissions(...)
  -> WickrConfig.loadConfig(...)
```

The preview flag is created in `FilePreviewModule` as the logical inverse of
this network setting.

## DOCX mapping

The built-in destination map contains an exact DOCX entry:

```text
application/vnd.openxmlformats-officedocument.wordprocessingml.document
  -> FileWebPreviewFragment
```

For the internal branch, support is checked using the decrypted file's MIME
derived from its local file name/extension. `FilePreviewActivity` then derives
the MIME from the shared content URI and selects the navigation destination.

## Activity exposure

`com.wickr.enterprise.files.FilePreviewActivity` is declared without an
intent filter and without `android:exported="true"`. It is not a public
external entry point.

The only production code that constructs an explicit Intent for this activity
is `FileExtensionsKt.openFile$openFileInternally`.

`FilePreviewActivity` itself does not re-check the download-policy flag, but a
normal external `adb am start` cannot use it because the activity is not
exported.

## Web preview destination

`FileWebPreviewFragment` configures `FilePreviewWebViewClient`, which loads:

```text
https://wickr.android.appassets.net/web-assets/dist-file-preview/file-preview.html
```

The WebView asset loader registers:

```text
/web-assets/
/preview-file/
```

The selected decrypted attachment URI is used as the local response behind
`/preview-file/`.

## Correction to earlier hypotheses

- Message ownership is not checked in the attachment-to-preview branch.
- The same account on multiple devices is not the reason for external opening.
- Sender-provided MIME is used by the external `ACTION_VIEW` Intent, but the
  current external/internal decision occurs first and is controlled by
  `enableFileDownload`.
- The observed Viewer selection screen is consistent with
  `enableFileDownload=true`.

## Reachable production path

To reach the built-in preview without modifying the APK:

1. Set the network policy value `enableFileDownload` to `false`.
2. Allow the client to receive the updated network configuration, or log in
   again so `WickrConfig.loadConfig` runs.
3. Open the DOCX attachment from the conversation or the room file directory.
4. The decrypted `.docx` maps to `FileWebPreviewFragment`.
