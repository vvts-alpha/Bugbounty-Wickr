# AWS Wickr Desktop — DOCX Preview XSS 到達可能性調査

**対象:** WickrPro 6.72.20.0 (`WickrPro.exe`, sha256 `eccafde833d34386…`)  
**手法:** 静的（RCC/ソースマップ復元 + QML）。本フェーズでストッククライアントの実行は未実施。  
**Android対比:** 同一オリジンポリグロットXSSはAndroidで成立したがメッセージデータ未到達。デスクトップはアーキテクチャが異なり、データ面は `wickrweb://` + QWebChannel。

---

## 総合判定

| 確認結果（判断基準） | 判定 |
|---|---|
| postMessageリスナあり・オリジンチェックなし・メッセージデータ応答 | **不成立** — リスナはあるが **origin必須**、応答は `openLink` のみ（確認ダイアログ付き） |
| QtWebChannelがiframeからアクセス可能・機密APIあり | **同一オリジンJSが前提** — bridgeは強力だが、プレビュー内攻撃者JS未達成。クロスオリジン(amplify)からは到達不可（静的） |
| fileDataエンドポイントIDOR | **静的未証明** — ハンドラはログインセッション前提のネイティブ実装。ID推測可能性はランタイム要検証 |
| frame-src XSSのみ（データ到達不可） | **現状ここ** — DOCX HTMLインジェクション + amplify frame は可能だが、SOP/originゲートでデータ面に届かない |
| ブリッジなし・SOP完全・データ到達不可 | Android報告の**補足（影響拡大なし）**として統合可。ただし下記「単一障壁」とランタイム残件あり |

**結論（報告可否）:** デスクトップ固有の Critical（メッセージ/認証情報漏洩）は **未成立**。Android報告への補足として、デスクトップでも同一シンク・同一CSPがあり、**JS実行さえできれば** `wickrweb://` / `uiBridge` でデータ全面に届く構造であること、および CSP が唯一の負荷制御であることを記載するのが妥当。

---

## P0 — postMessageブリッジ

**存在:** あり（メインアプリのみ）。

```99:114:wickr/extracted/sources/src/components/Modals/FilePreviewModal/index.tsx
  const handleIframeMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.origin === window.parent.origin) {
        switch (event.data.type) {
          case 'openLink':
            dispatch(openLink({ link: event.data.url, showConfirmation: true }));
            break;
          default:
            logger.info('Unknown message type from preview:', event.data.type);
        }
      }
    },
    [previewUrl]
  );

  useEventListener(window, 'message', handleIframeMessage);
```

| 項目 | 結果 |
|---|---|
| `event.origin` | **検証あり**（`=== window.parent.origin`） |
| `event.source` | **検証なし**（同一オリジンなら任意sender可） |
| 処理型 | `openLink` のみ |
| 応答データ | なし（親→子へのデータ返信なし） |
| 下流 | `ConfirmModal` 後に `uiBridge.openLink` |

プレビュー側送信元:

```10:18:wickr/extracted/sources/src/file-preview/components/withLinkHandler.tsx
    useEventListener(containerRef, 'click', (e) => {
      ...
        window.parent.postMessage({ type: 'openLink', url: href }, window.parent.origin);
```

**Amplify (R2S) iframe → parent.postMessage:** `event.origin` は `https://main.d4zeeqgazhley.amplifyapp.com` となりゲートで **拒否**。メッセージ内容の返却経路は存在しない。

**ソース全体の `message` リスナ:** FilePreviewModal（UI）と pptx worker（Worker内）と MessageChannel（rAF相当）のみ。機密データ応答型のブリッジはなし。

---

## P1 — QtWebChannel / ネイティブブリッジ

**登録（QML）:** メイン `WebEngineView` に `webChannel: channel`、`channel.registerObject("uiBridge", uiBridge)` のみ明示。JS側アダプタは複数（`bridge`, `environmentMgr`, `fileManager`, `uiBridge`, `wickrSettings`, `serverModel`, `onboardingBridge`）。

