# Wickr Android ファイルプレビュー解析まとめ

## 1. 対象

| 項目 | 値 |
|---|---|
| アプリ | AWS Wickr Android |
| パッケージ | `com.wickr.pro` |
| バージョン | `6.72.5` |
| versionCode | `60720511` |
| minSdk | 33 |
| targetSdk | 35 |
| 解析対象 | `base.apk`, `split_config.arm64_v8a.apk` |

`base.apk` 内の全7 DEX、Manifest、ナビゲーショングラフ、WebView資材を確認した。ABI splitにDEXは含まれていない。

## 2. 内蔵プレビューの有効条件

内蔵ファイルプレビューは常時使用されるものではない。

```text
FilePreviewRepository.isFilePreviewEnabled()
    = !WickrConfig.isFileDownloadsEnabled()
```

ネットワーク設定キー：

```text
enableFileDownload
```

挙動：

| 設定 | 挙動 |
|---|---|
| `enableFileDownload=true` | Androidの外部Viewerへ渡す |
| `enableFileDownload=false` | Wickrの内蔵プレビューを使用 |

設定はログイン時に次の経路で読み込まれる。

```text
Session.getSettings().getAppConfiguration()
  -> WickrConfig.loadConfig(...)
```

ネットワーク権限更新時にも再読込される。

```text
WickrSessionManager.updateNetworkPermissions(...)
  -> WickrConfig.loadConfig(...)
```

実機でViewer選択画面になった原因は、MIMEやメッセージ所有者ではなく、ファイルダウンロードが許可されていたためだった。

## 3. 添付タップからプレビューまでの経路

会話内の添付：

```text
FileMessageAdapter.bindClickListeners$lambda$0
  -> 添付のダウンロードまたは復号
  -> BaseAttachmentAdapter.openFile
  -> FileExtensionsKt.openFile
  -> FilePreviewRepository.isFilePreviewEnabled
       false -> FileExtensionsKt.openFileExternally
                -> Intent(ACTION_VIEW)
       true  -> FileExtensionsKt.openFile$openFileInternally
                -> MIME対応確認
                -> FilePreviewActivity
```

復号完了後も同じ経路へ合流する。

```text
BaseAttachmentAdapter$startFileDecryption$observable$2.accept
  -> BaseAttachmentAdapter.openFile
```

ルームのファイル一覧にも別の入口がある。

```text
FileDirectoryPresenter.viewFile
  -> FileExtensionsKt.viewFile
  -> FileExtensionsKt.openFile
```

ただし、どちらの入口も同じ設定判定を通るため、ルームのファイル一覧は設定を回避する経路ではない。

## 4. FilePreviewActivity

対象Activity：

```text
com.wickr.enterprise.files.FilePreviewActivity
```

特徴：

- Manifestにintent-filterがない。
- `android:exported="true"`ではない。
- 外部アプリや通常のADB Intentから呼べる公開Activityではない。
- 本番コードで明示Intentを生成する箇所は`FileExtensionsKt.openFile$openFileInternally`。
- Activity自身は`enableFileDownload`を再確認しない。呼出し前のヘルパーで判定される。

ナビゲーション先：

```text
PDFPreviewFragment
ImagePreviewFragment
GIFPreviewFragment
FileWebPreviewFragment
```

## 5. 対応MIME

内蔵プレビューの登録一覧：

```text
application/pdf
image/png
image/jpeg
image/gif
application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.openxmlformats-officedocument.presentationml.presentation
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
text/comma-separated-values
text/csv
text/plain
text/rtf
application/xml
text/xml
```

DOCXは次へ割り当てられる。

```text
application/vnd.openxmlformats-officedocument.wordprocessingml.document
  -> FileWebPreviewFragment
```

内蔵経路の対応確認では、復号済みファイルの名前・拡張子からMIMEが生成される。送信メタデータのMIMEだけをJavaScriptに変更しても、`.docx`の共有URIからDOCX MIMEが再生成される。

