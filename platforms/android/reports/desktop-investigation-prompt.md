# AWS Wickr Desktop — DOCX Preview XSS 調査プロンプト

## ミッション

AWS Wickr Desktopクライアントにおいて、悪意あるDOCXファイルのプレビューからユーザーデータ（メッセージ、連絡先、認証情報）に到達できるか検証する。Android版では同一オリジンXSSは成立したがメッセージデータには届かなかった。デスクトップ版はアーキテクチャが異なり、到達可能性が変わる。

## 背景：Android版で確認済みの事実（共有コード根拠）

### DOCXプレビューのHTMLインジェクション（クロスプラットフォーム共通）

バンドルされたdocx-previewライブラリに非サニタイズシンクがある：

```
ファイル: web-assets/dist-file-preview/assets/index-ee8ec7f12.js
sink:    renderSymbol(e){ ... t.innerHTML = `&#x${e.char};` ... }
入力:    e.char = w:sym/@w:char 属性値（DOCXのword/document.xml内）
```

`w:char` 属性値が `innerHTML` に直接代入される。XMLエンティティ復号後に任意のHTMLがプレビューDOMに注入される。このシンクはJSバンドルがクロスプラットフォーム共換のためデスクトップでも存在するはず。

### CSP（共有コード、デスクトップでも同一の可能性）

```
default-src 'self' qrc://* wickrweb://* ;
style-src 'self' 'unsafe-inline' ;
script-src 'self' qrc://* ;
connect-src 'self' wickrweb://* ;
img-src 'self' https://tile.googleapis.com wickrweb://* blob: data: ;
frame-src 'self' blob: https://*.chime.aws:* https://fast.com/ https://main.d4zeeqgazhley.amplifyapp.com/ ;
worker-src 'self' blob: ;
child-src 'self' blob: ;
object-src 'self'
```

注意点：
- `qrc://*` と `wickrweb://*` はデスクトップ（Qt Web Engine）のスキーム。Androidでは不使用（DEX内ゼロ件）だがデスクトップでは稼働する
- `script-src 'self'` — デスクトップの `'self'` は `wickrweb://` オリジン
- `frame-src` に `https://main.d4zeeqgazhley.amplifyapp.com/` が完全一致で許可（Android APK同梱アセット内で確認済み）
- `form-action` / `base-uri` / `navigate-to` / `frame-ancestors` 未定義

### 許可オリジンのReact2Shell CVE-2025-55182（確認済み）

`https://main.d4zeeqgazhley.amplifyapp.com/` は Next.js 15.0.2 で稼働し、CVE-2025-55182に脆弱。AWSエッジWAF（awselb/2.0）は既知ペイロードを403でブロックするが、17KBパディングでボディ検査上限を越えてバイパス可能。読み取り専用マーカー `R2S_CONFIRMED_v18.20.8` を反射してRCE実証済み（永続化・データアクセスなし）。

このオリジンはframe-src許可リストに入っているため、インジェクション経由でiframe表示可能。オリジンを制御すればiframe内でattacker JSが実行される。

### プレビューJSのクロスプラットフォーム分岐（重要）

`file-preview-ee8ec7f1.js` 内：

```js
function getFilePreviewDataFromUrl(){
  const a = new URLSearchParams(location.hash.substring(1));
  const vgroupId = a.get("vgroupId") ?? "";  // メッセージグループID
  const msgId    = a.get("msgId") ?? "";      // メッセージID
  const fileId   = a.get("fileId") ?? "";     // ファイルID
  const fileExt  = a.get("fileExt");
  ...
  const fileUrl = isAndroid() ? "/preview-file/"
      : (vgroupId && msgId) ? wickrWebEndpoints.fileData(vgroupId, msgId)
      : fileId ? wickrWebEndpoints.fileDataFromFileManager(fileId)
      : "";
}
```

Androidでは `vgroupId`/`msgId`/`fileId` は空（ネイティブがURLに埋めない）。デスクトップではネイティブがこれらをフラグメントに埋める可能性が高い → デスクトップのプレビュー文書には**メッセージ識別子が存在する**。

### Android版のポリグロットXSS（デスクトップでは不成立）

Androidでは `/preview-file/` が現在表示中のDOCX自身を返す仕組みを利用し、ZIP+JSポリグロットDOCXを作成して同一オリジンJS実行を達成した。実機確認済み。

デスクトップでは `wickrWebEndpoints.fileData(vgroupId, msgId)` 経由でファイルを取得するため、自己参照構造がなくポリグロットは不成立。

## デスクトップ固有の確認項目（優先順位順）

### P0: postMessageブリッジの有無（最大の分岐点）

デスクトップのメインアプリ（wickrweb://コンテキスト）が `window` の `message` イベントをリッスンしているか。postMessageはクロスオリジンでも動作する（SOP対象外）ため、もしリスナがあれば：

```
iframe（amplifyオリジン、attacker JS実行中）
  → parent.postMessage({type:"...", vgroupId:..., msgId:...}, "*")
  → メインアプリのリスナが応答 → データがiframeに返る
```

確認方法：
- デスクトップアプリのJSバンドルを `addEventListener("message"` / `onmessage` / `postMessage` でgrep
- リスナのオリジン検証有無（`event.origin` チェック）を確認
- リスナが処理するデータ型と応答内容を確認

### P1: QtWebChannelネイティブブリッジ

Qt Web Engineアプリは `QWebChannel` でネイティブ機能をJSに公開する：

```js
new QWebChannel(qt.webChannelTransport, function(channel) {
  channel.objects.someApi.doSomething(...)
});
```