**プレビューアプリ:** `FilePreviewApp` / `DummyStoreProvider` は **QWebChannelを開かない**。読み取り専用ダミーRedux。メッセージストアはプレビューに存在しない。

**preloads.js** (`qrc:///webengine/preloads.js`): `window.URL` の `qrc:` ベース修正のみ。bridge/messageなし。`DocumentCreation` + `MainWorld`（サブフレーム注入フラグなし → 通常メインフレームのみ）。

**機密API（同一オリジンJSが取れた場合）:** `BridgeWebChannel` に `sendTextMessage`, `getMessages`相当のfetch経路、`signOut`, `awsCredentials`（webFetch経由）等。`connect-src` が `wickrweb://*` を許可するため、**同一オリジンでの `fetch('wickrweb://…')` がデータ面の本命**。

**クロスオリジンiframe（amplify）から `qt`:** Qt WebChannel transportはページ／メインフレーム紐付けが通常。SOPにより親DOMも不可。**静的には「iframeから見えない／使えない」扱い**（ランタイムで `typeof qt` を amplify コンテキストで確認推奨）。

---

## P2 — `wickrweb://` 特権性

- カスタムスキーム。QMLに `registerScheme` なし → **ネイティブ C++**（`installUrlSchemeHandler` インポート痕跡あり）。
- CSP: `default-src` / `connect-src` / `img-src` / `media-src` に `wickrweb://*`。**`script-src` / `frame-src` には無い** → 攻撃者ファイルを script/frame として読めない。
- 破壊的ルート（password / leaveNetwork / inviteUser 等）は **カスタムヘッダ必須**（`fetchInternal.ts`）。宣言的 `<img src=wickrweb://…>` ではヘッダを付けられず no-op。
- 読み取りルート（`users/self`, `contacts/contacts`, `message/…`, `awsCredentials`, `file/message/…`）は **GETで平文/バイナリ応答**。応答ボディの読み取りには **script + fetch** が必要（`<img>` では不透明）。

**WAVE2既知:** ハンドラに initiator/origin チェック無し → プレビューDOMからの宣言的GETで `admin/controls` 等のUI起動は可能（AWSネットワークでは多くの場合 no-op）。データexfilにはならない。

---

## P3 — `fileData` エンドポイント

```47:53:wickr/extracted/sources/src/file-preview/FilePreviewProvider.tsx
  const fileUrl = isAndroid()
    ? `/preview-file/`
    : vgroupId && msgId
    ? wickrWebEndpoints.fileData(vgroupId, msgId)
    : fileId
    ? wickrWebEndpoints.fileDataFromFileManager(fileId)
    : '';
```

| 項目 | 内容 |
|---|---|
| URL | `wickrweb://file/message/:convoId/:msgId` / `wickrweb://file/savedfile/:guid` |
| ハッシュ | デスクトップは **`vgroupId`/`msgId`/`fileId` を fragment に埋める**（Androidは空） |
| 自己参照ポリグロット | **不成立**（Androidの `/preview-file/` 構造なし） |
| MIME / nosniff | ネイティブ実装 → **ランタイム未確認** |
| IDOR | セッション内の他会話IDを知っていれば読める可能性。ID空間は高エントロピー。**未実証** |
| メタデータ | ファイルバイト本体。送信者名等は別エンドポイント（`message/…`） |

ハッシュ上の `vgroupId`/`msgId` は **当該プレビュー対象**（攻撃者が送ったファイル自身）であり、他ユーザーの秘密IDの新規漏洩にはならない。価値があるのは **同一オリジンJSでの他ルート列挙**。

---

## P4 — プレビュー実行コンテキスト

```97:134:wickr/extracted/sources/src/components/Modals/FilePreviewModal/index.tsx
  const previewUrl = `${FILE_PREVIEW_URL}#${urlParams.toString()}`;
  ...
          <iframe src={previewUrl} />