## 6. WebView構成

`FileWebPreviewFragment`は次を生成する。

```text
com.amazon.wickr.filepreview.webclient.FilePreviewWebViewClient
```

WebView設定：

```text
JavaScript enabled
DOM storage enabled
```

表示ページ：

```text
https://wickr.android.appassets.net/web-assets/dist-file-preview/file-preview.html
```

`WebViewAssetLoader`の仮想オリジン：

```text
https://wickr.android.appassets.net
```

登録パス：

```text
/web-assets/
/preview-file/
```

## 7. `/preview-file/` の挙動

フルURL：

```text
https://wickr.android.appassets.net/preview-file/
```

このURLは外部Webサーバーではなく、対象WebView内だけで処理される仮想URL。

ハンドラーはURLの後半を無視する。

```text
/preview-file/a
/preview-file/test.js
/preview-file/image.png
/preview-file/../../other
```

すべて現在プレビュー中の同じ`fileUri`を返す。

概念上の処理：

```text
要求パスを受信
  -> 要求パスはファイル選択に使用しない
  -> 現在のfileUriをContentResolverで開く
  -> 現在のfileUriからMIMEを取得
  -> WebResourceResponseとして返す
```

結果：

- 別の添付は参照できない。
- 任意の端末ファイルは参照できない。
- パストラバーサルにはならない。
- 取得できるのは現在表示中のファイル自身のみ。
- ハンドラーの寿命は対象WebViewインスタンスの寿命と同じ。
- 外部ブラウザや別のWebViewから利用できる共有エンドポイントではない。

DOCXプレビュー時のレスポンスMIME：

```text
application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

URLを`/preview-file/test.js`にしても、要求パスの`.js`はMIME判定に使用されない。

## 8. CSP

埋込みHTMLのCSP：

```text
default-src 'self' qrc://* wickrweb://*;
style-src 'self' 'unsafe-inline';
script-src 'self' qrc://*;
connect-src 'self' wickrweb://*;
img-src 'self' https://tile.googleapis.com wickrweb://* blob: data:;
font-src 'self' data:;
media-src 'self' wickrweb://* data: blob:;
frame-src 'self' blob: https://*.chime.aws:* https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/;
worker-src 'self' blob:;
child-src 'self' blob:;
object-src 'self'
```

重要点：

- `'self'`は`https://wickr.android.appassets.net`。
- `/preview-file/`は同一オリジン。
- インラインJavaScriptは許可されていない。
- 同一オリジンの外部JavaScriptはCSP上許可される。
- インラインCSSは許可される。
- `base-uri`、`form-action`、`frame-ancestors`の指定がない。
- `/preview-file/`の応答に`X-Content-Type-Options: nosniff`がない。

## 9. DOCXレンダラー

同梱されているDOCXレンダラーは`altChunk`を有効にしている。

```text
renderAltChunks: true
```

`altChunk`のHTMLはiframeの`srcdoc`へ設定される。

確認事項：

- iframeに`sandbox`がない。
- `srcdoc`へ入れる前の十分なHTMLサニタイズが確認できない。
- `srcdoc`は親ページのオリジンとCSPの影響を受ける。

## 10. 実機PoC結果

無害な固定マーカー：

```text
DOCX_RENDERER_TEST_MARKER
```

実機画面で確認済み：

- 通常のDOCX本文が表示された。
- `altChunk`内のHTMLが別枠で表示された。
- `altChunk`内の画像要素が生成された。
- 次の同一オリジンURLへの画像要求が試行された。

```text
https://wickr.android.appassets.net/preview-file/DOCX_RENDERER_TEST_MARKER.png
```

ハンドラーは画像ではなくDOCX自身を返すため、画像デコードに失敗し、壊れた画像と代替テキストが表示された。これは想定どおりの結果。

通常構成版PoC：