確認項目：
- `qt.webChannelTransport` / `QWebChannel` / `qt` グローバルオブジェクトの有無
- 登録されているチャネルオブジェクトの一覧と公開メソッド
- **iframe内からアクセス可能か**（クロスオリジンiframeでも `qt` グローバルが見えるか）
- もしiframeから見えるなら、メッセージ送信・ファイル読取・連絡先取得などのAPIがないか

### P2: wickrweb:// スキームの特権性

- `wickrweb://` がカスタムURLスキームとして登録されているか（`QWebEngineUrlScheme::registerScheme`）
- セキュアコンテキスト扱いか、ローカルファイル扱いか、CSPバイパス属性があるか
- `script-src 'self'` の `'self'` が `wickrweb://host` を指す場合、攻撃者が制御可能なwickrweb://リソースはないか（パストラバーサル、オープンリダイレクト、動的コンテンツ生成）

### P3: fileDataエンドポイントの性質

`wickrWebEndpoints.fileData(vgroupId, msgId)` が返すURLパターンと応答：
- MIME typeは何か（nosniff有無）
- レスポンスにメタデータ（送信者名、タイムスタンプ）が含まれるか
- 別のvgroupId/msgIdを指定して他のユーザーのファイルを読めるか（IDOR）

### P4: プレビューの実行コンテキスト

- プレビューはメインアプリ文書内にインライン表示されるか、独立フレーム/ウィンドウか
- インラインの場合、インジェクションはメインアプリDOMに直接入る（メインアプリのCSPとブリッジが適用される）
- 独立フレームの場合、フレームのオリジンと親との関係

### P5: DOM Storage / Cookie の共有

- プレビューオリジンとメインアプリオリジンの関係
- 同一オリジンならStorageとCookieが共有される → メインアプリのトークン等が読める可能性
- 異オリジンならSOPで分離

## 調査手法

### 1. デスクトップアプリの取得

AWS Wickr Desktopをダウンロード（Windows/Mac/Linux）。対応URL：
- https://docs.aws.amazon.com/wickr/
- https://www.wickr.com/downloads

### 2. パッケージの展開

**Qt Web Engineアプリの場合**（可能性大 — qrc://スキームが存在）：
- Windows: インストールディレクトリ内の `.pak` / `.dat` / `resources/` を確認
- Qtリソース（.qrc）はバイナリにコンパイルされている場合がある → `strings` やバイナリgrepでJS文字列を抽出
- 別途 `resources/app/` やインストール先のJSファイルを直接確認

**Electronアプリの場合**：
- `app.asar` を展開：`npx asar extract app.asar out/`
- JS/HTMLを直接読める

### 3. 解析手順

```
a. JSバンドルを抽出・grep：
   - addEventListener("message" / onmessage / postMessage（P0）
   - QWebChannel / qt.webChannelTransport / webChannelTransport（P1）
   - wickrweb:// のURLパターン定義（wickrWebEndpoints）（P3）
   - wickrWebEndpoints オブジェクトの全プロパティ

b. CSPメタタグの確認：
   - デスクトップ用HTML内のContent-Security-Policy
   - Android版と差分があるか

c. ネイティブブリッジの公開API：
   - channel.objects に何が登録されているか
   - メッセージ送信・ファイル読取・認証関連のAPI

d. fileDataエンドポイントの動的テスト（実際にアプリを起動）：
   - 開発者ツール/リモートデバッグでnetworkとJSコンソールを確認
   - wickrweb://fileData... の実際のURLとレスポンスを観察
```

### 4. 動的確認（アプリ起動）

QtWebEngineのリモートデバッグを有効化：
```
# 起動時にフラグを追加（環境による）
--remote-debugging-port=9222
# または環境変数
QTWEBENGINE_REMOTE_DEBUGGING=9222
```
Chrome で `http://localhost:9222` に接続 → DevTools で：
- `window` グローバルの列挙（`qt`, `QWebChannel` 等）
- `window.addEventListener("message", e => console.log(e))` でメッセージ観察
- iframe内から `parent.postMessage` / `qt` / `QWebChannel` のアクセス可否

## 判断基準

| 確認結果 | 報告可否 | 深刻度 |
|---|---|---|
| postMessageリスナあり・オリジンチェックなし・メッセージデータ応答 | **報告（Critical候補）** | メッセージ内容漏洩の可能性 |
| QtWebChannelがiframeからアクセス可能・機密APIあり | **報告（Critical候補）** | ネイティブ機能へのアクセス |
| fileDataエンドポイントIDOR | **報告（High）** | 他ユーザーのファイル読取 |
| frame-src XSSのみ（データ到達不可） | **報告（Android報告に統合）** | 信頼UI内でのフィッシング |
| ブリッジなし・SOP完全・データ到達不可 | Android報告の補足情報 | 影響拡大なし |

## スコープ・倫理

- HackerOneスコープ：`Wickr Pro/Wickr Me (all related technical components)` — デスクトップクライアント含む
- 最小影響テストのみ：読み取り専用マーカー、永続化なし、データ改変なし、他ユーザーへの影響なし
- React2Shellのテストは読み取り専用（`process.version`相当）に留める
- 過大主張を避ける：確認できた範囲と確認できなかった範囲を明確に分離

## Android版報告の参照ファイル

デスクトップ調査との比較用：
- `wickr-android-preview-analysis.md` — Android解析まとめ（§13ポリグロット実証済み）
- `H1-report-wickr-docx-preview.md` — Android版HackerOne報告書
- `webassets/assets_dist-file-preview_assets_index-ee8ec7f12.js` — docx-preview（シンク箇所）
- `webassets/assets_dist-file-preview_assets_file-preview-ee8ec7f1.js` — Reactアプリ（getFilePreviewDataFromUrl含む）