```

- **独立iframe**、`sandbox` **なし**、相対URL → メインと **同一オリジン**（`qrc:` / 設定された `webViewAddress`）。
- DOCXインジェクションはプレビューiframe DOM内。メインDOMへは直接入らない。
- 同一オリジンのため、**もしプレビューで攻撃者JSが動けば** `window.parent` / `window.top` 経由でブリッジ到達可能（WAVE2 harnessで `'self'` スクリプトは到達確認済み）。
- `docx-preview` の `renderSymbol` シンクはデスクトップ同梱でも存在:

```3530:3534:wickr/extracted/sources/node_modules/docx-preview/dist/docx-preview.mjs
    renderSymbol(elem) {
        var span = this.createElement("span");
        span.style.fontFamily = elem.font;
        span.innerHTML = `&#x${elem.char};`;
```

- 追加: `renderAltChunk` → `iframe.srcdoc`（フルHTML）。Chromium 130では srcdoc が親meta-CSPを継承し、inline scriptは死ぬ。**CSPが唯一の障壁**。

---

## P5 — DOM Storage / Cookie

| 項目 | 結果 |
|---|---|
| プレビュー ↔ メイン | 同一オリジン → Storage共有 **可能**（理論） |
| Cookie | QML: `offTheRecord:true`, `NoPersistentCookies` → 永続Cookieなし |
| プレビューアプリ | DummyStore、認証トークンをweb Storageに置く痕跡なし（認証はネイティブ/`wickrweb`） |
| amplify iframe | **異オリジン** → Storage/Cookie共有なし |

Storage経由のトークン窃取は現実的な主経路ではない。データ面は `wickrweb://`。

---

## Androidとの分岐（要約）

```
Android:  /preview-file/ 自己参照 → ポリグロット同一オリジンJS ✅
          しかしメッセージDBブリッジ弱 → データ未到達

Desktop:  wickrweb://fileData → ポリグロット ❌
          HTML injection (renderSymbol / altChunk) ✅
          CSP script-src で攻撃者JS ❌（現状）
          もしJS成功 → wickrweb:// + uiBridge でデータ全面 ✅（構造的）
          amplify R2S JS → 異オリジン → postMessage拒否 / SOP → データ ❌（静的）
```

---

## Amplify R2S × frame-src（今回プロンプト固有）

確認済み前提: `https://main.d4zeeqgazhley.amplifyapp.com/` は frame-src許可かつ CVE-2025-55182 で攻撃者JS実行可。

| ステップ | 結果 |
|---|---|
| DOCX → `<iframe src=amplify…>` | CSP上 **許可** |
| amplify内 R2S JS | **実行可**（別調査） |
| `parent.postMessage` → FilePreviewModal | **origin不一致で拒否** |
| 親DOM / Redux / hash読取 | **SOPで拒否** |
| `qt` / QWebChannel | **期待不可**（要ランタイム） |
| `fetch('wickrweb://…')` from amplify | **最大の残件** — スキームがプロファイル全体に効き initiator 非検査なら理論上あり。Amplify側CSP・カスタムスキームCORSで落ちる可能性も高い。**未検証** |

この1点が Yes の場合のみ、デスクトップ固有 Critical に格上げ。現状は **未確認のため主張しない**。

---

## 報告推奨フレーミング

1. **Android H1への補足（推奨）**  
   - デスクトップでも同一 `renderSymbol` / altChunk シンクと同一CSP。  
   - プレビューは同一オリジン・非sandbox iframe。  
   - postMessageは origin検証済み・openLinkのみ。  
   - データ面（`wickrweb://` + WebChannel）は強力だが、**攻撃者JS未達**のため現状影響はフィッシング/信頼UI内iframe程度（Androidと同系）。

2. **単独Criticalにしない理由**  
   - メッセージ/連絡先/認証情報への到達チェーンが静的に閉じない。  
   - R2Sは許可オリジン上の別問題；プレビューXSSとの結合はSOPで切れている（`wickrweb` fetch残件を除く）。

3. **ランタイムで潰すべき残件（最小影響）**  
   - amplify iframe内: `fetch('wickrweb://users/self')` / `fetch('wickrweb://contacts/contacts')` の成否（読取のみ）。  
   - 同: `typeof qt`, `typeof qt?.webChannelTransport`。  
   - DevTools: プレビューと親の `location.origin`、fileData応答の Content-Type。

---

## 成果物参照

| パス | 内容 |
|---|---|
| `wickr/extracted/sources/src/components/Modals/FilePreviewModal/index.tsx` | P0/P4 |
| `wickr/extracted/sources/src/apis/webFetch/endpoints.ts` | P3 全ルート |
| `wickr/extracted/sources/src/apis/webChannel/*` | P1 |
| `wickr/extracted/rcc/preloads.js` | preload実体 |
| `wickr/extracted/decompressed/qml_0x030A2BEC_7847.bin` | WebEngine/QML |
| `notes/WAVE2-REPORT.md` / `WAVE2-A-CSP-BYPASS-FINAL.md` | CSP障壁・altChunk・宣言的GET |
| `wickr/reviews/phase-2b-runtime-boundaries.md` | CSP/postMessage境界 |

---

## 追補 — JSなし／異オリジンJSで「できること」（影響拡大サーフェス）

CriticalなメッセージDB到達は未成立でも、DOCX HTMLインジェクション単体で **実害・報告価値のある行為** は複数ある。DOCX経路は **DOMPurifyなし**（PPTXはあり）。

### シンク一覧（docx-preview）

| シンク | 攻撃者制御 | ファイル |
|---|---|---|
| `renderSymbol` → `innerHTML` | `w:sym/@w:char` でHTMLブレイクアウト | `docx-preview.mjs:3530-3534` |
| `renderAltChunk` → `iframe.srcdoc` | HTMLパート全文（default **有効**） | `:3476-3483` |
| `renderHyperlink` → `a.href` | 外部リレーション Target | `:3426-3438` |
| VML `style` 属性生代入 | 任意CSS文字列 | `:1280-1284`, `:3638-3640` |
| `createStyleElement` → style `innerHTML` | 生成CSS（主にblob font） | `:3865-3866` |

---

### できることランキング（現状CSP下）

#### 1. [Medium] Amplify iframe 埋め込み → 攻撃者JS + 権限自動許可（1-click）

DOCX注入で `<iframe src="https://main.d4zeeqgazhley.amplifyapp.com/">`（`frame-src` 許可）。R2Sでそのオリジン上に攻撃者JS。

同時にQMLが **全オリジンへ feature permission を自動 grant**:

```
onFeaturePermissionRequested: grantFeaturePermission(securityOrigin, feature, true)
settings.javascriptCanAccessClipboard: true
settings.javascriptCanPaste: true
onCertificateError: error.acceptCertificate()  // 証明書エラー無視
```

| できること | オフボックスexfil | 確度 |
|---|---|---|
| カメラ／マイク／位置情報の要求（自動許可の可能性） | 録音・映像を攻撃者サーバへ | ソース証明（grant）／実成功はランタイム |
| クリップボード読取試行 | コピー内容 | エンジン設定証明／Chromiumのgesture要件あり |
| プレビュー領域を偽UIで占有（ファイル名ヘッダは本物のまま） | フィッシング | ソース証明 |
| 親のメッセージ／`wickrweb`／`qt` | **不可**（SOP + originゲート） | ソース証明 |

CheckSpeedModalも同じAmplify URLを正規利用するが、DOCX経路は **スピードテストUIを開かせずに** 到達できる。

#### 2. [Low–Med] 宣言的 `wickrweb://` GET（`<img>` / `<video>` / CSS `url()`）

`img-src`/`media-src`/`style-src 'unsafe-inline'` が `wickrweb://*` を許すため、**JSなし・1-click** でネイティブハンドラへGET。

| ルート | 効果 | 確度 |
|---|---|---|
| `/image/message/:cid/:mid` 等 | 復号メディアをプレビュー内に**表示**（被害者画面上のローカル開示）。攻撃者は会話参加者なら既知IDを埋め込める | ソース証明 |
| `/message/:cid/:mid/react/:emoji` | 絵文字リアクション追加の可能性（`remove`はヘッダのため削除不可）。ネイティブに `empty emoji header provided` 文字列あり → **パスだけで足りるかはランタイム要確認** | 中 |
| `admin/controls` | 管理コンソールUI起動（非AWSネットワークのadminのみ）。AWSホストでは多くがno-op | ソース証明 |
| `awsCredentials` / `contacts` / `users/self` 等 | リクエストは飛ぶが**応答ボディは読めない**（blind） | ソース証明 |
| password / leaveNetwork / inviteUser | **ヘッダ必須** → 宣言的GETでは失敗 | ソース証明 |

#### 3. [Low–Med] リンクフィッシング（クリック + 確認ダイアログ）

注入`<a href=https://evil>` → `withLinkHandler` → 親 `openLink` → 「You are leaving Wickr」確認後、ネイティブは **http/https/mailtoのみ**（`0x1409c7950`）。

**抜け穴候補:** `withLinkHandler` は `click` のみ購読。**中クリック／auxclick は未ハンドル** → 確認ダイアログなしでiframe内ナビの可能性（要ランタイム）。

#### 4. [Low] プレビュー内容の完全なりすまし

任意HTML+CSSで偽「続行」「認証」UI。ModalHeaderのファイル名は本物。credential theft用フォームは `form-action` 未定義のため外部POST可だが、**自動送信はJSなしでは不可**（クリック必要）。プレビューにセッション秘密はほぼ無い。

#### 5. [Low] CSPギャップの悪用余地

| ギャップ | 利用 |
|---|---|
| `form-action` なし | 外部フォームPOST（ユーザ操作必要） |
| `base-uri` なし | `<base href=wickrweb://…>` + 相対`<img>` でreact URL組み立て等（理論） |
| `frame-ancestors` meta無効 | 他からのframing問題ではない |
| altChunk → srcdoc | 同一オリジンscript実行の**単一障壁**（CSP継承のみ）。将来のCSP弱体化＝RCE |

#### 6. [Hardening] 中クリック回避・権限・宣言的GET

報告／修正提案として有効:

1. プレビューiframeに `sandbox`（`allow-same-origin` を外すか最小権限）
2. `renderAltChunks: false` + `renderSymbol` サニタイズ
3. `wickrweb://*` を `img-src`/`media-src`/`default-src` から除去、またはGETを冪等に
4. `base-uri 'none'` + `form-action 'self'`
5. `grantFeaturePermission` をプロンプト制に／preview由来オリジンは拒否
6. `frame-src` から amplify を外すか path 固定
7. `withLinkHandler` に `auxclick` も追加
8. `event.source === iframe.contentWindow` 検証

---

### Android報告への載せ方（追補後）

| 主張 | 載せる？ |
|---|---|
| デスクトップでも同一HTMLインジェクション | ✅ |
| 同一オリジン非sandbox iframe + ブリッジ到達の**潜在**構造 | ✅（CSPが唯一障壁と明記） |
| Amplify frame + 権限自動grant（R2Sと結合すると信頼UI内でA/V） | ✅ Medium候補として独立または統合 |
| 宣言的react / メディア表示 | ✅ Low、ランタイム注記付き |
| メッセージDB・認証情報の実漏洩 | ❌ 未成立（amplify→wickrweb fetch残件のみ） |

---

### 追加ランタイムプローブ（最小影響）

1. DOCX注入iframe(amplify)内: `navigator.mediaDevices.getUserMedia` の成否（即座にstop）
2. 同: `navigator.clipboard.readText()`（失敗预期でもログ）
3. 同: `fetch('wickrweb://users/self')`（読取のみ）
4. `<img src="wickrweb://message/{cid}/{mid}/react/%F0%9F%91%8D">` でリアクションが増えるか
5. 注入リンクの中クリックで確認ダイアログを bypass するか

---

*過大主張回避: ストッククライアント実行による amplify→wickrweb / qt / getUserMedia / react GET 観測は未実施。Criticalデータ到達は主張しない。*