```text
poc-preview-file-marker-v2.docx
```

## 11. 現在までに実証されたこと

- 内蔵DOCXプレビューへの到達条件。
- `altChunk` HTMLのレンダリング。
- sandboxなしの`srcdoc` iframe。
- 同一オリジンの`/preview-file/`要求。
- `/preview-file/`が現在のDOCX自身を返すこと。
- インラインJavaScriptを許可しないCSP。

## 12. 未実証事項

- 任意の端末ファイル参照。
- 別の添付ファイル参照。
- 認証情報やアプリ内データの取得。
- 外部へのデータ送信。

~~JavaScript実行~~ → **2026-07-27 実機確認済み**（§13参照）。
~~DOCXとJavaScriptを兼ねるポリグロット~~ → **成立**。`poc-docx-polyglot-xss.docx`。
~~DOCX MIMEをAndroid WebViewのChromiumがクラシックスクリプトとして実行するか~~ → **実行した**（nosniff不在のため）。

## 13. ポリグロット — 仮説から実証へ（2026-07-27 実機確認）

JavaScript実行の成立条件：

```text
w:sym/@w:char -> innerHTML の注入シンク
  + iframe srcdoc（パーサー生成文書＝script実行可能、オリジン・CSPを親から継承）
  + script-src 'self'
  + /preview-file/が同一オリジンでDOCX自身を返す
  + nosniffなし
  + JSZipのreader.zeroが前置データを自動補正
```

ポリグロット構造（`build_polyglot_poc.py`で生成）：

```text
[JSペイロード][/*][手組みZIP本体（"*/"ペア排除済み、STORED形式）][EOCD comment="*/"]
```

実機結果（Android実機、Wickr 6.72.5）：

- プレビュー画面上部に赤帯 `WICKR SAME-ORIGIN JS EXEC CONFIRMED` が表示された。
- バナーはiframe内スクリプトから**親文書**へappendされたもの＝同一オリジンDOM書込の証明。
- `document.title`が`WICKR-XSS-CONFIRMED`に変化。
- 表示上の`origin=null`はabout:srcdocの`location.origin`仕様。文書の実効オリジンは親から継承（クロスフレームDOM書込の成功が証拠）。

PoCファイル：

- `poc-docx-polyglot-xss.docx`（v1: バナー表示）
- `poc-docx-polyglot-xss-v2.docx`（v2: document.domain/親URL/localStorage件数表示）

## 14. 現時点の評価

確定している問題は、信頼されないDOCX内の`altChunk` HTMLを、sandboxなしの同一オリジンiframeとして表示する設計。

一方、現在のPoCで確認できた`/preview-file/`アクセスは表示中のDOCX自身に限定され、別ファイル参照には拡張できていない。

現時点で適切な表現：

```text
未サニタイズのaltChunk HTMLレンダリング
および同一オリジンのローカル資材要求
```

JavaScript実行を確認できるまでは、完全なXSSとして断定しない。

## 15. 防御案

優先度順：

1. DOCXレンダラーの`renderAltChunks`を無効化する。
2. `altChunk` HTMLを許可リスト方式でサニタイズする。
3. iframeへ`sandbox`を付け、`allow-scripts`と`allow-same-origin`を付与しない。
4. `/preview-file/`を固定された単一URLだけに限定する。
5. 応答へ`X-Content-Type-Options: nosniff`を追加する。
6. `Content-Disposition: attachment`または用途に合った厳格なMIME処理を検討する。
7. CSPを強化する。

```text
object-src 'none';
base-uri 'none';
form-action 'none';
```

8. 文書レンダラーを専用プロセスまたは分離されたオリジンへ隔離する。

## 16. 関連ファイル

- `preview-route-analysis.md`
- `preview-route-disassembly.txt`
- `preview-route-selected-methods.txt`
- `preview-route-index.json`
- `poc-preview-file-marker-v2.docx`
